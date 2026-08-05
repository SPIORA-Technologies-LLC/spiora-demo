import "server-only";

/**
 * Low-level Finance SQL/RPC access via service-role admin client.
 *
 * Actor params (p_actor_id / p_actor_name) are supplied only from the trusted
 * Next.js session after app-layer RBAC — never from the browser. See checklist
 * technical debt: migrate RPCs to auth.uid()-derived actor when Auth cutover
 * allows it.
 */
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { sbGetClientUuidByExternalId } from "@/lib/supabase/clients-repo";
import { escapeIlikePattern } from "@/lib/clients/validation";
import type { FinanceDashboardKpis } from "./calculations";
import { assertSafeCents } from "./validation";

export type FinanceProfileRow = {
  id: string;
  client_id: string;
  currency_code: string;
  contract_amount_cents: number | string | null;
  contract_date: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  archived_at: string | null;
};

export type FinancePaymentRow = {
  id: string;
  finance_profile_id: string;
  client_id: string;
  amount_cents: number | string;
  currency_code: string;
  payment_date: string;
  comment: string | null;
  created_by: string;
  created_by_name: string;
  created_at: string;
  voided_at: string | null;
  voided_by: string | null;
  voided_by_name: string | null;
  void_reason: string | null;
  idempotency_key: string | null;
};

export type FinanceChangeRow = {
  id: string;
  finance_profile_id: string;
  client_id: string;
  change_type: string;
  old_contract_amount_cents: number | string | null;
  new_contract_amount_cents: number | string | null;
  old_contract_date: string | null;
  new_contract_date: string | null;
  reason: string;
  changed_by: string;
  changed_by_name: string;
  created_at: string;
};

export type FinanceClientJoinRow = {
  external_id: string;
  full_name: string;
  email: string;
  direction: string | null;
  assigned_manager_name: string | null;
  contract_date: string | null;
  contract_amount_cents: number | string | null;
  paid_cents: number | string;
  last_payment_date: string | null;
};

export async function sbFinanceResolveClientUuid(
  clientExternalId: string,
): Promise<string | null> {
  return sbGetClientUuidByExternalId(clientExternalId);
}

export async function sbFinanceLoadClientBundle(clientUuid: string): Promise<{
  profile: FinanceProfileRow | null;
  payments: FinancePaymentRow[];
  changes: FinanceChangeRow[];
}> {
  const admin = getSupabaseAdmin();

  const { data: profile, error: profileError } = await admin
    .from("client_finance_profiles")
    .select("*")
    .eq("client_id", clientUuid)
    .is("archived_at", null)
    .maybeSingle();
  if (profileError) throw profileError;

  if (!profile) {
    return { profile: null, payments: [], changes: [] };
  }

  const profileId = (profile as FinanceProfileRow).id;

  const [{ data: payments, error: payError }, { data: changes, error: chError }] =
    await Promise.all([
      admin
        .from("client_finance_payments")
        .select("*")
        .eq("finance_profile_id", profileId)
        .order("payment_date", { ascending: false })
        .order("created_at", { ascending: false }),
      admin
        .from("client_finance_contract_changes")
        .select("*")
        .eq("finance_profile_id", profileId)
        .order("created_at", { ascending: false }),
    ]);

  if (payError) throw payError;
  if (chError) throw chError;

  return {
    profile: profile as FinanceProfileRow,
    payments: (payments ?? []) as FinancePaymentRow[],
    changes: (changes ?? []) as FinanceChangeRow[],
  };
}

