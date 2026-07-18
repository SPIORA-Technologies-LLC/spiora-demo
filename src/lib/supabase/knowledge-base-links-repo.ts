import "server-only";

import type { SessionUser } from "@/lib/auth/types";
import {
  MAX_KB_LINKS_PER_ARTICLE,
  normalizeKbLinkLabel,
  normalizeKbLinkUrl,
} from "@/lib/knowledge-base/kb-link-formats";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { sbGetKnowledgeBaseRecord } from "@/lib/supabase/knowledge-base-repo";

export {
  MAX_KB_LINKS_PER_ARTICLE,
  MAX_KB_LINK_LABEL_CHARS,
  MAX_KB_LINK_URL_CHARS,
  normalizeKbLinkLabel,
  normalizeKbLinkUrl,
} from "@/lib/knowledge-base/kb-link-formats";

export type KbLinkRow = {
  id: string;
  article_id: string;
  url: string;
  label: string | null;
  sort_order: number;
  status: "active" | "archived";
  created_by: string;
  created_at: string;
  archived_at: string | null;
};

export type KbLinkDto = {
  id: string;
  articleId: string;
  url: string;
  label: string | null;
  sortOrder: number;
  status: "active" | "archived";
  createdBy: string;
  createdAt: string;
  archivedAt: string | null;
};

function mapDto(row: KbLinkRow): KbLinkDto {
  return {
    id: row.id,
    articleId: row.article_id,
    url: row.url,
    label: row.label,
    sortOrder: row.sort_order,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    archivedAt: row.archived_at,
  };
}

function canReaderSeeParent(article: {
  status: string;
  archived_at: string | null;
}): boolean {
  return article.status === "published" && article.archived_at == null;
}

export async function sbListKbLinks(
  slug: string,
  session: SessionUser,
  options: { includeArchived?: boolean } = {},
): Promise<KbLinkDto[]> {
  const article = await sbGetKnowledgeBaseRecord(slug);
  if (!article) return [];

  const isOwner = session.role === "owner";
  if (!isOwner && !canReaderSeeParent(article)) return [];

  let query = getSupabaseAdmin()
    .from("knowledge_base_links")
    .select("*")
    .eq("article_id", article.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (!isOwner || !options.includeArchived) {
    query = query.eq("status", "active").is("archived_at", null);
  }

  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as KbLinkRow[]).map(mapDto);
}

export async function sbCreateKbLink(
  slug: string,
  input: { url: string; label?: string | null },
  session: SessionUser,
): Promise<KbLinkDto> {
  if (session.role !== "owner") throw new Error("Forbidden");

  const article = await sbGetKnowledgeBaseRecord(slug);
  if (!article) throw new Error("Not found");

  const url = normalizeKbLinkUrl(input.url);
  if (!url) throw new Error("Invalid URL");

  const existing = await sbListKbLinks(slug, session, { includeArchived: false });
  if (existing.length >= MAX_KB_LINKS_PER_ARTICLE) {
    throw new Error("Too many links");
  }

  const { data, error } = await getSupabaseAdmin()
    .from("knowledge_base_links")
    .insert({
      article_id: article.id,
      url,
      label: normalizeKbLinkLabel(input.label),
      sort_order: existing.length,
      status: "active",
      created_by: session.id,
      archived_at: null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return mapDto(data as KbLinkRow);
}

export async function sbUpdateKbLink(
  slug: string,
  linkId: string,
  patch: { label?: string | null; url?: string },
  session: SessionUser,
): Promise<KbLinkDto | null> {
  if (session.role !== "owner") throw new Error("Forbidden");

  const article = await sbGetKnowledgeBaseRecord(slug);
  if (!article) return null;

  const updates: Record<string, unknown> = {};
  if (patch.label !== undefined) {
    updates.label = normalizeKbLinkLabel(patch.label);
  }
  if (patch.url !== undefined) {
    const url = normalizeKbLinkUrl(patch.url);
    if (!url) throw new Error("Invalid URL");
    updates.url = url;
  }
  if (Object.keys(updates).length === 0) {
    const list = await sbListKbLinks(slug, session, { includeArchived: true });
    return list.find((l) => l.id === linkId) ?? null;
  }

  const { data, error } = await getSupabaseAdmin()
    .from("knowledge_base_links")
    .update(updates)
    .eq("id", linkId)
    .eq("article_id", article.id)
    .select("*")
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return mapDto(data as KbLinkRow);
}

export async function sbArchiveKbLink(
  slug: string,
  linkId: string,
  session: SessionUser,
): Promise<KbLinkDto | null> {
  if (session.role !== "owner") throw new Error("Forbidden");

  const article = await sbGetKnowledgeBaseRecord(slug);
  if (!article) return null;

  const now = new Date().toISOString();
  const { data, error } = await getSupabaseAdmin()
    .from("knowledge_base_links")
    .update({
      status: "archived",
      archived_at: now,
    })
    .eq("id", linkId)
    .eq("article_id", article.id)
    .select("*")
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return mapDto(data as KbLinkRow);
}
