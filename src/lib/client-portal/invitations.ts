import "server-only";

import { generateTemporaryPassword } from "@/lib/auth/password-store";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  sbAcceptClientInvitation,
  sbGetInvitationById,
  sbGetInvitationByTokenHash,
  sbListClientInvitations,
  sbRevokeClientInvitation,
  sbRotateInvitationToken,
  type ClientInvitationRow,
} from "@/lib/supabase/client-invitations-repo";
import {
  isValidClientInvitationAssignee,
  resolveAssigneeDisplayName,
} from "./assignees";
import { provisionClientPortalAuthUser } from "./client-auth-provision";
import {
  createClientInvitationCore,
  invitationRecordToPublic,
  mapInvitationRecordsToPublic,
  type CreateInvitationInput,
  type CreateInvitationResult,
  type InvitationPublicDto,
} from "./invitation-service";
import {
  createSupabaseInvitationStore,
} from "./invitation-supabase-store";
import type {
  InvitationRecord,
  InvitationStore,
  ResetInvitationCredentialsResult,
} from "./invitation-types";
import {
  localAcceptInvitation,
  localFindInvitationById,
  localFindInvitationByTokenHash,
  localInsertInvitation,
  localListInvitations,
  localRevokeInvitation,
  localRotateInvitationToken,
  type LocalInvitationRow,
} from "./local-store";
import {
  buildClientInviteUrl,
  computeInvitationState,
  generateClientInviteToken,
  hashClientInviteToken,
  isInternalTestInviteEmail,
  normalizeInviteEmail,
} from "./invite-token";
import {
  hideInvitationFromStaffList,
  listHiddenInvitationIds,
} from "./invitation-list-visibility";
import type { ClientPortalLocale } from "./types";

export type {
  CreateInvitationInput,
  CreateInvitationResult,
  InvitationPublicDto,
  ResetInvitationCredentialsResult,
};

