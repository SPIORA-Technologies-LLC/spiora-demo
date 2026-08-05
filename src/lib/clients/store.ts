import "server-only";

import type { SessionUser } from "@/lib/auth/types";
import {
  isCrmLegacyFallbackAllowed,
  isCrmPostgresPrimary,
  type CrmDataSource,
} from "@/lib/clients/config";
import {
  canArchiveClient,
  canCreateClient,
  canUpdateClient,
} from "@/lib/clients/permissions";
import {
  ClientValidationError,
  sanitizeClientFilters,
  validateCreateClientInput,
  validateUpdateClientInput,
  type CreateClientInput,
  type UpdateClientInput,
} from "@/lib/clients/validation";
import {
  appendDemoNote,
  DEMO_CLIENTS,
  getDemoClientDetail,
} from "@/lib/google-sheets/demo-data";
import { getGoogleSheetsClient, sheetsConfigured } from "@/lib/google-sheets/google-sheets-client";
import { isGoogleSheetsPublicClientsConfigured } from "@/lib/google-sheets/auth";
import {
  appendLocalNote,
  listLocalNotesByClientId,
  updateLocalNote,
} from "@/lib/google-sheets/local-notes";
import {
  clientMatchesFilters,
  clientMatchesSearch,
} from "@/lib/google-sheets/parse";
import type {
  Client,
  ClientDetail,
  ClientDocument,
  ClientFilters,
  ClientNote,
  ClientsListResult,
} from "@/lib/google-sheets/types";
import * as sbClients from "@/lib/supabase/clients-repo";
import { listClientDocuments } from "@/lib/clients/client-documents-store";
import { listClientNotes } from "@/lib/clients/client-notes-store";
import {
  mapDocumentPublicToClientDocument,
  mapNoteRecordToClientNote,
} from "@/lib/clients/client-data-map";

const DEFAULT_PAGE_SIZE = 25;

export class CrmAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CrmAccessError";
  }
}

export class CrmStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CrmStorageError";
  }
}

function toApiSource(source: CrmDataSource): ClientsListResult["source"] {
  return source;
}

async function listLegacyAllClients(
  filters: ClientFilters,
): Promise<{ items: Client[]; source: ClientsListResult["source"] }> {
  let all: Client[];
  let source: ClientsListResult["source"];

  if (sheetsConfigured()) {
    all = await getGoogleSheetsClient().getClients();
    source = "google_sheets";
  } else {
    all = DEMO_CLIENTS;
    source = "demo";
  }

  const sanitized = sanitizeClientFilters(filters);
  const items = all.filter(
    (client) =>
      clientMatchesSearch(client, sanitized.search ?? "") &&
      clientMatchesFilters(client, sanitized),
  );

  return { items, source };
}

async function withPostgresOrLegacy<T>(
  operation: string,
  postgresFn: () => Promise<T>,
  legacyFn: () => Promise<T>,
): Promise<T> {
  if (isCrmPostgresPrimary()) {
    try {
      return await postgresFn();
    } catch (error) {
      console.error(`[crm-store] PostgreSQL ${operation} failed`, error);
      if (isCrmLegacyFallbackAllowed()) {
        console.warn(
          `[crm-store] SPIORA_CRM_LEGACY_FALLBACK=true — using legacy source for ${operation}`,
        );
        return legacyFn();
      }
      throw new CrmStorageError(`CRM storage unavailable (${operation})`);
    }
  }
  return legacyFn();
}

export async function listAllClients(filters: ClientFilters = {}): Promise<{
  items: Client[];
  source: ClientsListResult["source"];
}> {
  const sanitized = sanitizeClientFilters(filters);

  return withPostgresOrLegacy(
    "listAllClients",
    async () => {
      const { items } = await sbClients.sbListClients({
        page: 1,
        pageSize: 10_000,
        filters: sanitized,
      });
      return { items, source: toApiSource("postgresql") };
    },
    () => listLegacyAllClients(sanitized),
  );
}

