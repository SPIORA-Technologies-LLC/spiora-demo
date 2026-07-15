import "server-only";

import type { SessionUser } from "@/lib/auth/types";
import { isCrmLegacyFallbackAllowed, isCrmPostgresPrimary } from "./config";
import type { ClientNoteRecord, ClientNotesListResult } from "./client-data-types";
import {
  canArchiveClientNote,
  canCreateClientNote,
  canReadClientNotes,
  canUpdateClientNote,
} from "./client-data-permissions";
import { ClientDataValidationError, validateNoteContent } from "./client-data-validation";
import * as sbClients from "@/lib/supabase/clients-repo";
import * as sbNotes from "@/lib/supabase/client-notes-repo";

export class ClientNotesAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClientNotesAccessError";
  }
}

export class ClientNotesStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClientNotesStorageError";
  }
}

async function resolveClientContext(externalId: string): Promise<{
  clientUuid: string;
  clientExternalId: string;
} | null> {
  const clientUuid = await sbClients.sbGetClientUuidByExternalId(externalId);
  if (!clientUuid) return null;
  return { clientUuid, clientExternalId: externalId };
}

export async function listClientNotes(
  clientExternalId: string,
  user: SessionUser,
): Promise<ClientNotesListResult> {
  if (!canReadClientNotes(user)) {
    throw new ClientNotesAccessError("Forbidden");
  }

  if (!isCrmPostgresPrimary()) {
    throw new ClientNotesStorageError("CRM PostgreSQL is not configured");
  }

  try {
    const ctx = await resolveClientContext(clientExternalId);
    if (!ctx) {
      return { items: [], source: "postgresql" };
    }

    let items = await sbNotes.sbListClientNotesByUuid(
      ctx.clientUuid,
      ctx.clientExternalId,
    );

    if (items.length === 0) {
      items = await sbNotes.sbListClientNotesByExternalId(ctx.clientExternalId);
    }

    return { items, source: "postgresql" };
  } catch (error) {
    console.error("[client-notes-store] list failed", error);
    if (isCrmLegacyFallbackAllowed()) {
      console.warn("[client-notes-store] legacy fallback disabled for notes in PR #15");
    }
    throw new ClientNotesStorageError("Failed to load client notes");
  }
}

export async function createClientNote(
  clientExternalId: string,
  user: SessionUser,
  text: string,
): Promise<ClientNoteRecord> {
  if (!canCreateClientNote(user)) {
    throw new ClientNotesAccessError("Forbidden");
  }

  const content = validateNoteContent(text);

  if (!isCrmPostgresPrimary()) {
    throw new ClientNotesStorageError("CRM PostgreSQL is not configured");
  }

  const ctx = await resolveClientContext(clientExternalId);
  if (!ctx) {
    throw new ClientNotesStorageError("Client not found");
  }

  try {
    return await sbNotes.sbInsertClientNote({
      clientUuid: ctx.clientUuid,
      clientExternalId: ctx.clientExternalId,
      authorUserId: user.id,
      authorName: user.name,
      content,
    });
  } catch (error) {
    console.error("[client-notes-store] create failed", error);
    throw new ClientNotesStorageError("Failed to create note");
  }
}

export async function updateClientNote(
  clientExternalId: string,
  noteId: string,
  user: SessionUser,
  text: string,
): Promise<ClientNoteRecord> {
  if (!canUpdateClientNote(user)) {
    throw new ClientNotesAccessError("Forbidden");
  }

  const content = validateNoteContent(text);

  if (!isCrmPostgresPrimary()) {
    throw new ClientNotesStorageError("CRM PostgreSQL is not configured");
  }

  const ctx = await resolveClientContext(clientExternalId);
  if (!ctx) {
    throw new ClientNotesStorageError("Client not found");
  }

  try {
    const updated = await sbNotes.sbUpdateClientNote(
      noteId,
      ctx.clientUuid,
      ctx.clientExternalId,
      content,
    );
    if (!updated) {
      throw new ClientNotesStorageError("Note not found");
    }
    return updated;
  } catch (error) {
    if (error instanceof ClientNotesStorageError) throw error;
    console.error("[client-notes-store] update failed", error);
    throw new ClientNotesStorageError("Failed to update note");
  }
}

export async function archiveClientNote(
  clientExternalId: string,
  noteId: string,
  user: SessionUser,
): Promise<void> {
  if (!canArchiveClientNote(user)) {
    throw new ClientNotesAccessError("Forbidden");
  }

  if (!isCrmPostgresPrimary()) {
    throw new ClientNotesStorageError("CRM PostgreSQL is not configured");
  }

  const ctx = await resolveClientContext(clientExternalId);
  if (!ctx) {
    throw new ClientNotesStorageError("Client not found");
  }

  try {
    const ok = await sbNotes.sbArchiveClientNote(noteId, ctx.clientUuid);
    if (!ok) {
      throw new ClientNotesStorageError("Note not found");
    }
  } catch (error) {
    if (error instanceof ClientNotesStorageError) throw error;
    console.error("[client-notes-store] archive failed", error);
    throw new ClientNotesStorageError("Failed to archive note");
  }
}

export { ClientDataValidationError };
