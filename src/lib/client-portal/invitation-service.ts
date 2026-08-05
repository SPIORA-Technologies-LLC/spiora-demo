import {
  assertInvitationDtoHasNoTokenHash,
  buildClientInviteUrl,
  computeInvitationState,
  generateClientInviteToken,
  hashClientInviteToken,
  normalizeInviteEmail,
} from "./invite-token";
import { normalizeName } from "./display-name";
import type {
  AssigneeNameResolver,
  AssigneeResolver,
  CreateInvitationInput,
  CreateInvitationResult,
  InvitationPublicDto,
  InvitationRecord,
  InvitationStore,
} from "./invitation-types";
import { isClientPortalLocale } from "./types";

const MIN_DAYS = 1;
const MAX_DAYS = 30;

function toPublic(
  row: InvitationRecord,
  assignedToName: string | null = null,
): InvitationPublicDto {
  return {
    id: row.id,
    email: row.email,
    firstName: row.firstName,
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

export async function createClientInvitationCore(
  input: CreateInvitationInput,
  store: InvitationStore,
  assignees: AssigneeResolver,
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

  const assigneeOk = await assignees.validate(assignedTo, {
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
    const existing = await store.findByRequestId(input.createdBy, requestId);
    if (existing) {
      return {
        ok: true,
        invitation: toPublic(existing),
        inviteUrl: "",
        reused: true,
      };
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

  const firstName = normalizeName(input.firstName);

  const row = await store.insert({
    email,
    firstName,
    tokenHash,
    preferredLocale: localeRaw,
    serviceType,
    assignedTo,
    questionnaireTemplateKey: templateKey,
    expiresAt,
    createdBy: input.createdBy,
    createRequestId: requestId,
  });

  const inviteUrl = buildClientInviteUrl(token, input.origin);
  const dto = toPublic(row);
  assertInvitationDtoHasNoTokenHash(dto);

  return { ok: true, invitation: dto, inviteUrl, reused: false };
}

export function invitationRecordToPublic(
  row: InvitationRecord,
  assignedToName: string | null = null,
): InvitationPublicDto {
  return toPublic(row, assignedToName);
}

export async function mapInvitationRecordsToPublic(
  rows: InvitationRecord[],
  names: AssigneeNameResolver,
): Promise<InvitationPublicDto[]> {
  const result: InvitationPublicDto[] = [];
  for (const row of rows) {
    const assignedToName = await names.resolve(row.assignedTo);
    const dto = toPublic(row, assignedToName);
    assertInvitationDtoHasNoTokenHash(dto);
    result.push(dto);
  }
  return result;
}

export type { CreateInvitationInput, CreateInvitationResult, InvitationPublicDto };
