export type CalendarExternalInvitee = {
  name: string;
  email: string | null;
};

export const MAX_EXTERNAL_INVITEES = 20;
export const EXTERNAL_INVITEE_NAME_MIN = 2;
export const EXTERNAL_INVITEE_NAME_MAX = 80;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeExternalInviteeName(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (
    trimmed.length < EXTERNAL_INVITEE_NAME_MIN ||
    trimmed.length > EXTERNAL_INVITEE_NAME_MAX
  ) {
    return null;
  }
  return trimmed;
}

export function normalizeExternalInviteeEmail(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }
  if (trimmed.length > 254 || !EMAIL_RE.test(trimmed)) {
    return null;
  }
  return trimmed;
}

/**
 * Coerce unknown JSON / API payloads into a sanitized invitee list.
 * Invalid entries are dropped; result is capped at MAX_EXTERNAL_INVITEES.
 */
export function normalizeExternalInvitees(
  value: unknown,
): CalendarExternalInvitee[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const result: CalendarExternalInvitee[] = [];
  const seen = new Set<string>();

  for (const item of value) {
    if (result.length >= MAX_EXTERNAL_INVITEES) {
      break;
    }
    if (!item || typeof item !== "object") {
      continue;
    }
    const record = item as Record<string, unknown>;
    const name = normalizeExternalInviteeName(record.name);
    if (!name) {
      continue;
    }
    const email = normalizeExternalInviteeEmail(record.email);
    const key = `${name.toLowerCase()}|${email ?? ""}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push({ name, email });
  }

  return result;
}

export function parseExternalInviteesField(
  value: unknown,
): CalendarExternalInvitee[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  return normalizeExternalInvitees(value);
}
