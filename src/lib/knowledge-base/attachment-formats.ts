/** KB attachment allowlist: PDF, images, video, audio. */

export const KB_ATTACHMENT_BUCKET = "knowledge-base";

export const MAX_KB_PDF_BYTES = 10 * 1024 * 1024;
export const MAX_KB_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_KB_AUDIO_BYTES = 10 * 1024 * 1024;
export const MAX_KB_VIDEO_BYTES = 50 * 1024 * 1024;
export const MAX_KB_ATTACHMENTS_PER_ARTICLE = 10;
/** In-browser audio recording hard stop (10 minutes). */
export const MAX_KB_AUDIO_RECORD_MS = 10 * 60 * 1000;

export const KB_ATTACHMENT_EXTENSIONS = [
  "pdf",
  "png",
  "jpg",
  "jpeg",
  "webp",
  "mp4",
  "webm",
  "ogg",
  "mp3",
  "m4a",
] as const;

export const ALLOWED_KB_ATTACHMENT_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "video/mp4",
  "video/webm",
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/mpeg",
  "audio/x-m4a",
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
  mp4: "video/mp4",
  webm: "video/webm",
  ogg: "audio/ogg",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
};

type KbContainer =
  | "pdf"
  | "png"
  | "jpeg"
  | "webp"
  | "ebml"
  | "ogg"
  | "isom"
  | "mpeg";

const MIMES_BY_CONTAINER: Record<KbContainer, readonly string[]> = {
  pdf: ["application/pdf"],
  png: ["image/png"],
  jpeg: ["image/jpeg"],
  webp: ["image/webp"],
  ebml: ["video/webm", "audio/webm"],
  ogg: ["audio/ogg"],
  isom: ["video/mp4", "audio/mp4", "audio/x-m4a"],
  mpeg: ["audio/mpeg"],
};

export type KbAttachmentKind = "pdf" | "image" | "video" | "audio";

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
  if (base === "audio/m4a") return "audio/mp4";
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
  if (mime === "application/pdf") return MAX_KB_PDF_BYTES;
  if (mime.startsWith("image/")) return MAX_KB_IMAGE_BYTES;
  if (mime.startsWith("video/")) return MAX_KB_VIDEO_BYTES;
  if (mime.startsWith("audio/")) return MAX_KB_AUDIO_BYTES;
  return 0;
}

export function kindForMime(mime: string): KbAttachmentKind | null {
  if (mime === "application/pdf") return "pdf";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return null;
}

function readAscii(buffer: Buffer, start: number, length: number): string {
  return buffer.subarray(start, start + length).toString("ascii");
}

function sniffKbContainer(buffer: Buffer): KbContainer | null {
  if (buffer.length >= 5 && readAscii(buffer, 0, 5) === "%PDF-") {
    return "pdf";
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "png";
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "jpeg";
  }
  if (
    buffer.length >= 12 &&
    readAscii(buffer, 0, 4) === "RIFF" &&
    readAscii(buffer, 8, 4) === "WEBP"
  ) {
    return "webp";
  }
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x1a &&
    buffer[1] === 0x45 &&
    buffer[2] === 0xdf &&
    buffer[3] === 0xa3
  ) {
    return "ebml";
  }
  if (buffer.length >= 4 && readAscii(buffer, 0, 4) === "OggS") {
    return "ogg";
  }
  if (buffer.length >= 12 && readAscii(buffer, 4, 4) === "ftyp") {
    return "isom";
  }
  if (buffer.length >= 3 && readAscii(buffer, 0, 3) === "ID3") {
    return "mpeg";
  }
  if (
    buffer.length >= 2 &&
    buffer[0] === 0xff &&
    (buffer[1]! & 0xe0) === 0xe0
  ) {
    return "mpeg";
  }

  const head = buffer.subarray(0, Math.min(256, buffer.length)).toString("utf8").toLowerCase();
  if (head.includes("<svg") || head.includes("<?xml") || head.includes("<!doctype html")) {
    return null;
  }
  return null;
}

/** Magic-byte sniff; returns canonical MIME when unambiguous, else "". */
export function sniffKbAttachmentMime(buffer: Buffer): string {
  const container = sniffKbContainer(buffer);
  if (!container) return "";
  const only = MIMES_BY_CONTAINER[container];
  return only.length === 1 ? only[0]! : "";
}

function defaultMimeForContainer(container: KbContainer, fileName: string): string {
  const ext = extFromFileName(fileName);
  const fromExt = ext ? EXT_TO_MIME[ext] : "";
  if (fromExt && MIMES_BY_CONTAINER[container].includes(fromExt)) {
    return fromExt;
  }
  switch (container) {
    case "ebml":
      return "audio/webm";
    case "isom":
      return ext === "m4a" ? "audio/mp4" : "video/mp4";
    case "ogg":
      return "audio/ogg";
    case "mpeg":
      return "audio/mpeg";
    default:
      return MIMES_BY_CONTAINER[container][0]!;
  }
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

  const container = sniffKbContainer(input.buffer);
  if (!container) {
    return { ok: false, error: "unsupported_type" };
  }

  const allowed = MIMES_BY_CONTAINER[container];
  const declared = normalizeKbAttachmentContentType(input.contentType, input.fileName);

  let mimeType = "";
  if (declared) {
    if (!allowed.includes(declared)) {
      return { ok: false, error: "mime_mismatch" };
    }
    mimeType = declared;
  } else {
    mimeType = defaultMimeForContainer(container, input.fileName);
  }

  if (!ALLOWED_KB_ATTACHMENT_TYPES.has(mimeType)) {
    return { ok: false, error: "unsupported_type" };
  }

  const maxBytes = maxBytesForMime(mimeType);
  if (input.size > maxBytes || input.buffer.length > maxBytes) {
    return { ok: false, error: "file_too_large" };
  }

  const kind = kindForMime(mimeType);
  if (!kind) return { ok: false, error: "unsupported_type" };

  return {
    ok: true,
    mimeType,
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
          : mimeType === "image/jpeg"
            ? "jpg"
            : mimeType === "video/mp4"
              ? "mp4"
              : mimeType === "video/webm" || mimeType === "audio/webm"
                ? "webm"
                : mimeType === "audio/ogg"
                  ? "ogg"
                  : mimeType === "audio/mpeg"
                    ? "mp3"
                    : mimeType === "audio/mp4" || mimeType === "audio/x-m4a"
                      ? "m4a"
                      : "bin";
  // Path is UUID + allowlisted ext only — never user filename (traversal-safe).
  return `${attachmentId}.${ext}`;
}

export function getKbAttachmentUrl(slug: string, attachmentId: string): string {
  return `/api/knowledge-base/${encodeURIComponent(slug)}/attachments/${encodeURIComponent(attachmentId)}`;
}

export function canPreviewKbAttachmentInline(mimeType: string): boolean {
  return (
    mimeType === "application/pdf" ||
    mimeType.startsWith("image/") ||
    mimeType.startsWith("video/") ||
    mimeType.startsWith("audio/")
  );
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
export const KB_VIDEO_ACCEPT = ".mp4,.webm,video/mp4,video/webm";
export const KB_AUDIO_ACCEPT =
  ".webm,.ogg,.mp3,.m4a,.mp4,audio/webm,audio/ogg,audio/mpeg,audio/mp4,audio/x-m4a";

export const KB_STORAGE_PATH_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|png|jpe?g|webp|mp4|webm|ogg|mp3|m4a)$/i;
