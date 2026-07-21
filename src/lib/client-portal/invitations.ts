import "server-only";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  sbAcceptClientInvitation,
  sbGetInvitationById,
  sbGetInvitationByRequestId,
  sbGetInvitationByTokenHash,
  sbInsertClientInvitation,
  sbListClientInvitations,
  sbRevokeClientInvitation,
  type ClientInvitationRow,
} from "@/lib/supabase/client-invitations-repo";
import {
  isValidClientInvitationAssignee,
  resolveAssigneeDisplayName,
} from "./assignees";
import {
  localAcceptInvitation,
  localFindInvitationById,
  localFindInvitationByRequestId,
  localFindInvitationByTokenHash,
  localInsertInvitation,
  localListInvitations,
  localRevokeInvitation,
  type LocalInvitationRow,
} from "./local-store";
import {
  buildClientInviteUrl,
  assertInvitationDtoHasNoTokenHash,
  computeInvitationState,
  generateClientInviteToken,
  hashClientInviteToken,
  normalizeInviteEmail,
  type ClientInvitationState,
} from "./invite-token";
import type { ClientPortalLocale } from "./types";
import { isClientPortalLocale } from "./types";

export type InvitationPublicDto = {
  id: string;
  email: string;
  preferredLocale: ClientPortalLocale;
  serviceType: string | null;
  assignedTo: string | null;
  assignedToName: string | null;
  questionnaireTemplateKey: string | null;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  createdBy: string;
  createdAt: string;
  state: ClientInvitationState;
};

function toPublic(
  row: ClientInvitationRow | LocalInvitationRow,
  assignedToName: string | null = null,
): InvitationPublicDto {
  return {
    id: row.id,
    email: row.email,
    preferredLocale: row.preferredLocale,
    serviceType: row.serviceType,
    assignedTo: row.assignedTo,
    assignedToName,
    questionnaireTemplateKey: row.questionnaireTemplateKey,
    expiresAt: row.expiresAt,
    acceptedAt: row.acceptedAt,
    revokedAt: row.revokedAt,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    state: computeInvitationState(row),
  };
}

export type CreateInvitationInput = {
  email: string;
  preferredLocale?: string;
  serviceType?: string | null;
  assignedTo?: string | null;
  expiresInDays?: number;
  requestId?: string | null;
  questionnaireTemplateKey?: string | null;
  createdBy: string;
  employeeRole: "owner" | "manager";
  origin: string;
};

export type CreateInvitationResult =
  | {
      ok: true;
      invitation: InvitationPublicDto;
      inviteUrl: string;
      /** Present only on first create of this requestId (not on idempotent replay of URL — still returned from memory of create). */
      reused: boolean;
    }
  | { ok: false; code: string };

const MIN_DAYS = 1;
const MAX_DAYS = 30;

export async function createClientInvitation(
  input: CreateInvitationInput,
): Promise<CreateInvitationResult> {
  const email = normalizeInviteEmail(input.email);
  if (!email) return { ok: false, code: "INVALID_EMAIL" };

  const localeRaw = input.preferredLocale ?? "ru";
  if (!isClientPortalLocale(localeRaw)) {
    return { ok: false, code: "INVALID_LOCALE" };
  }

  const days = input.expiresInDays ?? 7;
  if (!Number.isInteger(days) || days < MIN_DAYS || days > MAX_DAYS) {
    return { ok: false, code: "INVALID_EXPIRY" };
  }

  let assignedTo: string | null = input.assignedTo ?? null;
  if (!assignedTo || !assignedTo.trim()) {
    return { ok: false, code: "ASSIGNEE_REQUIRED" };
  }
  assignedTo = assignedTo.trim();

  const assigneeOk = await isValidClientInvitationAssignee(assignedTo, {
    employeeId: input.createdBy,
    employeeRole: input.employeeRole,
  });
  if (!assigneeOk) {
    return { ok: false, code: "INVALID_ASSIGNEE" };
  }

  const requestId =
    typeof input.requestId === "string" && input.requestId.trim().length > 0
      ? input.requestId.trim().slice(0, 128)
      : null;

  if (requestId) {
    if (isSupabaseConfigured()) {
      const existing = await sbGetInvitationByRequestId(
        input.createdBy,
        requestId,
      );
      if (existing) {
        // Idempotent replay: cannot reconstruct plaintext URL
        return {
          ok: true,
          invitation: toPublic(existing),
          inviteUrl: "",
          reused: true,
        };
      }
    } else {
      const existing = await localFindInvitationByRequestId(
        input.createdBy,
        requestId,
      );
      if (existing) {
        return {
          ok: true,
          invitation: toPublic(existing),
          inviteUrl: "",
          reused: true,
        };
      }
    }
  }

  const token = generateClientInviteToken();
  const tokenHash = hashClientInviteToken(token);
  const createdAt = new Date();
  const expiresAt = new Date(
    createdAt.getTime() + days * 24 * 60 * 60 * 1000,
  ).toISOString();

  const serviceType =
    typeof input.serviceType === "string" && input.serviceType.trim()
      ? input.serviceType.trim().slice(0, 120)
      : null;

  const templateKey =
    typeof input.questionnaireTemplateKey === "string" &&
    input.questionnaireTemplateKey.trim()
      ? input.questionnaireTemplateKey.trim().slice(0, 120)
      : null;

  let row: ClientInvitationRow | LocalInvitationRow;
  if (isSupabaseConfigured()) {
    row = await sbInsertClientInvitation({
      email,
      tokenHash,
      preferredLocale: localeRaw,
      serviceType,
      assignedTo,
      questionnaireTemplateKey: templateKey,
      expiresAt,
      createdBy: input.createdBy,
      createRequestId: requestId,
    });
  } else {
    row = await localInsertInvitation({
      email,
      tokenHash,
      preferredLocale: localeRaw,
      serviceType,
      assignedTo,
      questionnaireTemplateKey: templateKey,
      expiresAt,
      createdBy: input.createdBy,
      createRequestId: requestId,
    });
  }

  const inviteUrl = buildClientInviteUrl(token, input.origin);
  const dto = toPublic(row);
  assertInvitationDtoHasNoTokenHash(dto);

  return { ok: true, invitation: dto, inviteUrl, reused: false };
}

export async function listClientInvitations(): Promise<InvitationPublicDto[]> {
  const rows = isSupabaseConfigured()
    ? await sbListClientInvitations()
    : await localListInvitations();

  const result: InvitationPublicDto[] = [];

  for (const row of rows) {
    const name = await resolveAssigneeDisplayName(row.assignedTo);
    const dto = toPublic(row, name);
    assertInvitationDtoHasNoTokenHash(dto);
    result.push(dto);
  }
  return result;
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
  return { ok: true, invitation: toPublic(after) };
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
    // Idempotent success path may throw oddly — recheck
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
