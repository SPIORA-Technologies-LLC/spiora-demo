import "server-only";

import { randomUUID } from "node:crypto";
import type { SessionUser } from "@/lib/auth/types";
import {
  KB_ATTACHMENT_BUCKET,
  MAX_KB_ATTACHMENTS_PER_ARTICLE,
  buildKbStoragePath,
  getKbAttachmentUrl,
  kindForMime,
  validateKbAttachmentFile,
  type KbAttachmentKind,
} from "@/lib/knowledge-base/attachment-formats";
import {
  readKbAttachmentFile,
  saveKbAttachmentFile,
} from "@/lib/knowledge-base/attachment-storage";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { sbGetKnowledgeBaseRecord } from "@/lib/supabase/knowledge-base-repo";

export type KbAttachmentRow = {
  id: string;
  article_id: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  storage_bucket: string;
  storage_path: string;
  caption: string | null;
  sort_order: number;
  is_primary: boolean;
  status: "active" | "archived";
  uploaded_by: string;
  created_at: string;
  archived_at: string | null;
};

export type KbAttachmentDto = {
  id: string;
  articleId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  caption: string | null;
  sortOrder: number;
  isPrimary: boolean;
  status: "active" | "archived";
  uploadedBy: string;
  createdAt: string;
  archivedAt: string | null;
  url: string;
  kind: KbAttachmentKind;
};

function mapDto(row: KbAttachmentRow, slug: string): KbAttachmentDto {
  return {
    id: row.id,
    articleId: row.article_id,
    fileName: row.file_name,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    caption: row.caption,
    sortOrder: row.sort_order,
    isPrimary: row.is_primary,
    status: row.status,
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at,
    archivedAt: row.archived_at,
    url: getKbAttachmentUrl(slug, row.id),
    kind: kindForMime(row.mime_type) ?? "pdf",
  };
}

function canReaderSeeParent(article: {
  status: string;
  archived_at: string | null;
}): boolean {
  return article.status === "published" && article.archived_at == null;
}