export async function sbFinanceListClientRows(filters: {
  search?: string;
  direction?: string;
}): Promise<FinanceClientJoinRow[]> {
  const admin = getSupabaseAdmin();

  let clientsQuery = admin
    .from("clients")
    .select(
      "id, external_id, full_name, email, direction, assigned_manager_name",
    )
    .is("archived_at", null);

  const search = filters.search?.trim();
  if (search) {
    const pattern = `%${escapeIlikePattern(search)}%`;
    clientsQuery = clientsQuery.or(
      [
        `full_name.ilike.${pattern}`,
        `email.ilike.${pattern}`,
        `external_id.ilike.${pattern}`,
      ].join(","),
    );
  }

  // Direction alias filtering (Spain/Испания/…) is applied in the store layer.
  void filters.direction;

  const { data: clients, error: clientsError } = await clientsQuery;
  if (clientsError) throw clientsError;
  const clientRows = (clients ?? []) as Array<{
    id: string;
    external_id: string;
    full_name: string;
    email: string;
    direction: string | null;
    assigned_manager_name: string | null;
  }>;

  if (clientRows.length === 0) return [];

  const { data: profiles, error: profilesError } = await admin
    .from("client_finance_profiles")
    .select("id, client_id, contract_amount_cents, contract_date")
    .is("archived_at", null)
    .in(
      "client_id",
      clientRows.map((c) => c.id),
    );
  if (profilesError) throw profilesError;

  const profileByClient = new Map(
    ((profiles ?? []) as Array<{
      id: string;
      client_id: string;
      contract_amount_cents: number | string | null;
      contract_date: string | null;
    }>).map((p) => [p.client_id, p]),
  );

  const profileIds = [...profileByClient.values()].map((p) => p.id);
  const paidByProfile = new Map<
    string,
    { paid: number; lastPaymentDate: string | null }
  >();

  if (profileIds.length > 0) {
    const { data: payments, error: paymentsError } = await admin
      .from("client_finance_payments")
      .select("finance_profile_id, amount_cents, payment_date")
      .is("voided_at", null)
      .in("finance_profile_id", profileIds);
    if (paymentsError) throw paymentsError;

    for (const pay of (payments ?? []) as Array<{
      finance_profile_id: string;
      amount_cents: number | string;
      payment_date: string;
    }>) {
      const prev = paidByProfile.get(pay.finance_profile_id) ?? {
        paid: 0,
        lastPaymentDate: null as string | null,
      };
      prev.paid += assertSafeCents(pay.amount_cents);
      if (
        !prev.lastPaymentDate ||
        pay.payment_date > prev.lastPaymentDate
      ) {
        prev.lastPaymentDate = pay.payment_date;
      }
      paidByProfile.set(pay.finance_profile_id, prev);
    }
  }

  return clientRows.map((c) => {
    const profile = profileByClient.get(c.id);
    const paid = profile
      ? (paidByProfile.get(profile.id) ?? {
          paid: 0,
          lastPaymentDate: null,
        })
      : { paid: 0, lastPaymentDate: null };
    return {
      external_id: c.external_id,
      full_name: c.full_name,
      email: c.email,
      direction: c.direction,
      assigned_manager_name: c.assigned_manager_name,
      contract_date: profile?.contract_date ?? null,
      contract_amount_cents: profile?.contract_amount_cents ?? null,
      paid_cents: paid.paid,
      last_payment_date: paid.lastPaymentDate,
    };
  });
}

export async function sbFinanceDashboardSummary(): Promise<FinanceDashboardKpis> {
  const { data, error } = await getSupabaseAdmin().rpc(
    "spiora_finance_dashboard_summary",
  );
  if (error) throw error;
  const row = (data ?? {}) as Record<string, unknown>;
  return {
    totalContractsCents: assertSafeCents(row.totalContractsCents ?? 0),
    totalReceivedCents: assertSafeCents(row.totalReceivedCents ?? 0),
    totalDebtCents: assertSafeCents(row.totalDebtCents ?? 0),
    clientsWithDebt: Number(row.clientsWithDebt ?? 0),
  };
}

/** Idempotent stub profile so CRM-created clients are ready in Finance. */
export async function sbEnsureEmptyFinanceProfile(
  clientUuid: string,
  actorId: string | null,
): Promise<void> {
  const admin = getSupabaseAdmin();
  const { data: existing, error: findError } = await admin
    .from("client_finance_profiles")
    .select("id")
    .eq("client_id", clientUuid)
    .is("archived_at", null)
    .maybeSingle();
  if (findError) throw findError;
  if (existing) return;

  const { error } = await admin.from("client_finance_profiles").insert({
    client_id: clientUuid,
    currency_code: "EUR",
    contract_amount_cents: null,
    contract_date: null,
    created_by: actorId,
    updated_by: actorId,
  });
  if (error) {
    // Concurrent create of the same active profile
    if ((error as { code?: string }).code === "23505") return;
    throw error;
  }
}

