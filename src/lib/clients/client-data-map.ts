import type { ClientDocumentPublic } from "./client-data-types";
import type { ClientDocument, ClientNote } from "@/lib/google-sheets/types";
import type { ClientNoteRecord } from "./client-data-types";

export function mapNoteRecordToClientNote(note: ClientNoteRecord): ClientNote {
  return {
    id: note.id,
    clientId: note.clientId,
    author: note.author,
    text: note.text,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  };
}

export function mapDocumentPublicToClientDocument(
  doc: ClientDocumentPublic,
): ClientDocument {
  return {
    id: doc.id,
    clientId: doc.clientId,
    name: doc.name,
    uploadedAt: doc.uploadedAt,
    category: doc.documentType,
    externalId: doc.externalId,
    documentType: doc.documentType,
    status: doc.status,
    mimeType: doc.mimeType,
    sizeBytes: doc.sizeBytes,
    uploadedByName: doc.uploadedByName,
    storageState: doc.storageState,
    updatedAt: doc.updatedAt,
  };
}
