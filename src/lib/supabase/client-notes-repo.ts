import "server-only";

import { randomUUID } from "node:crypto";
import { getSupabaseAdmin } from "./server";
import type { ClientNoteRecord } from "@/lib/clients/client-data-types";

type NoteRow = {
  id: string;
  client_id: string;
  client_uuid: string | null;
  author: string;
  author_user_id: string | null;
  author_name: string | null;
  text: string;
  content: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  is_demo: boolean;
};

function mapNote(row: NoteRow, clientExternalId: string): ClientNoteRecord {
  const body = row.content?.trim() || row.text;
  return {
    id: row.id,
    clientId: clientExternalId,
    author: row.author_name?.trim() || row.author,
    authorUserId: row.author_user_id ?? undefined,
    text: body,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function activeNotesQuery(clientUuid: string) {
  return getSupabaseAdmin()
    .from("client_notes")
    .select("*")
    .eq("client_uuid", clientUuid)
    .is("archived_at", null)
    .order("created_at", { ascending: false });
}

export async function sbListClientNotesByUuid(
  clientUuid: string,
  clientExternalId: string,
): Promise<ClientNoteRecord[]> {
  const { data, error } = await activeNotesQuery(clientUuid);
  if (error) throw error;
  return ((data ?? []) as NoteRow[]).map((row) => mapNote(row, clientExternalId));
}

/** Legacy fallback when client_uuid not yet backfilled. */
export async function sbListClientNotesByExternalId(
  clientExternalId: string,
): Promise<ClientNoteRecord[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("client_notes")
    .select("*")
    .eq("client_id", clientExternalId)
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return ((data ?? []) as NoteRow[]).map((row) => mapNote(row, clientExternalId));
}

export async function sbGetClientNoteById(
  noteId: string,
  clientUuid: string,
  clientExternalId: string,
): Promise<ClientNoteRecord | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("client_notes")
    .select("*")
    .eq("id", noteId)
    .eq("client_uuid", clientUuid)
    .is("archived_at", null)
    .maybeSingle();

  if (error) throw error;
  return data ? mapNote(data as NoteRow, clientExternalId) : null;
}

export async function sbInsertClientNote(input: {
  clientUuid: string;
  clientExternalId: string;
  authorUserId: string;
  authorName: string;
  content: string;
  isDemo?: boolean;
}): Promise<ClientNoteRecord> {
  const now = new Date().toISOString();
  const id = randomUUID();
  const { data, error } = await getSupabaseAdmin()
    .from("client_notes")
    .insert({
      id,
      client_id: input.clientExternalId,
      client_uuid: input.clientUuid,
      author: input.authorName,
      author_user_id: input.authorUserId,
      author_name: input.authorName,
      text: input.content,
      content: input.content,
      created_at: now,
      updated_at: now,
      is_demo: input.isDemo ?? true,
    })
    .select("*")
    .single();

  if (error) throw error;
  return mapNote(data as NoteRow, input.clientExternalId);
}

export async function sbUpdateClientNote(
  noteId: string,
  clientUuid: string,
  clientExternalId: string,
  content: string,
): Promise<ClientNoteRecord | null> {
  const now = new Date().toISOString();
  const { data, error } = await getSupabaseAdmin()
    .from("client_notes")
    .update({
      content,
      text: content,
      updated_at: now,
    })
    .eq("id", noteId)
    .eq("client_uuid", clientUuid)
    .is("archived_at", null)
    .select("*")
    .maybeSingle();

  if (error) throw error;
  return data ? mapNote(data as NoteRow, clientExternalId) : null;
}

export async function sbArchiveClientNote(
  noteId: string,
  clientUuid: string,
): Promise<boolean> {
  const now = new Date().toISOString();
  const { error, count } = await getSupabaseAdmin()
    .from("client_notes")
    .update({ archived_at: now, updated_at: now })
    .eq("id", noteId)
    .eq("client_uuid", clientUuid)
    .is("archived_at", null);

  if (error) throw error;
  return (count ?? 0) > 0;
}