export async function listClients(
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
  filters: ClientFilters = {},
): Promise<ClientsListResult> {
  const sanitized = sanitizeClientFilters(filters);

  return withPostgresOrLegacy(
    "listClients",
    async () => {
      const result = await sbClients.sbListClients({
        page,
        pageSize,
        filters: sanitized,
      });
      return {
        items: result.items,
        total: result.total,
        page,
        pageSize,
        source: toApiSource("postgresql"),
      };
    },
    async () => {
      const { items: filtered, source } = await listLegacyAllClients(sanitized);
      const total = filtered.length;
      const start = (page - 1) * pageSize;
      const items = filtered.slice(start, start + pageSize);
      return { items, total, page, pageSize, source };
    },
  );
}

async function loadPostgresClientDetailData(
  clientExternalId: string,
  user?: SessionUser,
): Promise<{ notes: ClientNote[]; documents: ClientDocument[] }> {
  const systemUser: SessionUser = user ?? {
    id: "system",
    email: "system@spiora.demo",
    name: "System",
    role: "owner",
  };

  try {
    const [notesResult, documentsResult] = await Promise.all([
      listClientNotes(clientExternalId, systemUser),
      listClientDocuments(clientExternalId, systemUser),
    ]);

    return {
      notes: notesResult.items.map(mapNoteRecordToClientNote),
      documents: documentsResult.items.map(mapDocumentPublicToClientDocument),
    };
  } catch (error) {
    console.error("[crm-store] client detail data load failed", error);
    return { notes: [], documents: [] };
  }
}

export async function getClientDetail(id: string): Promise<ClientDetail | null> {
  return withPostgresOrLegacy(
    "getClientDetail",
    async () => {
      const client = await sbClients.sbGetClientByExternalId(id);
      if (!client) return null;
      const { notes, documents } = await loadPostgresClientDetailData(id);
      return {
        client,
        surveys: [],
        documents,
        notes,
        source: toApiSource("postgresql"),
      };
    },
    async () => {
      if (sheetsConfigured()) {
        const sheets = getGoogleSheetsClient();
        const client = await sheets.getClientById(id);
        if (!client) return null;

        if (isGoogleSheetsPublicClientsConfigured()) {
          const notes = await listLocalNotesByClientId(id);
          return {
            client,
            surveys: [],
            documents: [],
            notes,
            source: "google_sheets" as const,
          };
        }

        const [surveys, documents, notes] = await Promise.all([
          sheets.getSurveysByClientId(id),
          sheets.getDocumentsByClientId(id),
          sheets.getNotesByClientId(id),
        ]);

        return { client, surveys, documents, notes, source: "google_sheets" as const };
      }

      return getDemoClientDetail(id);
    },
  );
}

export async function getFilterOptions(): Promise<{
  managers: string[];
  countries: string[];
  source: ClientsListResult["source"];
}> {
  return withPostgresOrLegacy(
    "getFilterOptions",
    async () => {
      const options = await sbClients.sbGetFilterOptions();
      return {
        managers: options.managers,
        countries: options.countries,
        source: toApiSource("postgresql"),
      };
    },
    async () => {
      const all = sheetsConfigured()
        ? await getGoogleSheetsClient().getClients()
        : DEMO_CLIENTS;

      const managers = [...new Set(all.map((c) => c.manager).filter(Boolean))].sort();
      const countries = [...new Set(all.map((c) => c.country).filter(Boolean))].sort();

      return {
        managers,
        countries,
        source: sheetsConfigured() ? "google_sheets" : "demo",
      };
    },
  );
}

