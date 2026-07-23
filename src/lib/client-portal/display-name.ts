/**
 * Resolve a short first name for client portal greetings.
 * Prefer auth metadata (set at registration), then questionnaire answer.
 */
export function resolveClientFirstName(input: {
  authFirstName?: string | null;
  questionnaireFirstName?: unknown;
}): string | null {
  const fromAuth = normalizeName(input.authFirstName);
  if (fromAuth) return fromAuth;
  return normalizeName(input.questionnaireFirstName);
}

export function normalizeName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed || trimmed.length > 80) return null;
  return trimmed;
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
