/** Pure helpers for demo document external_id generation (DOC-DEMO-*). */

export const DEMO_DOCUMENT_EXTERNAL_ID_PREFIX = "DOC-DEMO-";
export const DEMO_DOCUMENT_EXTERNAL_ID_PAD = 4;

const DEMO_DOCUMENT_ID_RE = /^DOC-DEMO-(\d+)$/i;

export function parseDemoDocumentSequence(externalId: string): number | null {
  const match = externalId.trim().match(DEMO_DOCUMENT_ID_RE);
  if (!match) return null;
  const value = Number.parseInt(match[1], 10);
  return Number.isFinite(value) ? value : null;
}

export function formatDemoDocumentExternalId(
  sequence: number,
  pad: number = DEMO_DOCUMENT_EXTERNAL_ID_PAD,
): string {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new Error("Invalid document sequence");
  }
  const width = Math.max(pad, String(sequence).length);
  return `${DEMO_DOCUMENT_EXTERNAL_ID_PREFIX}${String(sequence).padStart(width, "0")}`;
}

/**
 * Computes next DOC-DEMO-* id from existing ids (active + archived).
 * Uses numeric max — never lexical string sort.
 */
export function computeNextDemoDocumentExternalId(
  existingExternalIds: readonly string[],
  pad: number = DEMO_DOCUMENT_EXTERNAL_ID_PAD,
): string {
  let max = 0;
  for (const id of existingExternalIds) {
    const n = parseDemoDocumentSequence(id);
    if (n !== null && n > max) max = n;
  }
  return formatDemoDocumentExternalId(max + 1, pad);
}

export function isDuplicateDocumentExternalIdError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String((error as { code?: unknown }).code) : "";
  if (code !== "23505") return false;
  const message =
    "message" in error ? String((error as { message?: unknown }).message) : "";
  const details =
    "details" in error ? String((error as { details?: unknown }).details) : "";
  const haystack = `${message} ${details}`.toLowerCase();
  return (
    haystack.includes("external_id") ||
    haystack.includes("client_documents_external_id")
  );
}