export async function sbFinanceGetAnalytics(input: {
  year: number;
  month: number | null;
  direction: string | null;
}): Promise<{
  contractsSignedCents: number | string;
  newClientsCount: number;
  receivedCents: number | string;
  paymentsCount: number;
  monthly: Array<{
    month: number;
    labelKey: string;
    receivedCents: number | string;
    contractsSignedCents: number | string;
  }>;
}> {
  const { data, error } = await getSupabaseAdmin().rpc(
    "spiora_finance_analytics",
    {
      p_year: input.year,
      p_month: input.month,
      p_direction: input.direction,
    },
  );
  if (error) throw error;
  return (data ?? {
    contractsSignedCents: 0,
    newClientsCount: 0,
    receivedCents: 0,
    paymentsCount: 0,
    monthly: [],
  }) as {
    contractsSignedCents: number | string;
    newClientsCount: number;
    receivedCents: number | string;
    paymentsCount: number;
    monthly: Array<{
      month: number;
      labelKey: string;
      receivedCents: number | string;
      contractsSignedCents: number | string;
    }>;
  };
}

function throwRpc(error: { message?: string; code?: string }): never {
  throw Object.assign(new Error(error.message ?? "Finance RPC error"), {
    code: error.code,
  });
}

export async function sbFinanceCreateContract(input: {
  clientUuid: string;
  amountCents: number;
  contractDate: string;
  actorId: string;
  actorName: string;
}): Promise<string> {
  const { data, error } = await getSupabaseAdmin().rpc(
    "spiora_finance_create_contract",
    {
      p_client_id: input.clientUuid,
      p_amount_cents: input.amountCents,
      p_contract_date: input.contractDate,
      p_actor_id: input.actorId,
      p_actor_name: input.actorName,
    },
  );
  if (error) throwRpc(error);
  return String(data);
}

export async function sbFinanceChangeContract(input: {
  clientUuid: string;
  amountCents: number | null;
  contractDate: string | null;
  reason: string;
  expectedVersion: number | null;
  actorId: string;
  actorName: string;
}): Promise<string> {
  const { data, error } = await getSupabaseAdmin().rpc(
    "spiora_finance_change_contract",
    {
      p_client_id: input.clientUuid,
      p_amount_cents: input.amountCents,
      p_contract_date: input.contractDate,
      p_reason: input.reason,
      p_expected_version: input.expectedVersion,
      p_actor_id: input.actorId,
      p_actor_name: input.actorName,
    },
  );
  if (error) throwRpc(error);
  return String(data);
}

export async function sbFinanceCreatePayment(input: {
  clientUuid: string;
  amountCents: number;
  paymentDate: string;
  comment: string | null;
  idempotencyKey: string;
  actorId: string;
  actorName: string;
}): Promise<string> {
  const { data, error } = await getSupabaseAdmin().rpc(
    "spiora_finance_create_payment",
    {
      p_client_id: input.clientUuid,
      p_amount_cents: input.amountCents,
      p_payment_date: input.paymentDate,
      p_comment: input.comment,
      p_idempotency_key: input.idempotencyKey,
      p_actor_id: input.actorId,
      p_actor_name: input.actorName,
    },
  );
  if (error) {
    // Concurrent duplicate insert races map to idempotent success via re-read.
    if (
      error.message?.includes("client_finance_payments_idempotency") ||
      error.code === "23505"
    ) {
      const admin = getSupabaseAdmin();
      const { data: profile } = await admin
        .from("client_finance_profiles")
        .select("id")
        .eq("client_id", input.clientUuid)
        .is("archived_at", null)
        .maybeSingle();
      if (profile) {
        const { data: existing } = await admin
          .from("client_finance_payments")
          .select("id")
          .eq("finance_profile_id", (profile as { id: string }).id)
          .eq("idempotency_key", input.idempotencyKey)
          .is("voided_at", null)
          .maybeSingle();
        if (existing) return String((existing as { id: string }).id);
      }
    }
    throwRpc(error);
  }
  return String(data);
}

export async function sbFinanceVoidPayment(input: {
  clientUuid: string;
  paymentId: string;
  reason: string;
  actorId: string;
  actorName: string;
}): Promise<string> {
  const { data, error } = await getSupabaseAdmin().rpc(
    "spiora_finance_void_payment",
    {
      p_client_id: input.clientUuid,
      p_payment_id: input.paymentId,
      p_reason: input.reason,
      p_actor_id: input.actorId,
      p_actor_name: input.actorName,
    },
  );
  if (error) throwRpc(error);
  return String(data);
}
