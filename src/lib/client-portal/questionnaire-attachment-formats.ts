/**
 * Allowed formats and size limits for questionnaire document uploads.
 */

export const MAX_QUESTIONNAIRE_ATTACHMENT_BYTES = 15 * 1024 * 1024;

export const QUESTIONNAIRE_ATTACHMENT_EXTENSIONS = [
  "pdf",
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "heic",
  "doc",
  "docx",
  "xls",
  "xlsx",
] as const;

export const ALLOWED_QUESTIONNAIRE_ATTACHMENT_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const EXT_TO_MIME: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export function extFromFileName(fileName: string): string {
  const base = fileName.trim().split(/[/\\]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  if (dot < 0) return "";
  return base.slice(dot + 1).toLowerCase();
}

export function contentTypeFromExt(ext: string): string {
  return EXT_TO_MIME[ext.toLowerCase()] ?? "application/octet-stream";
}

export function normalizeQuestionnaireAttachmentContentType(
  contentType: string,
  fileName: string,
): string | null {
  const base = contentType.toLowerCase().split(";")[0]?.trim() ?? "";
  if (ALLOWED_QUESTIONNAIRE_ATTACHMENT_TYPES.has(base)) return base;

  const ext = extFromFileName(fileName);
  if (ext && EXT_TO_MIME[ext] && ALLOWED_QUESTIONNAIRE_ATTACHMENT_TYPES.has(EXT_TO_MIME[ext]!)) {
    return EXT_TO_MIME[ext]!;
  }
  return null;
}

export function isAllowedQuestionnaireAttachment(
  fileName: string,
  contentType: string,
  sizeBytes: number,
): { ok: true; mimeType: string } | { ok: false; reason: "too_large" | "unsupported_type" } {
  if (sizeBytes <= 0 || sizeBytes > MAX_QUESTIONNAIRE_ATTACHMENT_BYTES) {
    return { ok: false, reason: "too_large" };
  }
  const mimeType = normalizeQuestionnaireAttachmentContentType(contentType, fileName);
  if (!mimeType) return { ok: false, reason: "unsupported_type" };
  const ext = extFromFileName(fileName);
  if (
    ext &&
    !(QUESTIONNAIRE_ATTACHMENT_EXTENSIONS as readonly string[]).includes(ext) &&
    !ALLOWED_QUESTIONNAIRE_ATTACHMENT_TYPES.has(mimeType)
  ) {
    return { ok: false, reason: "unsupported_type" };
  }
  return { ok: true, mimeType };
}

export function isQuestionnaireFileAnswer(
  value: unknown,
): value is { id: string; fileName: string; mimeType: string; sizeBytes: number } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const rec = value as Record<string, unknown>;
  return (
    typeof rec.id === "string" &&
    rec.id.length > 0 &&
    typeof rec.fileName === "string" &&
    rec.fileName.length > 0 &&
    typeof rec.mimeType === "string" &&
    typeof rec.sizeBytes === "number" &&
    Number.isFinite(rec.sizeBytes) &&
    rec.sizeBytes >= 0
  );
}
