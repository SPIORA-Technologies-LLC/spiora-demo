import "server-only";

import type { SessionUser } from "@/lib/auth/types";
import { isCrmPostgresPrimary } from "./config";
import type {
  ClientDocumentPublic,
  ClientDocumentsListResult,
} from "./client-data-types";
import {
  canArchiveClientDocument,
  canCreateClientDocument,
  canReadClientDocuments,
  canUpdateClientDocument,
} from "./client-data-permissions";
import {
  ClientDataValidationError,
  validateCreateDocumentMetadataInput,
  validateUpdateDocumentMetadataInput,
  type CreateDocumentMetadataInput,
  type UpdateDocumentMetadataInput,
} from "./client-data-validation";
import * as sbClients from "@/lib/supabase/clients-repo";
import * as sbDocuments from "@/lib/supabase/client-documents-repo";
import {
  CLIENT_DOCUMENT_BUCKET,
  deleteClientDocumentBytes,
  newClientDocumentStoragePath,
  readClientDocumentBytes,
  uploadClientDocumentBytes,
} from "@/lib/clients/client-document-storage";
import { isAllowedCaseEmployeeDocument } from "@/lib/client-portal/case-employee-document-formats";

const CREATE_ID_MAX_ATTEMPTS = 5;

export class ClientDocumentsAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClientDocumentsAccessError";
  }
}

export class ClientDocumentsStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClientDocumentsStorageError";
  }
}

/** Exhausted unique-constraint retries for external_id. */
export class ClientDocumentsConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClientDocumentsConflictError";
  }
}

async function resolveClientContext(externalId: string): Promise<{
  clientUuid: string;
  clientExternalId: string;
} | null> {
  const clientUuid = await sbClients.sbGetClientUuidByExternalId(externalId);
  if (!clientUuid) return null;
  return { clientUuid, clientExternalId: externalId };
}

export async function listClientDocuments(
  clientExternalId: string,
  user: SessionUser,
): Promise<ClientDocumentsListResult> {
  if (!canReadClientDocuments(user)) {
    throw new ClientDocumentsAccessError("Forbidden");
  }

  if (!isCrmPostgresPrimary()) {
    throw new ClientDocumentsStorageError("CRM PostgreSQL is not configured");
  }

  const ctx = await resolveClientContext(clientExternalId);
  if (!ctx) {
    return { items: [], source: "postgresql" };
  }

  try {
    const rows = await sbDocuments.sbListClientDocumentsByUuid(
      ctx.clientUuid,
      ctx.clientExternalId,
    );
    return {
      items: rows.map(sbDocuments.toPublicDocument),
      source: "postgresql",
    };
  } catch (error) {
    console.error("[client-documents-store] list failed", error);
    throw new ClientDocumentsStorageError("Failed to load client documents");
  }
}

