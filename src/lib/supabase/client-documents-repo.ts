import "server-only";

import { getSupabaseAdmin } from "./server";
import type {
  ClientDocumentPublic,
  ClientDocumentRecord,
} from "@/lib/clients/client-data-types";
import {
  computeNextDemoDocumentExternalId,
  isDuplicateDocumentExternalIdError,
} from "@/lib/clients/document-external-id";

export { isDuplicateDocumentExternalIdError };

type DocumentRow = {
  id: string;
  client_uuid: string;
  external_id: string;
  file_name: string;
  original_file_name: string;
  mime_type: string;
  size_bytes: number;
  document_type: string;
  status: string;
  storage_provider: string;
  storage_bucket: string;
  storage_path: string;
  uploaded_by_user_id: string | null;
  uploaded_by_name: string;
  uploaded_at: string;
  updated_at: string;
  archived_at: string | null;
  is_demo: boolean;
  metadata: Record<string, unknown>;
};

function storageState(provider: string): ClientDocumentPublic["storageState"] {
  if (provider === "supabase") return "supabase";
  if (provider === "demo") return "demo";
  return "pending";
}

function mapDocument(row: DocumentRow, clientExternalId: string): ClientDocumentRecord {
  return {
    id: row.id,
    clientId: clientExternalId,
    externalId: row.external_id,
    name: row.file_name,
    originalFileName: row.original_file_name || row.file_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    documentType: row.document_type,
    status: row.status,
    storageProvider: row.storage_provider,
    storageState: storageState(row.storage_provider),
    uploadedByName: row.uploaded_by_name,
    uploadedAt: row.uploaded_at,
    updatedAt: row.updated_at,
  };
}

export function toPublicDocument(doc: ClientDocumentRecord): ClientDocumentPublic {
  return {
    id: doc.id,
    clientId: doc.clientId,
    externalId: doc.externalId,
    name: doc.name,
    originalFileName: doc.originalFileName,
    mimeType: doc.mimeType,
    sizeBytes: doc.sizeBytes,
    documentType: doc.documentType,
    status: doc.status,
    storageState: doc.storageState,
    uploadedByName: doc.uploadedByName,
    uploadedAt: doc.uploadedAt,
    updatedAt: doc.updatedAt,
  };
}

export async function sbListClientDocumentsByUuid(
  clientUuid: string,
  clientExternalId: string,
): Promise<ClientDocumentRecord[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("client_documents")
    .select("*")
    .eq("client_uuid", clientUuid)
    .is("archived_at", null)
    .order("uploaded_at", { ascending: false });

  if (error) throw error;
  return ((data ?? []) as DocumentRow[]).map((row) =>
    mapDocument(row, clientExternalId),
  );
}

export async function sbGetClientDocumentById(
  documentId: string,
  clientUuid: string,
  clientExternalId: string,
): Promise<ClientDocumentRecord | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("client_documents")
    .select("*")
    .eq("id", documentId)
    .eq("client_uuid", clientUuid)
    .is("archived_at", null)
    .maybeSingle();

  if (error) throw error;
  return data ? mapDocument(data as DocumentRow, clientExternalId) : null;
}

export async function sbInsertClientDocument(input: {
  clientUuid: string;
  clientExternalId: string;
  externalId: string;
  fileName: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  documentType: string;
  status: string;
  storageProvider: string;
  storageBucket?: string;
  storagePath: string;
  uploadedByUserId: string;
  uploadedByName: string;
  isDemo?: boolean;
  metadata?: Record<string, unknown>;
}): Promise<ClientDocumentRecord> {
  const now = new Date().toISOString();
  const { data, error } = await getSupabaseAdmin()
    .from("client_documents")
    .insert({
      client_uuid: input.clientUuid,
      external_id: input.externalId,
      file_name: input.fileName,
      original_file_name: input.originalFileName,
      mime_type: input.mimeType,
      size_bytes: input.sizeBytes,
      document_type: input.documentType,
      status: input.status,
      storage_provider: input.storageProvider,
      storage_bucket: input.storageBucket ?? "",
      storage_path: input.storagePath,
      uploaded_by_user_id: input.uploadedByUserId,
      uploaded_by_name: input.uploadedByName,
      uploaded_at: now,
      updated_at: now,
      is_demo: input.isDemo ?? true,
      metadata: input.metadata ?? {},
    })
    .select("*")
    .single();

  if (error) throw error;
  return mapDocument(data as DocumentRow, input.clientExternalId);
}

export async function sbUpdateClientDocument(
  documentId: string,
  clientUuid: string,
  clientExternalId: string,
  patch: {
    fileName?: string;
    documentType?: string;
    status?: string;
  },
): Promise<ClientDocumentRecord | null> {
  const payload: Record<string, string> = {
    updated_at: new Date().toISOString(),
  };
  if (patch.fileName !== undefined) payload.file_name = patch.fileName;
  if (patch.documentType !== undefined) payload.document_type = patch.documentType;
  if (patch.status !== undefined) payload.status = patch.status;

  const { data, error } = await getSupabaseAdmin()
    .from("client_documents")
    .update(payload)
    .eq("id", documentId)
    .eq("client_uuid", clientUuid)
    .is("archived_at", null)
    .select("*")
    .maybeSingle();

  if (error) throw error;
  return data ? mapDocument(data as DocumentRow, clientExternalId) : null;
}

export async function sbArchiveClientDocument(
  documentId: string,
  clientUuid: string,
): Promise<boolean> {
  const now = new Date().toISOString();
  // Returning rows — PostgREST `count` is null unless count option is set.
  const { data, error } = await getSupabaseAdmin()
    .from("client_documents")
    .update({ archived_at: now, updated_at: now })
    .eq("id", documentId)
    .eq("client_uuid", clientUuid)
    .is("archived_at", null)
    .select("id");

  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

/**
 * Next DOC-DEMO-* by numeric max of ALL matching rows (including archived).
 * Must not use lexical ORDER BY external_id.
 */
export async function sbNextDemoDocumentExternalId(): Promise<string> {
  const { data, error } = await getSupabaseAdmin()
    .from("client_documents")
    .select("external_id")
    .like("external_id", "DOC-DEMO-%");

  if (error) throw error;
  const ids = ((data ?? []) as { external_id: string }[]).map(
    (row) => row.external_id,
  );
  return computeNextDemoDocumentExternalId(ids);
}
