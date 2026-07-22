/**
 * Allowed formats for employee-uploaded case documents.
 * Extends questionnaire limits with ZIP per PR #32.
 */

import {
  ALLOWED_QUESTIONNAIRE_ATTACHMENT_TYPES,
  MAX_QUESTIONNAIRE_ATTACHMENT_BYTES,
  QUESTIONNAIRE_ATTACHMENT_EXTENSIONS,
  contentTypeFromExt,
  extFromFileName,
  normalizeQuestionnaireAttachmentContentType,
} from "./questionnaire-attachment-formats";

export const MAX_CASE_EMPLOYEE_DOCUMENT_BYTES = MAX_QUESTIONNAIRE_ATTACHMENT_BYTES;

export const CASE_EMPLOYEE_DOCUMENT_EXTENSIONS = [
  ...QUESTIONNAIRE_ATTACHMENT_EXTENSIONS,
  "zip",
] as const;

const EXTRA_TYPES = new Set(["application/zip", "application/x-zip-compressed"]);

export function isAllowedCaseEmployeeDocument(
  fileName: string,
  contentType: string,
  sizeBytes: number,
): { ok: true; mimeType: string } | { ok: false; reason: "too_large" | "unsupported_type" } {
  if (sizeBytes <= 0 || sizeBytes > MAX_CASE_EMPLOYEE_DOCUMENT_BYTES) {
    return { ok: false, reason: "too_large" };
  }

  const base = contentType.toLowerCase().split(";")[0]?.trim() ?? "";
  const ext = extFromFileName(fileName);

  if (EXTRA_TYPES.has(base) || ext === "zip") {
    return { ok: true, mimeType: "application/zip" };
  }

  const mimeType = normalizeQuestionnaireAttachmentContentType(contentType, fileName);
  if (mimeType) return { ok: true, mimeType };

  if (
    ext &&
    (CASE_EMPLOYEE_DOCUMENT_EXTENSIONS as readonly string[]).includes(ext) &&
    (ALLOWED_QUESTIONNAIRE_ATTACHMENT_TYPES.has(contentTypeFromExt(ext)) ||
      EXTRA_TYPES.has(contentTypeFromExt(ext)))
  ) {
    return { ok: true, mimeType: contentTypeFromExt(ext) };
  }

  return { ok: false, reason: "unsupported_type" };
}