export async function createClientDocumentMetadata(
  clientExternalId: string,
  user: SessionUser,
  input: CreateDocumentMetadataInput,
): Promise<ClientDocumentPublic> {
  if (!canCreateClientDocument(user)) {
    throw new ClientDocumentsAccessError("Forbidden");
  }

  if (!isCrmPostgresPrimary()) {
    throw new ClientDocumentsStorageError("CRM PostgreSQL is not configured");
  }

  const ctx = await resolveClientContext(clientExternalId);
  if (!ctx) {
    throw new ClientDocumentsStorageError("Client not found");
  }

  const validated = validateCreateDocumentMetadataInput(input);
  const storagePath =
    validated.storagePath ||
    `demo/clients/${ctx.clientExternalId}/${validated.fileName}`;

  let lastError: unknown;
  for (let attempt = 1; attempt <= CREATE_ID_MAX_ATTEMPTS; attempt += 1) {
    try {
      const externalId = await sbDocuments.sbNextDemoDocumentExternalId();
      const record = await sbDocuments.sbInsertClientDocument({
        clientUuid: ctx.clientUuid,
        clientExternalId: ctx.clientExternalId,
        externalId,
        fileName: validated.fileName,
        originalFileName: validated.originalFileName,
        mimeType: validated.mimeType,
        sizeBytes: validated.sizeBytes,
        documentType: validated.documentType,
        status: validated.status,
        storageProvider: validated.storageProvider,
        storagePath,
        uploadedByUserId: user.id,
        uploadedByName: user.name,
      });
      return sbDocuments.toPublicDocument(record);
    } catch (error) {
      lastError = error;
      if (
        sbDocuments.isDuplicateDocumentExternalIdError(error) &&
        attempt < CREATE_ID_MAX_ATTEMPTS
      ) {
        console.warn(
          `[client-documents-store] external_id conflict, retry ${attempt}/${CREATE_ID_MAX_ATTEMPTS}`,
        );
        continue;
      }
      if (sbDocuments.isDuplicateDocumentExternalIdError(error)) {
        console.error(
          "[client-documents-store] external_id conflict exhausted",
          error,
        );
        throw new ClientDocumentsConflictError(
          "Document identifier conflict after retries",
        );
      }
      console.error("[client-documents-store] create failed", error);
      throw new ClientDocumentsStorageError("Failed to create document metadata");
    }
  }

  console.error("[client-documents-store] create failed", lastError);
  throw new ClientDocumentsStorageError("Failed to create document metadata");
}

export async function updateClientDocumentMetadata(
  clientExternalId: string,
  documentId: string,
  user: SessionUser,
  input: UpdateDocumentMetadataInput,
): Promise<ClientDocumentPublic> {
  if (!canUpdateClientDocument(user)) {
    throw new ClientDocumentsAccessError("Forbidden");
  }

  if (!isCrmPostgresPrimary()) {
    throw new ClientDocumentsStorageError("CRM PostgreSQL is not configured");
  }

  const ctx = await resolveClientContext(clientExternalId);
  if (!ctx) {
    throw new ClientDocumentsStorageError("Client not found");
  }

  const validated = validateUpdateDocumentMetadataInput(input);

  try {
    const updated = await sbDocuments.sbUpdateClientDocument(
      documentId,
      ctx.clientUuid,
      ctx.clientExternalId,
      validated,
    );
    if (!updated) {
      throw new ClientDocumentsStorageError("Document not found");
    }
    return sbDocuments.toPublicDocument(updated);
  } catch (error) {
    if (error instanceof ClientDocumentsStorageError) throw error;
    console.error("[client-documents-store] update failed", error);
    throw new ClientDocumentsStorageError("Failed to update document metadata");
  }
}

