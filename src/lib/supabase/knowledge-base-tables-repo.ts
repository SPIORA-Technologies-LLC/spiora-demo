import "server-only";

import type { SessionUser } from "@/lib/auth/types";
import {
  MAX_KB_TABLES_PER_ARTICLE,
  emptyKbTableDocument,
  type KbTableDocument,
} from "@/lib/knowledge-base/table-limits";
import {
  validateKbTableDescription,
  validateKbTableDocument,
  validateKbTableTitle,
} from "@/lib/knowledge-base/table-document";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { sbGetKnowledgeBaseRecord } from "@/lib/supabase/knowledge-base-repo";

export type KbTableRowDb = {
  id: string;
  article_id: string;
  title: string;
  description: string | null;
  schema_version: number;
  columns: KbTableDocument["columns"];
  rows: KbTableDocument["rows"];
  row_count: number;
  column_count: number;
  sort_order: number;
  status: "active" | "archived";
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  revision: number;
};

export type KbTableDto = {
  id: string;
  articleId: string;
  title: string;
  description: string | null;
  schemaVersion: number;
  document: KbTableDocument;
  rowCount: number;
  columnCount: number;
  sortOrder: number;
  status: "active" | "archived";
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  revision: number;
};

function mapDto(row: KbTableRowDb): KbTableDto {
  return {
    id: row.id,
    articleId: row.article_id,
    title: row.title,
    description: row.description,
    schemaVersion: row.schema_version,
    document: { columns: row.columns, rows: row.rows },
    rowCount: row.row_count,
    columnCount: row.column_count,
    sortOrder: row.sort_order,
    status: row.status,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at,
    revision: row.revision,
  };
}

function canReaderSeeParent(article: {
  status: string;
  archived_at: string | null;
}): boolean {
  return article.status === "published" && article.archived_at == null;
}

export class KbTableConflictError extends Error {
  constructor() {
    super("revision_conflict");
    this.name = "KbTableConflictError";
  }
}

export async function sbListKbTables(
  slug: string,
  session: SessionUser,
  options: { includeArchived?: boolean } = {},
): Promise<KbTableDto[]> {
  const article = await sbGetKnowledgeBaseRecord(slug);
  if (!article) return [];

  const isOwner = session.role === "owner";
  if (!isOwner && !canReaderSeeParent(article)) return [];

  let query = getSupabaseAdmin()
    .from("knowledge_base_tables")
    .select("*")
    .eq("article_id", article.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (!isOwner || !options.includeArchived) {
    query = query.eq("status", "active").is("archived_at", null);
  }

  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as KbTableRowDb[]).map(mapDto);
}

