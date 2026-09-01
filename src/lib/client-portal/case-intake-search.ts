/** Shared tokenization and matching for intake case search (CRM + AI). */

export function splitIntakeSearchTokens(search: string): string[] {
  return search
    .toLowerCase()
    .replace(/ё/g, "е")
    .split(/[^\p{L}\p{N}]+/u)
    .map((token) => token.replace(/[%_]/g, "").trim())
    .filter((token) => token.length >= 2);
}

export type IntakeSearchRecord = {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  serviceType?: string | null;
  assignedName?: string | null;
  currentStatus?: string | null;
};

export function intakeRecordSearchHay(record: IntakeSearchRecord): string {
  return [
    record.firstName,
    record.lastName,
    record.email,
    record.serviceType,
    record.assignedName,
    record.currentStatus,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/ё/g, "е");
}

export function matchesIntakeSearch(hay: string, tokens: string[]): boolean {
  if (tokens.length === 0) return true;
  return tokens.every((token) => hay.includes(token));
}

export function escapeIlikePattern(value: string): string {
  return `%${value.replace(/[%_]/g, "")}%`;
}

/** PostgREST `.or()` filter for first/last name permutations (two tokens). */
export function intakeTwoTokenNameOrFilter(first: string, second: string): string {
  const p0 = escapeIlikePattern(first);
  const p1 = escapeIlikePattern(second);
  return `and(first_name.ilike.${p0},last_name.ilike.${p1}),and(first_name.ilike.${p1},last_name.ilike.${p0})`;
}

export function intakeSingleTokenOrFilter(token: string): string {
  const pattern = escapeIlikePattern(token);
  return `first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern},service_type.ilike.${pattern}`;
}
