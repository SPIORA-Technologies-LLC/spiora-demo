import "server-only";

import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  contentTypeFromExt,
  extFromFileName,
} from "./questionnaire-attachment-formats";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSupabaseAdmin } from "@/lib/supabase/server";

/**
 * Reuse the existing demo/prod bucket from migration 006 so uploads work on
 * Vercel without a new storage migration. Objects are namespaced by prefix.
 */
const BUCKET = "task-attachments";
const OBJECT_PREFIX = "questionnaire";
const LOCAL_DIR = path.join(process.cwd(), ".data", "questionnaire-attachments");

function safeInvitationSegment(invitationId: string): string {
  return invitationId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80) || "invite";
}

function storageObjectName(invitationId: string, attachmentId: string, ext: string): string {
  return `${OBJECT_PREFIX}/${safeInvitationSegment(invitationId)}/${attachmentId}.${ext}`;
}

function isVercelRuntime(): boolean {
  return process.env.VERCEL === "1";
}

export async function saveQuestionnaireAttachmentFile(
  invitationId: string,
  attachmentId: string,
  fileName: string,
  data: Buffer,
  contentType: string,
): Promise<void> {
  const ext = extFromFileName(fileName) || "bin";
  const objectName = storageObjectName(invitationId, attachmentId, ext);

  if (isSupabaseConfigured()) {
    const admin = getSupabaseAdmin();
    const { error } = await admin.storage.from(BUCKET).upload(objectName, data, {
      contentType,
      upsert: true,
    });
    if (!error) return;

    // Local fallback is only useful off Vercel (writable disk).
    if (isVercelRuntime()) {
      throw new Error(`Questionnaire attachment upload failed: ${error.message}`);
    }
  } else if (isVercelRuntime()) {
    throw new Error("Questionnaire attachment storage is not configured");
  }

  const fullPath = path.join(LOCAL_DIR, objectName);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, data);
}

export async function readQuestionnaireAttachmentFile(
  invitationId: string,
  attachmentId: string,
  fileName: string,
): Promise<{ data: Buffer; contentType: string } | null> {
  const ext = extFromFileName(fileName) || "bin";
  const objectName = storageObjectName(invitationId, attachmentId, ext);

  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabaseAdmin()
      .storage.from(BUCKET)
      .download(objectName);
    if (!error && data) {
      return {
        data: Buffer.from(await data.arrayBuffer()),
        contentType: contentTypeFromExt(ext),
      };
    }
  }

  try {
    const data = await readFile(path.join(LOCAL_DIR, objectName));
    return { data, contentType: contentTypeFromExt(ext) };
  } catch {
    return null;
  }
}

export async function deleteQuestionnaireAttachmentFile(
  invitationId: string,
  attachmentId: string,
  fileName: string,
): Promise<void> {
  const ext = extFromFileName(fileName) || "bin";
  const objectName = storageObjectName(invitationId, attachmentId, ext);

  if (isSupabaseConfigured()) {
    try {
      await getSupabaseAdmin().storage.from(BUCKET).remove([objectName]);
    } catch {
      // ignore
    }
  }

  try {
    await unlink(path.join(LOCAL_DIR, objectName));
  } catch {
    // ignore missing
  }
}
