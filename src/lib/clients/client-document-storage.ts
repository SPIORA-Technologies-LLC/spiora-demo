import "server-only";

import { randomUUID } from "node:crypto";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { extFromFileName } from "@/lib/client-portal/questionnaire-attachment-formats";
import { isProductionLikeRuntime } from "@/lib/client-portal/case-store";

/** Reuse private task-attachments bucket with a CRM clients prefix. */
export const CLIENT_DOCUMENT_BUCKET = "task-attachments";
export const CLIENT_DOCUMENT_PREFIX = "crm-clients";

function safeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80) || "x";
}

export function newClientDocumentStoragePath(
  clientExternalId: string,
  fileName: string,
): string {
  const ext = extFromFileName(fileName) || "bin";
  return `${CLIENT_DOCUMENT_PREFIX}/${safeSegment(clientExternalId)}/${randomUUID()}.${ext}`;
}

export async function uploadClientDocumentBytes(
  storagePath: string,
  data: Buffer,
  contentType: string,
): Promise<"supabase" | "local"> {
  if (!isSupabaseConfigured()) {
    if (isProductionLikeRuntime()) {
      throw new Error("Client document storage requires Supabase in production");
    }
    const { mkdir, writeFile } = await import("node:fs/promises");
    const path = await import("node:path");
    const full = path.join(
      process.cwd(),
      ".data",
      "client-crm-documents",
      storagePath,
    );
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, data);
    return "local";
  }

  const admin = getSupabaseAdmin();
  const { error } = await admin.storage
    .from(CLIENT_DOCUMENT_BUCKET)
    .upload(storagePath, data, {
      contentType,
      upsert: false,
    });
  if (error) {
    throw new Error(`Client document upload failed: ${error.message}`);
  }
  return "supabase";
}

export async function deleteClientDocumentBytes(
  storagePath: string,
): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const admin = getSupabaseAdmin();
  await admin.storage.from(CLIENT_DOCUMENT_BUCKET).remove([storagePath]);
}

export async function readClientDocumentBytes(
  storageBucket: string,
  storagePath: string,
): Promise<Buffer | null> {
  if (isSupabaseConfigured()) {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.storage
      .from(storageBucket)
      .download(storagePath);
    if (error || !data) return null;
    return Buffer.from(await data.arrayBuffer());
  }
  if (isProductionLikeRuntime()) return null;
  try {
    const { readFile } = await import("node:fs/promises");
    const path = await import("node:path");
    return await readFile(
      path.join(process.cwd(), ".data", "client-crm-documents", storagePath),
    );
  } catch {
    return null;
  }
}