function toRecord(row: ClientInvitationRow | LocalInvitationRow): InvitationRecord {
  return {
    id: row.id,
    email: row.email,
    tokenHash: row.tokenHash,
    preferredLocale: row.preferredLocale,
    serviceType: row.serviceType,
    assignedTo: row.assignedTo,
    questionnaireTemplateKey: row.questionnaireTemplateKey,
    expiresAt: row.expiresAt,
    acceptedAt: row.acceptedAt,
    revokedAt: row.revokedAt,
    acceptedByUserId: row.acceptedByUserId,
    createdBy: row.createdBy,
    createRequestId: row.createRequestId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function getInvitationStore(): InvitationStore {
  if (isSupabaseConfigured()) {
    return createSupabaseInvitationStore(getSupabaseAdmin());
  }

  return {
    async findByRequestId(createdBy, requestId) {
      const { localFindInvitationByRequestId } = await import("./local-store");
      const row = await localFindInvitationByRequestId(createdBy, requestId);
      return row ? toRecord(row) : null;
    },
    async insert(input) {
      const row = await localInsertInvitation({
        email: input.email,
        tokenHash: input.tokenHash,
        preferredLocale: input.preferredLocale,
        serviceType: input.serviceType,
        assignedTo: input.assignedTo,
        questionnaireTemplateKey: input.questionnaireTemplateKey,
        expiresAt: input.expiresAt,
        createdBy: input.createdBy,
        createRequestId: input.createRequestId,
      });
      return toRecord(row);
    },
  };
}

const assigneeResolver = {
  validate: isValidClientInvitationAssignee,
};

const assigneeNameResolver = {
  resolve: resolveAssigneeDisplayName,
};

export async function createClientInvitation(
  input: CreateInvitationInput,
): Promise<CreateInvitationResult> {
  const result = await createClientInvitationCore(
    input,
    getInvitationStore(),
    assigneeResolver,
  );
  if (!result.ok || result.reused) {
    return result;
  }

  const temporaryPassword = generateTemporaryPassword(12);
  if (isSupabaseConfigured()) {
    const provisioned = await provisionClientPortalAuthUser({
      email: result.invitation.email,
      password: temporaryPassword,
      firstName: input.firstName,
    });
    if (!provisioned.ok) {
      await deleteClientInvitation(result.invitation.id);
      return { ok: false, code: "AUTH_PROVISION_FAILED" };
    }
  }

  return { ...result, temporaryPassword };
}

export async function resetClientInvitationCredentials(input: {
  id: string;
  origin: string;
  firstName?: string | null;
}): Promise<ResetInvitationCredentialsResult> {
  const before = isSupabaseConfigured()
    ? await sbGetInvitationById(input.id)
    : await localFindInvitationById(input.id);
  if (!before) return { ok: false, code: "NOT_FOUND" };

  const state = computeInvitationState(before);
  if (state !== "pending" && state !== "accepted") {
    return { ok: false, code: "INVITATION_INVALID" };
  }

  const temporaryPassword = generateTemporaryPassword(12);
  if (isSupabaseConfigured()) {
    const provisioned = await provisionClientPortalAuthUser({
      email: before.email,
      password: temporaryPassword,
      firstName: input.firstName,
    });
    if (!provisioned.ok) {
      return { ok: false, code: "AUTH_PROVISION_FAILED" };
    }
  }

  let inviteUrl: string;
  if (state === "pending") {
    const token = generateClientInviteToken();
    const tokenHash = hashClientInviteToken(token);
    const rotated = isSupabaseConfigured()
      ? await sbRotateInvitationToken(before.id, tokenHash)
      : await localRotateInvitationToken(before.id, tokenHash);
    if (!rotated) {
      return { ok: false, code: "INVITATION_INVALID" };
    }
    inviteUrl = buildClientInviteUrl(token, input.origin);
  } else {
    const origin = input.origin.replace(/\/$/, "");
    inviteUrl = `${origin}/client/login`;
  }

  return {
    ok: true,
    email: before.email,
    temporaryPassword,
    inviteUrl,
    state,
  };
}

export async function listClientInvitations(): Promise<InvitationPublicDto[]> {
  const rows = isSupabaseConfigured()
    ? (await sbListClientInvitations()).map(toRecord)
    : (await localListInvitations()).map(toRecord);

  const hiddenIds = await listHiddenInvitationIds();
  const visible = rows.filter((row) => {
    if (isInternalTestInviteEmail(row.email) || hiddenIds.has(row.id)) {
      return false;
    }
    const state = computeInvitationState(row);
    return state === "pending" || state === "accepted";
  });
  return mapInvitationRecordsToPublic(visible, assigneeNameResolver);
}

export async function revokeClientInvitation(
  id: string,
): Promise<
  | { ok: true; invitation: InvitationPublicDto }
  | { ok: false; code: string }
> {
  const before = isSupabaseConfigured()
    ? await sbGetInvitationById(id)
    : await localFindInvitationById(id);
  if (!before) return { ok: false, code: "NOT_FOUND" };

  const state = computeInvitationState(before);
  if (state === "accepted") {
    return { ok: false, code: "ALREADY_ACCEPTED" };
  }

  const after = isSupabaseConfigured()
    ? await sbRevokeClientInvitation(id)
    : await localRevokeInvitation(id);

  if (!after) return { ok: false, code: "NOT_FOUND" };
  return { ok: true, invitation: invitationRecordToPublic(toRecord(after)) };
}

/** Remove from staff list; revoke pending/expired links so they stop working. */
export async function deleteClientInvitation(
  id: string,
): Promise<{ ok: true } | { ok: false; code: string }> {
  const before = isSupabaseConfigured()
    ? await sbGetInvitationById(id)
    : await localFindInvitationById(id);
  if (!before) return { ok: false, code: "NOT_FOUND" };

  const state = computeInvitationState(before);
  if (state === "pending" || state === "expired") {
    const revoked = isSupabaseConfigured()
      ? await sbRevokeClientInvitation(id)
      : await localRevokeInvitation(id);
    if (!revoked) return { ok: false, code: "NOT_FOUND" };
  }

  const hidden = await hideInvitationFromStaffList(id);
  if (!hidden) return { ok: false, code: "INTERNAL" };
  return { ok: true };
}

export type InvitePreview =
  | {
      status: "valid";
      maskedEmail: string;
      preferredLocale: ClientPortalLocale;
      expiresAt: string;
      serviceType: string | null;
    }
  | { status: "expired" }
  | { status: "revoked" }
  | { status: "accepted" }
  | { status: "invalid" };

export async function previewInvitationByToken(
  token: string,
): Promise<InvitePreview> {
  if (!token || token.length < 16 || token.length > 256) {
    return { status: "invalid" };
  }

  const tokenHash = hashClientInviteToken(token);
  const row = isSupabaseConfigured()
    ? await sbGetInvitationByTokenHash(tokenHash)
    : await localFindInvitationByTokenHash(tokenHash);

  if (!row) return { status: "invalid" };

  const state = computeInvitationState(row);
  if (state === "revoked") return { status: "revoked" };
  if (state === "accepted") return { status: "accepted" };
  if (state === "expired") return { status: "expired" };

  const { maskEmail } = await import("./invite-token");
  return {
    status: "valid",
    maskedEmail: maskEmail(row.email),
    preferredLocale: row.preferredLocale,
    expiresAt: row.expiresAt,
    serviceType: row.serviceType,
  };
}

export async function acceptInvitationByToken(input: {
  token: string;
  authUserId: string;
  authEmail: string;
}): Promise<
  | { ok: true; redirectTo: "/client" }
  | { ok: false; code: string }
> {
  if (!input.token || input.token.length < 16 || input.token.length > 256) {
    return { ok: false, code: "INVITATION_INVALID" };
  }

  const tokenHash = hashClientInviteToken(input.token);
  const row = isSupabaseConfigured()
    ? await sbGetInvitationByTokenHash(tokenHash)
    : await localFindInvitationByTokenHash(tokenHash);

  if (!row) return { ok: false, code: "INVITATION_INVALID" };

  const authEmail = normalizeInviteEmail(input.authEmail);
  if (!authEmail || authEmail !== row.email) {
    return { ok: false, code: "EMAIL_MISMATCH" };
  }

  const state = computeInvitationState(row);
  if (state === "revoked") return { ok: false, code: "INVITATION_REVOKED" };
  if (state === "expired") return { ok: false, code: "INVITATION_EXPIRED" };

  try {
    if (isSupabaseConfigured()) {
      await sbAcceptClientInvitation({
        invitationId: row.id,
        authUserId: input.authUserId,
        email: authEmail,
        preferredLocale: row.preferredLocale,
      });
    } else {
      await localAcceptInvitation({
        invitationId: row.id,
        authUserId: input.authUserId,
        email: authEmail,
        preferredLocale: row.preferredLocale,
      });
    }
    return { ok: true, redirectTo: "/client" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "invitation_accepted") {
      return { ok: false, code: "INVITATION_ACCEPTED" };
    }
    if (msg === "invitation_revoked") {
      return { ok: false, code: "INVITATION_REVOKED" };
    }
    if (msg === "invitation_expired") {
      return { ok: false, code: "INVITATION_EXPIRED" };
    }
    if (msg === "portal_user_other_invite") {
      return { ok: false, code: "PORTAL_USER_EXISTS" };
    }
    if (isSupabaseConfigured()) {
      const again = await sbGetInvitationByTokenHash(tokenHash);
      if (
        again?.acceptedAt &&
        again.acceptedByUserId === input.authUserId
      ) {
        return { ok: true, redirectTo: "/client" };
      }
    }
    return { ok: false, code: "ACCEPT_FAILED" };
  }
}