export async function uploadClientDocumentFile(
  clientExternalId: string,
  user: SessionUser,
  input: {
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    bytes: Buffer;
    documentType?: string;
  },
): Promise<ClientDocumentPublic> {
  if (!canCreateClientDocument(user)) {
    throw new ClientDocumentsAccessError("Forbidden");
  }

  if (!isCrmPostgresPrimary()) {
    throw new ClientDocumentsStorageError("CRM PostgreSQL is not configured");
  }

  const allowed = isAllowedCaseEmployeeDocument(
    input.fileName,
    input.mimeType,
    input.sizeBytes,
  );
  if (!allowed.ok) {
    throw new ClientDataValidationError(
      allowed.reason === "too_large" ? "File too large" : "Unsupported file type",
    );
  }

  const ctx = await resolveClientContext(clientExternalId);
  if (!ctx) {
    throw new ClientDocumentsStorageError("Client not found");
  }

  const storagePath = newClientDocumentStoragePath(
    ctx.clientExternalId,
    input.fileName,
  );

  let storageProvider: "supabase" | "local";
  try {
    storageProvider = await uploadClientDocumentBytes(
      storagePath,
      input.bytes,
      allowed.mimeType,
    );
  } catch (error) {
    console.error("[client-documents-store] upload failed", error);
    throw new ClientDocumentsStorageError(
      error instanceof Error ? error.message : "Failed to upload document",
    );
  }

  let lastError: unknown;
  for (let attempt = 1; attempt <= CREATE_ID_MAX_ATTEMPTS; attempt += 1) {
    try {
      const externalId = await sbDocuments.sbNextDemoDocumentExternalId();
      const record = await sbDocuments.sbInsertClientDocument({
        clientUuid: ctx.clientUuid,
        clientExternalId: ctx.clientExternalId,
        externalId,
        fileName: input.fileName,
        originalFileName: input.fileName,
        mimeType: allowed.mimeType,
        sizeBytes: input.sizeBytes,
        documentType: input.documentType || "other",
        status: "uploaded",
        storageProvider,
        storageBucket: CLIENT_DOCUMENT_BUCKET,
        storagePath,
        uploadedByUserId: user.id,
        uploadedByName: user.name,
        isDemo: false,
      });
      return sbDocuments.toPublicDocument(record);
    } catch (error) {
      lastError = error;
      if (
        sbDocuments.isDuplicateDocumentExternalIdError(error) &&
        attempt < CREATE_ID_MAX_ATTEMPTS
      ) {
        continue;
      }
      await deleteClientDocumentBytes(storagePath);
      if (sbDocuments.isDuplicateDocumentExternalIdError(error)) {
        throw new ClientDocumentsConflictError(
          "Document identifier conflict after retries",
        );
      }
      console.error("[client-documents-store] create after upload failed", error);
      throw new ClientDocumentsStorageError("Failed to create document metadata");
    }
  }

  await deleteClientDocumentBytes(storagePath);
  console.error("[client-documents-store] create after upload failed", lastError);
  throw new ClientDocumentsStorageError("Failed to create document metadata");
}

export async function getClientDocumentFile(
  clientExternalId: string,
  documentId: string,
  user: SessionUser,
): Promise<{
  fileName: string;
  mimeType: string;
  bytes: Buffer;
} | null> {
  if (!canReadClientDocuments(user)) {
    throw new ClientDocumentsAccessError("Forbidden");
  }

  if (!isCrmPostgresPrimary()) {
    throw new ClientDocumentsStorageError("CRM PostgreSQL is not configured");
  }

  const ctx = await resolveClientContext(clientExternalId);
  if (!ctx) return null;

  const ref = await sbDocuments.sbGetClientDocumentStorageRef(
    documentId,
    ctx.clientUuid,
  );
  if (!ref || !ref.storagePath) return null;
  if (ref.storageProvider === "demo") return null;

  const bytes = await readClientDocumentBytes(
    ref.storageBucket || CLIENT_DOCUMENT_BUCKET,
    ref.storagePath,
  );
  if (!bytes) return null;

  return {
    fileName: ref.fileName,
    mimeType: ref.mimeType || "application/octet-stream",
    bytes,
  };
}

export async function archiveClientDocumentMetadata(
  clientExternalId: string,
  documentId: string,
  user: SessionUser,
): Promise<void> {
  if (!canArchiveClientDocument(user)) {
    throw new ClientDocumentsAccessError("Forbidden");
  }

  if (!isCrmPostgresPrimary()) {
    throw new ClientDocumentsStorageError("CRM PostgreSQL is not configured");
  }

  const ctx = await resolveClientContext(clientExternalId);
  if (!ctx) {
    throw new ClientDocumentsStorageError("Client not found");
  }

  try {
    const ok = await sbDocuments.sbArchiveClientDocument(
      documentId,
      ctx.clientUuid,
    );
    if (!ok) {
      throw new ClientDocumentsStorageError("Document not found");
    }
  } catch (error) {
    if (error instanceof ClientDocumentsStorageError) throw error;
    console.error("[client-documents-store] archive failed", error);
    throw new ClientDocumentsStorageError("Failed to archive document metadata");
  }
}

export { ClientDataValidationError };