export async function createClient(
  input: CreateClientInput,
  user: SessionUser,
): Promise<Client> {
  if (!canCreateClient(user)) {
    throw new CrmAccessError("Forbidden");
  }

  const validated = validateCreateClientInput(input);

  if (!isCrmPostgresPrimary()) {
    throw new CrmStorageError("CRM PostgreSQL is not configured");
  }

  try {
    const externalId =
      validated.externalId ?? (await sbClients.sbNextDemoExternalId());
    const payload = sbClients.buildInsertFromCreateInput(validated, externalId);
    payload.assigned_user_id = validated.assignedUserId ?? user.id;
    if (!payload.assigned_manager_name) {
      payload.assigned_manager_name = user.name;
    }
    // Staff-created CRM clients (not intake bridge) — visible in База and Finance.
    payload.source = "crm";
    payload.is_demo = false;

    const created = await sbClients.sbInsertClient(payload);

    // Finance lists all CRM clients; also seed an empty profile for a clear no_contract row.
    try {
      const uuid = await sbClients.sbGetClientUuidByExternalId(created.id);
      if (uuid) {
        const { sbEnsureEmptyFinanceProfile } = await import(
          "@/lib/finance/supabase-finance-repo"
        );
        await sbEnsureEmptyFinanceProfile(uuid, user.id);
      }
    } catch (financeError) {
      console.error("[crm-store] finance profile ensure failed", financeError);
    }

    return created;
  } catch (error) {
    if (sbClients.isDuplicateExternalIdError(error)) {
      throw new ClientValidationError("Client with this ID already exists");
    }
    console.error("[crm-store] createClient failed", error);
    throw new CrmStorageError("Failed to create client");
  }
}

export async function updateClient(
  externalId: string,
  input: UpdateClientInput,
  user: SessionUser,
): Promise<Client> {
  if (!canUpdateClient(user)) {
    throw new CrmAccessError("Forbidden");
  }

  const validated = validateUpdateClientInput(input);

  if (!isCrmPostgresPrimary()) {
    throw new CrmStorageError("CRM PostgreSQL is not configured");
  }

  try {
    const updated = await sbClients.sbUpdateClientByExternalId(
      externalId,
      validated,
    );
    if (!updated) {
      throw new CrmStorageError("Client not found");
    }
    return updated;
  } catch (error) {
    if (error instanceof CrmStorageError) throw error;
    console.error("[crm-store] updateClient failed", error);
    throw new CrmStorageError("Failed to update client");
  }
}

export async function archiveClient(
  externalId: string,
  user: SessionUser,
): Promise<boolean> {
  if (!canArchiveClient(user)) {
    throw new CrmAccessError("Forbidden");
  }

  if (!isCrmPostgresPrimary()) {
    throw new CrmStorageError("CRM PostgreSQL is not configured");
  }

  try {
    const ok = await sbClients.sbArchiveClientByExternalId(externalId);
    if (!ok) throw new CrmStorageError("Client not found");
    return true;
  } catch (error) {
    if (error instanceof CrmStorageError || error instanceof CrmAccessError) {
      throw error;
    }
    console.error("[crm-store] archiveClient failed", error);
    throw new CrmStorageError("Failed to archive client");
  }
}

export async function addClientNote(
  clientId: string,
  author: string,
  text: string,
  user?: SessionUser,
): Promise<boolean> {
  if (isCrmPostgresPrimary()) {
    if (!user) return false;
    try {
      const { createClientNote } = await import("@/lib/clients/client-notes-store");
      await createClientNote(clientId, user, text);
      return true;
    } catch (error) {
      console.error("[crm-store] addClientNote postgres failed", error);
      return false;
    }
  }

  if (sheetsConfigured()) {
    if (isGoogleSheetsPublicClientsConfigured()) {
      return appendLocalNote(clientId, author, text);
    }
    return getGoogleSheetsClient().appendNote(clientId, author, text);
  }

  appendDemoNote(clientId, author, text);
  return true;
}

export async function updateClientNote(
  noteId: string,
  clientId: string,
  text: string,
  rowIndex?: number,
  user?: SessionUser,
): Promise<boolean> {
  if (isCrmPostgresPrimary()) {
    if (!user) return false;
    try {
      const { updateClientNote: updateNoteInPostgres } = await import(
        "@/lib/clients/client-notes-store"
      );
      await updateNoteInPostgres(clientId, noteId, user, text);
      return true;
    } catch (error) {
      console.error("[crm-store] updateClientNote postgres failed", error);
      return false;
    }
  }

  if (sheetsConfigured()) {
    if (isGoogleSheetsPublicClientsConfigured()) {
      return updateLocalNote(noteId, clientId, text);
    }
    if (rowIndex) {
      return getGoogleSheetsClient().updateNote(rowIndex, text);
    }
    return false;
  }

  void noteId;
  void clientId;
  return true;
}

export { buildClientAiContext } from "@/lib/clients/ai-context";
