import "server-only";

import { getSupabaseAdmin } from "./server";
import type { ClientFilters } from "@/lib/google-sheets/types";
import {
  escapeIlikePattern,
  buildLegacyFieldsRecord,
  CLIENT_LEGACY_FIELD_KEYS,
  type CreateClientInput,
  type UpdateClientInput,
} from "@/lib/clients/validation";
import {
  mapClientRowToClient,
  splitFullName,
  type ClientInsertPayload,
  type ClientRow,
} from "@/lib/clients/map";
import type { Client } from "@/lib/google-sheets/types";

export type ClientsListQuery = {
  page: number;
  pageSize: number;
  filters: ClientFilters;
  includeArchived?: boolean;
};

export type ClientsListDbResult = {
  items: Client[];
  total: number;
};

function normalizeLegacyFields(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as Record<string, unknown>;
}

function mapRow(row: ClientRow): Client {
  return mapClientRowToClient({
    ...row,
    legacy_fields: normalizeLegacyFields(row.legacy_fields),
  });
}

function applyFiltersQuery(
  query: ReturnType<ReturnType<typeof getSupabaseAdmin>["from"]>,
  filters: ClientFilters,
  includeArchived: boolean,
) {
  let q = query.select("*", { count: "exact" });

  if (!includeArchived) {
    q = q.is("archived_at", null);
  }

  if (filters.direction) q = q.eq("direction", filters.direction);
  if (filters.status) q = q.eq("status", filters.status);
  if (filters.manager) q = q.eq("assigned_manager_name", filters.manager);
  if (filters.country) q = q.eq("country", filters.country);

  const search = filters.search?.trim();
  if (search) {
    const pattern = `%${escapeIlikePattern(search)}%`;
    q = q.or(
      [
        `full_name.ilike.${pattern}`,
        `email.ilike.${pattern}`,
        `external_id.ilike.${pattern}`,
        `phone.ilike.${pattern}`,
        `passport_number.ilike.${pattern}`,
        `assigned_manager_name.ilike.${pattern}`,
        `citizenship.ilike.${pattern}`,
        `country.ilike.${pattern}`,
      ].join(","),
    );
  }

  return q;
}

export async function sbListClients(
  query: ClientsListQuery,
): Promise<ClientsListDbResult> {
  const { page, pageSize, filters, includeArchived = false } = query;
  const start = (page - 1) * pageSize;

  const base = getSupabaseAdmin().from("clients");
  const { data, error, count } = await applyFiltersQuery(
    base,
    filters,
    includeArchived,
  )
    .order("updated_at", { ascending: false })
    .range(start, start + pageSize - 1);

  if (error) throw error;

  return {
    items: ((data ?? []) as ClientRow[]).map(mapRow),
    total: count ?? 0,
  };
}

export async function sbGetClientUuidByExternalId(
  externalId: string,
): Promise<string | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("clients")
    .select("id")
    .eq("external_id", externalId)
    .is("archived_at", null)
    .maybeSingle();

  if (error) throw error;
  return data ? String((data as { id: string }).id) : null;
}

export async function sbGetClientByUuid(
  clientUuid: string,
): Promise<Client | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("clients")
    .select("*")
    .eq("id", clientUuid)
    .is("archived_at", null)
    .maybeSingle();

  if (error) throw error;
  return data ? mapRow(data as ClientRow) : null;
}

/** Find active CRM client by email (case-insensitive). */
export async function sbFindClientByEmail(
  email: string,
): Promise<Client | null> {
  const trimmed = email.trim();
  if (!trimmed) return null;
  const { data, error } = await getSupabaseAdmin()
    .from("clients")
    .select("*")
    .ilike("email", trimmed)
    .is("archived_at", null)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ? mapRow(data as ClientRow) : null;
}

export async function sbGetClientByExternalId(
  externalId: string,
): Promise<Client | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("clients")
    .select("*")
    .eq("external_id", externalId)
    .is("archived_at", null)
    .maybeSingle();

  if (error) throw error;
  return data ? mapRow(data as ClientRow) : null;
}

export async function sbGetClientByExternalIdIncludingArchived(
  externalId: string,
): Promise<Client | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("clients")
    .select("*")
    .eq("external_id", externalId)
    .maybeSingle();

  if (error) throw error;
  return data ? mapRow(data as ClientRow) : null;
}

export async function sbInsertClient(
  payload: ClientInsertPayload,
): Promise<Client> {
  const now = new Date().toISOString();
  const { data, error } = await getSupabaseAdmin()
    .from("clients")
    .insert({
      ...payload,
      updated_at: now,
      last_activity_at: payload.last_activity_at ?? now,
    })
    .select("*")
    .single();

  if (error) throw error;
  return mapRow(data as ClientRow);
}

