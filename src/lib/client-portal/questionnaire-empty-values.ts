/**
 * Canonical empty-value rules for questionnaire answers (PR #31).
 *
 * - Cleared scalar text/email/phone/number/date/country/select/radio → omitted key or null
 * - Cleared boolean false → false (not empty)
 * - Cleared boolean when optional → null
 * - Cleared multiselect/checkbox → []
 * - null, undefined, "" treated as empty for scalars
 * - [] treated as empty for multiselect
 * - Server rejects unknown keys and display-only keys
 */

import type { QuestionType } from "./questionnaire-types";

export function isEmptyAnswer(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string" && value.trim() === "") return true;
  if (Array.isArray(value) && value.length === 0) return true;
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    const rec = value as Record<string, unknown>;
    if ("fileName" in rec || "mimeType" in rec || "sizeBytes" in rec || "id" in rec) {
      return (
        typeof rec.id !== "string" ||
        rec.id.length === 0 ||
        typeof rec.fileName !== "string" ||
        rec.fileName.length === 0
      );
    }
  }
  return false;
}

export function canonicalEmptyValue(type: QuestionType): unknown {
  switch (type) {
    case "multiselect":
    case "checkbox":
      return [];
    case "boolean":
      return false;
    default:
      return null;
  }
}

export function normalizeScalarString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function answersJsonByteSize(answers: Record<string, unknown>): number {
  return new TextEncoder().encode(JSON.stringify(answers)).length;
}
