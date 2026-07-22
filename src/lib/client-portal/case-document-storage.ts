import "server-only";

import { extFromFileName } from "./questionnaire-attachment-formats";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { isProductionLikeRuntime } from "./case-store";

/**
 * Private case/questionnaire attachment bucket.
 * Reuses task-attachments with a dedicated prefix for case employee uploads;
 * questionnaire files keep questionnaire/ prefix (same private bucket).
 */
export const CASE_DOCUMENT_BUCKET = "task-attachments";
export const CASE_DOCUMENT_PREFIX = "cases";

function safeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80) || "x";
}

export function questionnaireAttachmentStoragePath(
  invitationId: string,
  attachmentId: string,
  fileName: string,
): string {
  const ext = extFromFileName(fileName) || "bin";
  return `questionnaire/${safeSegment(invitationId)}/${attachmentId}.${ext}`;
}

export async function uploadCaseEmployeeDocumentBytes(
  storagePath: string,
  data: Buffer,
  contentType: string,
): Promise<void> {
  if (!isSupabaseConfigured()) {
    if (isProductionLikeRuntime()) {
      throw new Error("Case document storage requires Supabase in production");
    }
    const { mkdir, writeFile } = await import("node:fs/promises");
    const path = await import("node:path");
    const full = path.join(process.cwd(), ".data", "case-employee-documents", storagePath);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, data);
    return;
  }

  const admin = getSupabaseAdmin();
  const { error } = await admin.storage.from(CASE_DOCUMENT_BUCKET).upload(storagePath, data, {
    contentType,
    upsert: false,
  });
  if (error) {
    throw new Error(`Case document upload failed: ${error.message}`);
  }
}

export async function deleteCaseDocumentBytes(storagePath: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const admin = getSupabaseAdmin();
  await admin.storage.from(CASE_DOCUMENT_BUCKET).remove([storagePath]);
}

export async function createCaseDocumentSignedUrl(
  storagePath: string,
  expiresInSeconds = 120,
): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.storage
    .from(CASE_DOCUMENT_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export async function readCaseDocumentBytes(
  storageBucket: string,
  storagePath: string,
): Promise<Buffer | null> {
  if (isSupabaseConfigured()) {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.storage.from(storageBucket).download(storagePath);
    if (error || !data) return null;
    return Buffer.from(await data.arrayBuffer());
  }
  if (isProductionLikeRuntime()) return null;
  try {
    const { readFile } = await import("node:fs/promises");
    const path = await import("node:path");
    return await readFile(
      path.join(process.cwd(), ".data", "case-employee-documents", storagePath),
    );
  } catch {
    return null;
  }
}
