import type { ClientFilters } from "@/lib/google-sheets/types";

/** Sheet-style CRM extras stored in `clients.legacy_fields`. */
export type ClientLegacyFieldsInput = {
  submittedAt?: string;
  expectedApprovalAt?: string;
  referentName?: string;
  bookingAddress?: string;
  bookingRange?: string;
  approvalAt?: string;
  residenceCardIssuedAt?: string;
  appPassword?: string;
  partnerName?: string;
  contract?: string;
};

export const CLIENT_LEGACY_FIELD_KEYS = [
  "submittedAt",
  "expectedApprovalAt",
  "referentName",
  "bookingAddress",
  "bookingRange",
  "approvalAt",
  "residenceCardIssuedAt",
  "appPassword",
  "partnerName",
  "contract",
] as const satisfies readonly (keyof ClientLegacyFieldsInput)[];

export type CreateClientInput = {
  name: string;
  email?: string;
  phone?: string;
  country?: string;
  citizenship?: string;
  direction?: string;
  status?: string;
  pipelineStage?: string;
  manager?: string;
  assignedUserId?: string;
  serviceType?: string;
  passportNumber?: string;
  notesSummary?: string;
  externalId?: string;
} & ClientLegacyFieldsInput;

export type UpdateClientInput = {
  name?: string;
  email?: string;
  phone?: string;
  country?: string;
  citizenship?: string;
  direction?: string;
  status?: string;
  pipelineStage?: string;
  manager?: string;
  assignedUserId?: string;
  serviceType?: string;
  passportNumber?: string;
  notesSummary?: string;
} & ClientLegacyFieldsInput;

const MAX_FIELD_LENGTH = 500;
const MAX_NAME_LENGTH = 200;
const MAX_EMAIL_LENGTH = 320;

export class ClientValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClientValidationError";
  }
}

function trimOptional(value: string | undefined, max: number): string {
  if (value === undefined) return "";
  const trimmed = value.trim();
  if (trimmed.length > max) {
    throw new ClientValidationError(`Field exceeds ${max} characters`);
  }
  return trimmed;
}

export function validateCreateClientInput(input: CreateClientInput): CreateClientInput {
  const name = input.name?.trim();
  if (!name) {
    throw new ClientValidationError("Name is required");
  }
  if (name.length > MAX_NAME_LENGTH) {
    throw new ClientValidationError("Name is too long");
  }

  const email = trimOptional(input.email, MAX_EMAIL_LENGTH);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ClientValidationError("Invalid email");
  }

  const externalId = input.externalId?.trim();
  if (externalId && !/^DEMO-\d{4,}$/.test(externalId)) {
    throw new ClientValidationError("Invalid external ID format");
  }

  const legacy = pickLegacyFields(input);
  const manager =
    trimOptional(input.manager, MAX_FIELD_LENGTH) ||
    legacy.referentName ||
    "";

  return {
    name,
    email,
    phone: trimOptional(input.phone, 64),
    country: trimOptional(input.country, MAX_FIELD_LENGTH),
    citizenship: trimOptional(input.citizenship, MAX_FIELD_LENGTH),
    direction: trimOptional(input.direction, MAX_FIELD_LENGTH),
    status: trimOptional(input.status, 120) || "New",
    pipelineStage: trimOptional(input.pipelineStage, 120) || "Intake",
    manager,
    assignedUserId: trimOptional(input.assignedUserId, 120) || undefined,
    serviceType: trimOptional(input.serviceType, MAX_FIELD_LENGTH),
    passportNumber: trimOptional(input.passportNumber, 64) || undefined,
    notesSummary: trimOptional(input.notesSummary, 2000) || undefined,
    externalId: externalId || undefined,
    ...legacy,
  };
}

export function pickLegacyFields(
  input: ClientLegacyFieldsInput,
): ClientLegacyFieldsInput {
  const result: ClientLegacyFieldsInput = {};
  for (const key of CLIENT_LEGACY_FIELD_KEYS) {
    if (input[key] === undefined) continue;
    const value = trimOptional(input[key], MAX_FIELD_LENGTH);
    if (value) result[key] = value;
  }
  return result;
}

export function buildLegacyFieldsRecord(
  input: ClientLegacyFieldsInput,
): Record<string, string> {
  const picked = pickLegacyFields(input);
  const record: Record<string, string> = {};
  for (const key of CLIENT_LEGACY_FIELD_KEYS) {
    const value = picked[key];
    if (value) record[key] = value;
  }
  return record;
}

const UPDATE_ALLOWED_KEYS: (keyof UpdateClientInput)[] = [
  "name",
  "email",
  "phone",
  "country",
  "citizenship",
  "direction",
  "status",
  "pipelineStage",
  "manager",
  "assignedUserId",
  "serviceType",
  "passportNumber",
  "notesSummary",
  ...CLIENT_LEGACY_FIELD_KEYS,
];

export function validateUpdateClientInput(
  input: UpdateClientInput,
): UpdateClientInput {
  const hasAny = UPDATE_ALLOWED_KEYS.some(
    (key) => input[key] !== undefined && input[key] !== null,
  );
  if (!hasAny) {
    throw new ClientValidationError("No fields to update");
  }

  const result: UpdateClientInput = {};

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new ClientValidationError("Name cannot be empty");
    if (name.length > MAX_NAME_LENGTH) {
      throw new ClientValidationError("Name is too long");
    }
    result.name = name;
  }

  if (input.email !== undefined) {
    const email = input.email.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new ClientValidationError("Invalid email");
    }
    result.email = email;
  }

  if (input.phone !== undefined) result.phone = trimOptional(input.phone, 64);
  if (input.country !== undefined) result.country = trimOptional(input.country, MAX_FIELD_LENGTH);
  if (input.citizenship !== undefined) {
    result.citizenship = trimOptional(input.citizenship, MAX_FIELD_LENGTH);
  }
  if (input.direction !== undefined) {
    result.direction = trimOptional(input.direction, MAX_FIELD_LENGTH);
  }
  if (input.status !== undefined) result.status = trimOptional(input.status, 120);
  if (input.pipelineStage !== undefined) {
    result.pipelineStage = trimOptional(input.pipelineStage, 120);
  }
  if (input.manager !== undefined) {
    result.manager = trimOptional(input.manager, MAX_FIELD_LENGTH);
  }
  if (input.assignedUserId !== undefined) {
    result.assignedUserId = trimOptional(input.assignedUserId, 120) || undefined;
  }
  if (input.serviceType !== undefined) {
    result.serviceType = trimOptional(input.serviceType, MAX_FIELD_LENGTH);
  }
  if (input.passportNumber !== undefined) {
    result.passportNumber = trimOptional(input.passportNumber, 64) || undefined;
  }
  if (input.notesSummary !== undefined) {
    result.notesSummary = trimOptional(input.notesSummary, 2000);
  }

  for (const key of CLIENT_LEGACY_FIELD_KEYS) {
    if (input[key] === undefined) continue;
    result[key] = trimOptional(input[key], MAX_FIELD_LENGTH);
  }

  if (
    result.manager === undefined &&
    typeof result.referentName === "string" &&
    result.referentName
  ) {
    result.manager = result.referentName;
  }

  return result;
}

export function sanitizeClientFilters(filters: ClientFilters): ClientFilters {
  const trim = (value?: string) => value?.trim() || undefined;
  return {
    search: trim(filters.search),
    direction: trim(filters.direction),
    status: trim(filters.status),
    manager: trim(filters.manager),
    country: trim(filters.country),
  };
}

export function escapeIlikePattern(value: string): string {
  return value.replace(/[%_\\]/g, "\\$&");
}
