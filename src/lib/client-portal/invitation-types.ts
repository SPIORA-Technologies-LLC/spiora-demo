import type { ClientPortalLocale } from "./types";
import type { ClientInvitationState } from "./invite-token";

export type InvitationRecord = {
  id: string;
  email: string;
  firstName: string | null;
  tokenHash: string;
  preferredLocale: ClientPortalLocale;
  serviceType: string | null;
  assignedTo: string | null;
  questionnaireTemplateKey: string | null;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  acceptedByUserId: string | null;
  createdBy: string;
  createRequestId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type InvitationPublicDto = {
  id: string;
  email: string;
  firstName: string | null;
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

export type CreateInvitationInput = {
  email: string;
  preferredLocale?: string;
  serviceType?: string | null;
  assignedTo?: string | null;
  expiresInDays?: number;
  requestId?: string | null;
  questionnaireTemplateKey?: string | null;
  firstName?: string | null;
  createdBy: string;
  employeeRole: "owner" | "manager";
  origin: string;
};

export type CreateInvitationResult =
  | {
      ok: true;
      invitation: InvitationPublicDto;
      inviteUrl: string;
      reused: boolean;
      temporaryPassword?: string;
    }
  | { ok: false; code: string };

export type ResetInvitationCredentialsResult =
  | {
      ok: true;
      email: string;
      temporaryPassword: string;
      inviteUrl: string;
      state: "pending" | "accepted";
      preferredLocale: ClientPortalLocale;
      firstName: string | null;
    }
  | { ok: false; code: string };

export type InvitationInsertInput = {
  email: string;
  firstName: string | null;
  tokenHash: string;
  preferredLocale: ClientPortalLocale;
  serviceType: string | null;
  assignedTo: string;
  questionnaireTemplateKey: string | null;
  expiresAt: string;
  createdBy: string;
  createRequestId: string | null;
};

export type InvitationStore = {
  findByRequestId(
    createdBy: string,
    requestId: string,
  ): Promise<InvitationRecord | null>;
  insert(input: InvitationInsertInput): Promise<InvitationRecord>;
};

export type AssigneeResolver = {
  validate(
    assigneeId: string,
    context: { employeeId: string; employeeRole: "owner" | "manager" },
  ): Promise<boolean>;
};

export type AssigneeNameResolver = {
  resolve(assigneeId: string | null): Promise<string | null>;
};
