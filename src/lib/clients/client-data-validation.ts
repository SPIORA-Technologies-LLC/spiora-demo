import {
  CLIENT_DOCUMENT_STATUSES,
  CLIENT_DOCUMENT_TYPES,
} from "./client-data-types";

export class ClientDataValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClientDataValidationError";
  }
}

const MAX_NOTE_LENGTH = 10_000;
const MAX_FILENAME_LENGTH = 255;
const MAX_DOCUMENT_TYPE_LENGTH = 64;
const MAX_MIME_LENGTH = 128;
const MAX_SIZE_BYTES = 52_428_800; // 50 MB metadata cap

const UNSAFE_FILENAME = /[<>:"/\\|?*\x00-\x1f]/;
const PATH_TRAVERSAL = /\.\.|^\/|\\/;

export function validateNoteContent(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new ClientDataValidationError("Note content is required");
  }
  if (trimmed.length > MAX_NOTE_LENGTH) {
    throw new ClientDataValidationError("Note content is too long");
  }
  return trimmed;
}

export function sanitizeFileName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new ClientDataValidationError("File name is required");
  }
  if (trimmed.length > MAX_FILENAME_LENGTH) {
    throw new ClientDataValidationError("File name is too long");
  }
  if (UNSAFE_FILENAME.test(trimmed) || PATH_TRAVERSAL.test(trimmed)) {
    throw new ClientDataValidationError("Invalid file name");
  }
  return trimmed;
}

export function validateMimeType(mimeType: string): string {
  const trimmed = mimeType.trim().toLowerCase();
  if (!trimmed || trimmed.length > MAX_MIME_LENGTH) {
    throw new ClientDataValidationError("Invalid MIME type");
  }
  if (!/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/.test(trimmed)) {
    throw new ClientDataValidationError("Invalid MIME type format");
  }
  return trimmed;
}

export function validateDocumentType(type: string): string {
  const trimmed = type.trim().toLowerCase();
  if (!trimmed || trimmed.length > MAX_DOCUMENT_TYPE_LENGTH) {
    throw new ClientDataValidationError("Invalid document type");
  }
  if (
    !(CLIENT_DOCUMENT_TYPES as readonly string[]).includes(trimmed) &&
    trimmed !== "other"
  ) {
    throw new ClientDataValidationError("Unknown document type");
  }
  return trimmed;
}

export function validateDocumentStatus(status: string): string {
  const trimmed = status.trim().toLowerCase();
  if (!(CLIENT_DOCUMENT_STATUSES as readonly string[]).includes(trimmed)) {
    throw new ClientDataValidationError("Invalid document status");
  }
  return trimmed;
}

export function validateStoragePath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) return "";
  if (PATH_TRAVERSAL.test(trimmed) || trimmed.includes("://")) {
    throw new ClientDataValidationError("Invalid storage path");
  }
  return trimmed;
}

export function validateSizeBytes(size: unknown): number {
  const value = Number(size ?? 0);
  if (!Number.isFinite(value) || value < 0 || value > MAX_SIZE_BYTES) {
    throw new ClientDataValidationError("Invalid file size");
  }
  return Math.floor(value);
}

export type CreateDocumentMetadataInput = {
  fileName: string;
  originalFileName?: string;
  mimeType?: string;
  sizeBytes?: number;
  documentType?: string;
  status?: string;
  storageProvider?: string;
  storagePath?: string;
};

export function validateCreateDocumentMetadataInput(
  input: CreateDocumentMetadataInput,
): {
  fileName: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  documentType: string;
  status: string;
  storageProvider: string;
  storagePath: string;
} {
  return {
    fileName: sanitizeFileName(input.fileName),
    originalFileName: input.originalFileName
      ? sanitizeFileName(input.originalFileName)
      : sanitizeFileName(input.fileName),
    mimeType: validateMimeType(input.mimeType ?? "application/pdf"),
    sizeBytes: validateSizeBytes(input.sizeBytes),
    documentType: validateDocumentType(input.documentType ?? "other"),
    status: validateDocumentStatus(input.status ?? "uploaded"),
    storageProvider: (input.storageProvider ?? "demo").trim() || "demo",
    storagePath: validateStoragePath(input.storagePath ?? ""),
  };
}

export type UpdateDocumentMetadataInput = {
  fileName?: string;
  documentType?: string;
  status?: string;
};

export function validateUpdateDocumentMetadataInput(
  input: UpdateDocumentMetadataInput,
): UpdateDocumentMetadataInput {
  const out: UpdateDocumentMetadataInput = {};
  if (input.fileName !== undefined) {
    out.fileName = sanitizeFileName(input.fileName);
  }
  if (input.documentType !== undefined) {
    out.documentType = validateDocumentType(input.documentType);
  }
  if (input.status !== undefined) {
    out.status = validateDocumentStatus(input.status);
  }
  if (Object.keys(out).length === 0) {
    throw new ClientDataValidationError("At least one field is required");
  }
  return out;
}
