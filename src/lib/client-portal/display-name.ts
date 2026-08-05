/**
 * Resolve a short first name for client portal greetings.
 * Prefer auth metadata (set at registration), then questionnaire answer.
 * Always returns a single given name (no surname), even if a full name was stored.
 */
export function resolveClientFirstName(input: {
  authFirstName?: string | null;
  questionnaireFirstName?: unknown;
}): string | null {
  const fromAuth = toGivenName(input.authFirstName);
  if (fromAuth) return fromAuth;
  return toGivenName(input.questionnaireFirstName);
}

export function normalizeName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed || trimmed.length > 80) return null;
  return trimmed;
}

/** First whitespace-separated token — for greetings like «Добро пожаловать, Хана!» */
export function toGivenName(value: unknown): string | null {
  const normalized = normalizeName(value);
  if (!normalized) return null;
  const given = normalized.split(" ")[0] ?? "";
  return given || null;
}

export function firstNameFromAuthMetadata(
  metadata: Record<string, unknown> | null | undefined,
): string | null {
  if (!metadata) return null;
  return (
    normalizeName(metadata.first_name) ??
    normalizeName(metadata.firstName) ??
    normalizeName(metadata.given_name) ??
    null
  );
}

/**
 * Prefer questionnaire/case given name over the invite-time label.
 * Staff often put a surname into the invite "name" field; after submit the case is authoritative.
 */
export function resolveInvitationDisplayFirstName(input: {
  invitationFirstName: string | null | undefined;
  caseFirstName?: string | null | undefined;
}): string | null {
  return (
    toGivenName(input.caseFirstName) ?? toGivenName(input.invitationFirstName)
  );
}