export async function sbGetKbTable(
  slug: string,
  tableId: string,
  session: SessionUser,
): Promise<KbTableDto | null> {
  const article = await sbGetKnowledgeBaseRecord(slug);
  if (!article) return null;

  const isOwner = session.role === "owner";
  if (!isOwner && !canReaderSeeParent(article)) return null;

  const { data, error } = await getSupabaseAdmin()
    .from("knowledge_base_tables")
    .select("*")
    .eq("id", tableId)
    .eq("article_id", article.id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const row = data as KbTableRowDb;
  if (!isOwner && (row.status !== "active" || row.archived_at)) return null;
  return mapDto(row);
}

export async function sbCreateKbTable(
  slug: string,
  input: {
    title?: string;
    description?: string | null;
    document?: KbTableDocument;
  },
  session: SessionUser,
): Promise<KbTableDto> {
  if (session.role !== "owner") throw new Error("Forbidden");

  const article = await sbGetKnowledgeBaseRecord(slug);
  if (!article) throw new Error("Not found");

  const { count, error: countError } = await getSupabaseAdmin()
    .from("knowledge_base_tables")
    .select("id", { count: "exact", head: true })
    .eq("article_id", article.id)
    .eq("status", "active");
  if (countError) throw countError;
  if ((count ?? 0) >= MAX_KB_TABLES_PER_ARTICLE) {
    throw new Error("Too many tables");
  }

  const titleCheck = validateKbTableTitle(input.title ?? "Untitled table");
  if (!titleCheck.ok) throw new Error(titleCheck.error);

  const descriptionCheck = validateKbTableDescription(input.description ?? null);
  if (!descriptionCheck.ok) throw new Error(descriptionCheck.error);

  const doc = input.document ?? emptyKbTableDocument(3, 3);
  const validated = validateKbTableDocument(doc);
  if (!validated.ok) throw new Error(validated.error);

  const { data: maxSort } = await getSupabaseAdmin()
    .from("knowledge_base_tables")
    .select("sort_order")
    .eq("article_id", article.id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const sortOrder =
    typeof maxSort?.sort_order === "number" ? maxSort.sort_order + 1 : 0;

  const { data, error } = await getSupabaseAdmin()
    .from("knowledge_base_tables")
    .insert({
      article_id: article.id,
      title: titleCheck.title,
      description: descriptionCheck.description,
      schema_version: 1,
      columns: validated.data.columns,
      rows: validated.data.rows,
      row_count: validated.data.rows.length,
      column_count: validated.data.columns.length,
      sort_order: sortOrder,
      status: "active",
      created_by: session.id,
      updated_by: session.id,
      archived_at: null,
      revision: 1,
    })
    .select("*")
    .single();

  if (error) throw error;
  return mapDto(data as KbTableRowDb);
}

export async function sbUpdateKbTable(
  slug: string,
  tableId: string,
  input: {
    title?: string;
    description?: string | null;
    document?: KbTableDocument;
    expectedRevision: number;
  },
  session: SessionUser,
): Promise<KbTableDto> {
  if (session.role !== "owner") throw new Error("Forbidden");

  const existing = await sbGetKbTable(slug, tableId, session);
  if (!existing) throw new Error("Not found");
  if (existing.status === "archived") throw new Error("Archived");

  if (existing.revision !== input.expectedRevision) {
    throw new KbTableConflictError();
  }

  const patch: Record<string, unknown> = {
    updated_by: session.id,
    revision: existing.revision + 1,
  };

  if (input.title !== undefined) {
    const titleCheck = validateKbTableTitle(input.title);
    if (!titleCheck.ok) throw new Error(titleCheck.error);
    patch.title = titleCheck.title;
  }
  if (input.description !== undefined) {
    const descriptionCheck = validateKbTableDescription(input.description);
    if (!descriptionCheck.ok) throw new Error(descriptionCheck.error);
    patch.description = descriptionCheck.description;
  }
  if (input.document) {
    const validated = validateKbTableDocument(input.document);
    if (!validated.ok) throw new Error(validated.error);
    patch.columns = validated.data.columns;
    patch.rows = validated.data.rows;
    patch.row_count = validated.data.rows.length;
    patch.column_count = validated.data.columns.length;
  }

  const article = await sbGetKnowledgeBaseRecord(slug);
  if (!article) throw new Error("Not found");

  const { data, error } = await getSupabaseAdmin()
    .from("knowledge_base_tables")
    .update(patch)
    .eq("id", tableId)
    .eq("article_id", article.id)
    .eq("revision", input.expectedRevision)
    .select("*")
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new KbTableConflictError();
  return mapDto(data as KbTableRowDb);
}

export async function sbArchiveKbTable(
  slug: string,
  tableId: string,
  session: SessionUser,
): Promise<KbTableDto> {
  if (session.role !== "owner") throw new Error("Forbidden");

  const current = await sbGetKbTable(slug, tableId, session);
  if (!current) throw new Error("Not found");
  if (current.status === "archived") return current;

  const article = await sbGetKnowledgeBaseRecord(slug);
  if (!article) throw new Error("Not found");

  const now = new Date().toISOString();
  const { data, error } = await getSupabaseAdmin()
    .from("knowledge_base_tables")
    .update({
      status: "archived",
      archived_at: now,
      updated_by: session.id,
      revision: current.revision + 1,
    })
    .eq("id", tableId)
    .eq("article_id", article.id)
    .select("*")
    .single();

  if (error) throw error;
  return mapDto(data as KbTableRowDb);
}
