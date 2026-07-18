import "server-only";

import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  KB_ATTACHMENT_BUCKET,
  contentTypeFromExt,
  extFromFileName,
} from "@/lib/knowledge-base/attachment-formats";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const LOCAL_DIR = path.join(process.cwd(), ".data", "knowledge-base");

function assertSafeStoragePath(storagePath: string): string {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|png|jpe?g|webp)$/i.test(
      storagePath,
    )
  ) {
    throw new Error("Invalid storage path");
  }
  if (storagePath.includes("..") || storagePath.includes("/") || storagePath.includes("\\")) {
    throw new Error("Invalid storage path");
  }
  return storagePath;
}

export async function saveKbAttachmentFile(
  storagePath: string,
  data: Buffer,
  contentType: string,
): Promise<void> {
  const safePath = assertSafeStoragePath(storagePath);

  if (isSupabaseConfigured()) {
    const { error } = await getSupabaseAdmin()
      .storage.from(KB_ATTACHMENT_BUCKET)
      .upload(safePath, data, {
        contentType,
        upsert: true,
      });
    if (error) throw error;
    return;
  }

  await mkdir(LOCAL_DIR, { recursive: true });
  await writeFile(path.join(LOCAL_DIR, safePath), data);
}

export async function readKbAttachmentFile(
  storagePath: string,
): Promise<{ data: Buffer; contentType: string } | null> {
  const safePath = assertSafeStoragePath(storagePath);
  const ext = extFromFileName(safePath) || "bin";

  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabaseAdmin()
      .storage.from(KB_ATTACHMENT_BUCKET)
      .download(safePath);
    if (!error && data) {
      return {
        data: Buffer.from(await data.arrayBuffer()),
        contentType: contentTypeFromExt(ext) || "application/octet-stream",
      };
    }
    return null;
  }

  try {
    const data = await readFile(path.join(LOCAL_DIR, safePath));
    return {
      data,
      contentType: contentTypeFromExt(ext) || "application/octet-stream",
    };
  } catch {
    return null;
  }
}

/** Soft-archive only in DB; optional physical remove for cleanup jobs. */
export async function deleteKbAttachmentFile(storagePath: string): Promise<void> {
  const safePath = assertSafeStoragePath(storagePath);

  if (isSupabaseConfigured()) {
    await getSupabaseAdmin().storage.from(KB_ATTACHMENT_BUCKET).remove([safePath]);
    return;
  }

  try {
    await unlink(path.join(LOCAL_DIR, safePath));
  } catch {
    // ignore missing
  }
}
