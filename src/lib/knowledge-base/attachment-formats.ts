/** Phase 1 KB attachment allowlist: PDF + PNG/JPEG/WebP only. */

export const KB_ATTACHMENT_BUCKET = "knowledge-base";

export const MAX_KB_PDF_BYTES = 25 * 1024 * 1024;
export const MAX_KB_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_KB_ATTACHMENTS_PER_ARTICLE = 10;

export const KB_ATTACHMENT_EXTENSIONS = ["pdf", "png", "jpg", "jpeg", "webp"] as const;

export const ALLOWED_KB_ATTACHMENT_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

const BLOCKED_EXTENSIONS = new Set([
  "svg",
  "svgz",
  "exe",
  "bat",
  "cmd",
  "com",
  "msi",
  "scr",
  "ps1",
  "sh",
  "bash",
  "js",
  "mjs",
  "cjs",
  "html",
  "htm",
  "xhtml",
  "php",
  "asp",
  "aspx",
  "dll",
  "so",
  "wasm",
]);

const EXT_TO_MIME: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

export type KbAttachmentKind = "pdf" | "image";

export function extFromFileName(fileName: string): string {
  const base = fileName.trim().split(/[/\\]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  if (dot < 0) return "";
  return base.slice(dot + 1).toLowerCase();
}

export function sanitizeOriginalFileName(fileName: string): string {
  const base = fileName.trim().split(/[/\\]/).pop() ?? "file";
  return base.replace(/[^\w.\- ()[\]]+/g, "_").slice(0, 200) || "file";
}

export function contentTypeFromExt(ext: string): string {
  return EXT_TO_MIME[ext.toLowerCase()] ?? "";
}

export function normalizeKbAttachmentContentType(
  contentType: string,
  fileName: string,
): string {
  const base = contentType.toLowerCase().split(";")[0]?.trim() ?? "";
  if (base === "image/jpg") return "image/jpeg";
  if (ALLOWED_KB_ATTACHMENT_TYPES.has(base)) return base;

  const ext = extFromFileName(fileName);
  if (ext && EXT_TO_MIME[ext] && ALLOWED_KB_ATTACHMENT_TYPES.has(EXT_TO_MIME[ext]!)) {
    return EXT_TO_MIME[ext]!;
  }
  return "";
}

export function isBlockedExtension(fileName: string): boolean {
  return BLOCKED_EXTENSIONS.has(extFromFileName(fileName));
}

export function maxBytesForMime(mime: string): number {
  return mime === "application/pdf" ? MAX_KB_PDF_BYTES : MAX_KB_IMAGE_BYTES;
}

export function kindForMime(mime: string): KbAttachmentKind | null {
  if (mime === "application/pdf") return "pdf";
  if (mime.startsWith("image/")) return "image";
  return null;
}

/** Magic-byte sniff; rejects SVG/HTML disguised as images. */
export function sniffKbAttachmentMime(buffer: Buffer): string {
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString("ascii") === "%PDF-") {
    return "application/pdf";
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "image/png";
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  const head = buffer.subarray(0, Math.min(256, buffer.length)).toString("utf8").toLowerCase();
  if (head.includes("<svg") || head.includes("<?xml") || head.includes("<!doctype html")) {
    return "";
  }
  return "";
}

export type KbAttachmentValidationOk = {
  ok: true;
  mimeType: string;
  fileName: string;
  kind: KbAttachmentKind;
  maxBytes: number;
};

export type KbAttachmentValidationErr = {
  ok: false;
  error:
    | "unsupported_type"
    | "blocked_type"
    | "file_too_large"
    | "empty_file"
    | "mime_mismatch";
};

export function validateKbAttachmentFile(input: {
  fileName: string;
  contentType: string;
  size: number;
  buffer: Buffer;
}): KbAttachmentValidationOk | KbAttachmentValidationErr {
  if (input.size <= 0 || input.buffer.length <= 0) {
    return { ok: false, error: "empty_file" };
  }
  if (isBlockedExtension(input.fileName)) {
    return { ok: false, error: "blocked_type" };
  }

  const declared = normalizeKbAttachmentContentType(input.contentType, input.fileName);
  const sniffed = sniffKbAttachmentMime(input.buffer);
  if (!sniffed || !ALLOWED_KB_ATTACHMENT_TYPES.has(sniffed)) {
    return { ok: false, error: "unsupported_type" };
  }
  if (declared && declared !== sniffed) {
    return { ok: false, error: "mime_mismatch" };
  }

  const maxBytes = maxBytesForMime(sniffed);
  if (input.size > maxBytes || input.buffer.length > maxBytes) {
    return { ok: false, error: "file_too_large" };
  }

  const kind = kindForMime(sniffed);
  if (!kind) return { ok: false, error: "unsupported_type" };

  return {
    ok: true,
    mimeType: sniffed,
    fileName: sanitizeOriginalFileName(input.fileName),
    kind,
    maxBytes,
  };
}

export function buildKbStoragePath(attachmentId: string, mimeType: string): string {
  const ext =
    mimeType === "application/pdf"
      ? "pdf"
      : mimeType === "image/png"
        ? "png"
        : mimeType === "image/webp"
          ? "webp"
          : "jpg";
  // Path is UUID + allowlisted ext only — never user filename (traversal-safe).
  return `${attachmentId}.${ext}`;
}

export function getKbAttachmentUrl(slug: string, attachmentId: string): string {
  return `/api/knowledge-base/${encodeURIComponent(slug)}/attachments/${encodeURIComponent(attachmentId)}`;
}

export function canPreviewKbAttachmentInline(mimeType: string): boolean {
  return mimeType === "application/pdf" || mimeType.startsWith("image/");
}

export function formatKbFileSize(bytes: number, locale: "en" | "ru" = "en"): string {
  const units =
    locale === "ru"
      ? { b: "Б", kb: "КБ", mb: "МБ" }
      : { b: "B", kb: "KB", mb: "MB" };
  if (bytes < 1024) return `${bytes} ${units.b}`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} ${units.kb}`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} ${units.mb}`;
}

export const KB_ATTACHMENT_ACCEPT = KB_ATTACHMENT_EXTENSIONS.map((ext) => `.${ext}`).join(",");

export const KB_PDF_ACCEPT = ".pdf,application/pdf";
export const KB_IMAGE_ACCEPT = ".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp";
