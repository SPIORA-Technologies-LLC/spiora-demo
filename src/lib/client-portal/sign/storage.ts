import "server-only";

import { CASE_DOCUMENT_BUCKET } from "../case-document-storage";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { isProductionLikeRuntime } from "../case-store";
import { sha256Hex } from "./hashes";

export const SIGN_PDF_BUCKET = CASE_DOCUMENT_BUCKET;
export const SIGN_PDF_PREFIX = "contracts";

function safeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80) || "x";
}

export function signPdfStoragePath(
  contractId: string,
  versionId: string,
  kind: "source" | "final",
): string {
  return `${SIGN_PDF_PREFIX}/${safeSegment(contractId)}/${safeSegment(versionId)}/${kind}.pdf`;
}

function isAlreadyExistsError(error: { message?: string; statusCode?: string | number }) {
  const code = String(error.statusCode ?? "");
  const message = (error.message ?? "").toLowerCase();
  return (
    code === "409" ||
    message.includes("already exists") ||
    message.includes("duplicate") ||
    message.includes("the resource already exists")
  );
}

async function writeLocalExclusive(fullPath: string, data: Buffer): Promise<void> {
  const { mkdir, writeFile, readFile } = await import("node:fs/promises");
  const path = await import("node:path");
  await mkdir(path.dirname(fullPath), { recursive: true });
  try {
    await writeFile(fullPath, data, { flag: "wx" });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "EEXIST") throw error;
    const existing = await readFile(fullPath);
    if (sha256Hex(existing) !== sha256Hex(data)) {
      throw new Error("SIGN_PDF_EXISTS_HASH_MISMATCH");
    }
  }
}

export async function writeSignPdfBytes(
  storagePath: string,
  data: Buffer,
): Promise<void> {
  if (!isSupabaseConfigured()) {
    if (isProductionLikeRuntime()) {
      throw new Error("Sign PDF storage requires Supabase in production");
    }
    const path = await import("node:path");
    const full = path.join(process.cwd(), ".data", "consulting-sign-pdfs", storagePath);
    await writeLocalExclusive(full, data);
    return;
  }

  const admin = getSupabaseAdmin();
  const { error } = await admin.storage.from(SIGN_PDF_BUCKET).upload(storagePath, data, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (!error) return;
  if (!isAlreadyExistsError(error)) {
    throw new Error(`Sign PDF upload failed: ${error.message}`);
  }
  const existing = await readSignPdfBytes(storagePath);
  if (!existing || sha256Hex(existing) !== sha256Hex(data)) {
    throw new Error("SIGN_PDF_EXISTS_HASH_MISMATCH");
  }
}

export async function readSignPdfBytes(storagePath: string): Promise<Buffer | null> {
  if (isSupabaseConfigured()) {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.storage.from(SIGN_PDF_BUCKET).download(storagePath);
    if (error || !data) return null;
    return Buffer.from(await data.arrayBuffer());
  }
  if (isProductionLikeRuntime()) return null;
  try {
    const { readFile } = await import("node:fs/promises");
    const path = await import("node:path");
    return await readFile(
      path.join(process.cwd(), ".data", "consulting-sign-pdfs", storagePath),
    );
  } catch {
    return null;
  }
}