export async function sbListKbAttachments(
  slug: string,
  session: SessionUser,
  options: { includeArchived?: boolean } = {},
): Promise<KbAttachmentDto[]> {
  const article = await sbGetKnowledgeBaseRecord(slug);
  if (!article) return [];

  const isOwner = session.role === "owner";
  if (!isOwner && !canReaderSeeParent(article)) return [];

  let query = getSupabaseAdmin()
    .from("knowledge_base_attachments")
    .select("*")
    .eq("article_id", article.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (!isOwner || !options.includeArchived) {
    query = query.eq("status", "active").is("archived_at", null);
  }

  const { data, error } = await query;
  if (error) throw error;

  return ((data ?? []) as KbAttachmentRow[]).map((row) => mapDto(row, slug));
}

export async function sbGetKbAttachment(
  slug: string,
  attachmentId: string,
  session: SessionUser,
): Promise<{ dto: KbAttachmentDto; row: KbAttachmentRow; articleId: string } | null> {
  const article = await sbGetKnowledgeBaseRecord(slug);
  if (!article) return null;

  const isOwner = session.role === "owner";
  if (!isOwner && !canReaderSeeParent(article)) return null;

  const { data, error } = await getSupabaseAdmin()
    .from("knowledge_base_attachments")
    .select("*")
    .eq("id", attachmentId)
    .eq("article_id", article.id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const row = data as KbAttachmentRow;
  if (!isOwner && (row.status !== "active" || row.archived_at)) return null;

  return { dto: mapDto(row, slug), row, articleId: article.id };
}

export async function sbUploadKbAttachment(
  slug: string,
  input: { buffer: Buffer; fileName: string; contentType: string; size: number },
  session: SessionUser,
): Promise<KbAttachmentDto> {
  if (session.role !== "owner") throw new Error("Forbidden");

  const article = await sbGetKnowledgeBaseRecord(slug);
  if (!article) throw new Error("Not found");

  const validated = validateKbAttachmentFile(input);
  if (!validated.ok) {
    const map = {
      unsupported_type: "Unsupported file type",
      blocked_type: "Blocked file type",
      file_too_large: "File too large",
      empty_file: "Empty file",
      mime_mismatch: "MIME mismatch",
    } as const;
    throw new Error(map[validated.error]);
  }

  const existing = await sbListKbAttachments(slug, session, { includeArchived: false });
  if (existing.length >= MAX_KB_ATTACHMENTS_PER_ARTICLE) {
    throw new Error("Too many attachments");
  }

  const id = randomUUID();
  const storagePath = buildKbStoragePath(id, validated.mimeType);

  await saveKbAttachmentFile(storagePath, input.buffer, validated.mimeType);

  const { data, error } = await getSupabaseAdmin()
    .from("knowledge_base_attachments")
    .insert({
      id,
      article_id: article.id,
      file_name: validated.fileName,
      mime_type: validated.mimeType,
      file_size: input.buffer.length,
      storage_bucket: KB_ATTACHMENT_BUCKET,
      storage_path: storagePath,
      caption: null,
      sort_order: existing.length,
      is_primary: existing.length === 0,
      status: "active",
      uploaded_by: session.id,
      archived_at: null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return mapDto(data as KbAttachmentRow, slug);
}

export async function sbUpdateKbAttachment(
  slug: string,
  attachmentId: string,
  patch: { caption?: string | null; sortOrder?: number; isPrimary?: boolean },
  session: SessionUser,
): Promise<KbAttachmentDto | null> {
  if (session.role !== "owner") throw new Error("Forbidden");

  const found = await sbGetKbAttachment(slug, attachmentId, session);
  if (!found) return null;

  const updates: Record<string, unknown> = {};
  if (patch.caption !== undefined) {
    updates.caption = patch.caption?.trim() ? patch.caption.trim().slice(0, 500) : null;
  }
  if (typeof patch.sortOrder === "number" && Number.isFinite(patch.sortOrder)) {
    updates.sort_order = Math.max(0, Math.floor(patch.sortOrder));
  }
  if (typeof patch.isPrimary === "boolean") {
    updates.is_primary = patch.isPrimary;
  }
  if (Object.keys(updates).length === 0) return found.dto;

  if (updates.is_primary === true) {
    await getSupabaseAdmin()
      .from("knowledge_base_attachments")
      .update({ is_primary: false })
      .eq("article_id", found.articleId)
      .eq("status", "active");
  }

  const { data, error } = await getSupabaseAdmin()
    .from("knowledge_base_attachments")
    .update(updates)
    .eq("id", attachmentId)
    .select("*")
    .single();

  if (error) throw error;
  return mapDto(data as KbAttachmentRow, slug);
}

export async function sbArchiveKbAttachment(
  slug: string,
  attachmentId: string,
  session: SessionUser,
): Promise<KbAttachmentDto | null> {
  if (session.role !== "owner") throw new Error("Forbidden");

  const found = await sbGetKbAttachment(slug, attachmentId, session);
  if (!found) return null;

  const now = new Date().toISOString();
  const { data, error } = await getSupabaseAdmin()
    .from("knowledge_base_attachments")
    .update({
      status: "archived",
      archived_at: now,
      is_primary: false,
    })
    .eq("id", attachmentId)
    .select("*")
    .single();

  if (error) throw error;
  return mapDto(data as KbAttachmentRow, slug);
}

export async function sbReadKbAttachmentBytes(
  slug: string,
  attachmentId: string,
  session: SessionUser,
): Promise<{ dto: KbAttachmentDto; data: Buffer; contentType: string } | null> {
  const found = await sbGetKbAttachment(slug, attachmentId, session);
  if (!found) return null;

  const isOwner = session.role === "owner";
  if (!isOwner && (found.row.status !== "active" || found.row.archived_at)) {
    return null;
  }

  const file = await readKbAttachmentFile(found.row.storage_path);
  if (!file) return null;

  return {
    dto: found.dto,
    data: file.data,
    contentType: found.row.mime_type || file.contentType,
  };
}
