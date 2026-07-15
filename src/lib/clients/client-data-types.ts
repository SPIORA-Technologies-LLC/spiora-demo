import "server-only";

export const CLIENT_DOCUMENT_TYPES = [
  "passport_copy",
  "application_form",
  "employment_contract",
  "proof_of_address",
  "residence_permit",
  "client_questionnaire",
  "other",
] as const;

export type ClientDocumentType = (typeof CLIENT_DOCUMENT_TYPES)[number];

export const CLIENT_DOCUMENT_STATUSES = [
  "uploaded",
  "under_review",
  "approved",
  "missing",
  "expired",
] as const;

export type ClientDocumentStatus = (typeof CLIENT_DOCUMENT_STATUSES)[number];

export type ClientNoteRecord = {
  id: string;
  clientId: string;
  author: string;
  authorUserId?: string;
  text: string;
  createdAt: string;
  updatedAt?: string;
};

export type ClientDocumentRecord = {
  id: string;
  clientId: string;
  externalId: string;
  name: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  documentType: ClientDocumentType | string;
  status: ClientDocumentStatus | string;
  storageProvider: string;
  storageState: "demo" | "supabase" | "pending";
  uploadedByName: string;
  uploadedAt: string;
  updatedAt?: string;
};

/** API-safe document — no storage_path, bucket, or internal UUID exposure. */
export type ClientDocumentPublic = Omit<
  ClientDocumentRecord,
  "storageProvider"
> & {
  storageState: "demo" | "supabase" | "pending";
};

export type ClientNotesListResult = {
  items: ClientNoteRecord[];
  source: "postgresql" | "legacy";
};

export type ClientDocumentsListResult = {
  items: ClientDocumentPublic[];
  source: "postgresql" | "legacy";
};