export async function sbUpdateClientByExternalId(
  externalId: string,
  input: UpdateClientInput,
): Promise<Client | null> {
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    last_activity_at: new Date().toISOString(),
  };

  if (input.name !== undefined) {
    const { firstName, lastName } = splitFullName(input.name);
    patch.full_name = input.name;
    patch.first_name = firstName;
    patch.last_name = lastName;
  }
  if (input.email !== undefined) patch.email = input.email;
  if (input.phone !== undefined) patch.phone = input.phone;
  if (input.country !== undefined) patch.country = input.country;
  if (input.citizenship !== undefined) patch.citizenship = input.citizenship;
  if (input.direction !== undefined) {
    patch.direction = input.direction;
    if (input.serviceType === undefined) patch.service_type = input.direction;
  }
  if (input.status !== undefined) patch.status = input.status;
  if (input.pipelineStage !== undefined) patch.pipeline_stage = input.pipelineStage;
  if (input.manager !== undefined) patch.assigned_manager_name = input.manager;
  if (input.assignedUserId !== undefined) {
    patch.assigned_user_id = input.assignedUserId || null;
  }
  if (input.serviceType !== undefined) patch.service_type = input.serviceType;
  if (input.passportNumber !== undefined) {
    patch.passport_number = input.passportNumber || null;
  }
  if (input.notesSummary !== undefined) patch.notes_summary = input.notesSummary;

  const legacyPatchKeys = CLIENT_LEGACY_FIELD_KEYS.filter(
    (key) => input[key] !== undefined,
  );
  if (legacyPatchKeys.length > 0) {
    const { data: existing, error: existingError } = await getSupabaseAdmin()
      .from("clients")
      .select("legacy_fields")
      .eq("external_id", externalId)
      .is("archived_at", null)
      .maybeSingle();
    if (existingError) throw existingError;

    const current = normalizeLegacyFields(
      (existing as { legacy_fields?: unknown } | null)?.legacy_fields,
    );
    const next = { ...current };
    for (const key of legacyPatchKeys) {
      const value = input[key];
      if (typeof value === "string" && value.trim()) {
        next[key] = value.trim();
      } else {
        delete next[key];
      }
    }
    patch.legacy_fields = next;

    if (
      input.manager === undefined &&
      typeof input.referentName === "string" &&
      input.referentName.trim()
    ) {
      patch.assigned_manager_name = input.referentName.trim();
    }
  }

  const { data, error } = await getSupabaseAdmin()
    .from("clients")
    .update(patch)
    .eq("external_id", externalId)
    .is("archived_at", null)
    .select("*")
    .maybeSingle();

  if (error) throw error;
  return data ? mapRow(data as ClientRow) : null;
}

export async function sbArchiveClientByExternalId(
  externalId: string,
): Promise<boolean> {
  const now = new Date().toISOString();
  const { data, error } = await getSupabaseAdmin()
    .from("clients")
    .update({ archived_at: now, updated_at: now })
    .eq("external_id", externalId)
    .is("archived_at", null)
    .select("id")
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
}

export async function sbGetFilterOptions(): Promise<{
  managers: string[];
  countries: string[];
  statuses: string[];
  directions: string[];
  pipelineStages: string[];
  serviceTypes: string[];
}> {
  const { data, error } = await getSupabaseAdmin()
    .from("clients")
    .select(
      "assigned_manager_name, country, status, direction, pipeline_stage, service_type",
    )
    .is("archived_at", null);

  if (error) throw error;

  const rows = (data ?? []) as Array<{
    assigned_manager_name: string;
    country: string;
    status: string;
    direction: string;
    pipeline_stage: string;
    service_type: string;
  }>;

  const unique = (values: string[]) =>
    [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));

  return {
    managers: unique(rows.map((r) => r.assigned_manager_name)),
    countries: unique(rows.map((r) => r.country)),
    statuses: unique(rows.map((r) => r.status)),
    directions: unique(rows.map((r) => r.direction)),
    pipelineStages: unique(rows.map((r) => r.pipeline_stage)),
    serviceTypes: unique(rows.map((r) => r.service_type)),
  };
}

export async function sbNextDemoExternalId(): Promise<string> {
  const { data, error } = await getSupabaseAdmin()
    .from("clients")
    .select("external_id")
    .like("external_id", "DEMO-%")
    .order("external_id", { ascending: false })
    .limit(1);

  if (error) throw error;

  const latest = (data?.[0] as { external_id?: string } | undefined)?.external_id;
  const match = latest?.match(/^DEMO-(\d+)$/);
  const next = match ? Number.parseInt(match[1], 10) + 1 : 1001;
  return `DEMO-${next}`;
}

export async function sbCountActiveClients(): Promise<number> {
  const { count, error } = await getSupabaseAdmin()
    .from("clients")
    .select("*", { count: "exact", head: true })
    .is("archived_at", null);

  if (error) throw error;
  return count ?? 0;
}

export function buildInsertFromCreateInput(
  input: CreateClientInput,
  externalId: string,
): ClientInsertPayload {
  const { firstName, lastName } = splitFullName(input.name);
  return {
    external_id: externalId,
    first_name: firstName,
    last_name: lastName,
    full_name: input.name,
    email: input.email ?? "",
    phone: input.phone ?? "",
    status: input.status ?? "New",
    pipeline_stage: input.pipelineStage ?? "Intake",
    assigned_user_id: input.assignedUserId ?? null,
    assigned_manager_name: input.manager ?? "",
    country: input.country ?? "",
    citizenship: input.citizenship ?? "",
    direction: input.direction ?? "",
    service_type: input.serviceType ?? input.direction ?? "",
    source: "demo",
    notes_summary: input.notesSummary ?? "",
    passport_number: input.passportNumber ?? null,
    last_activity_at: new Date().toISOString(),
    is_demo: true,
    legacy_fields: buildLegacyFieldsRecord(input),
  };
}

export function isDuplicateExternalIdError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: string }).code;
  return code === "23505";
}
