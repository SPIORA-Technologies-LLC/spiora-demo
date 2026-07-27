/**
 * Supabase Finance persistence (production/staging).
 *
 * TECHNICAL DEBT: mutation RPCs still accept p_actor_id from this trusted
 * server layer (session after canManageFinance). Ideal: derive actor inside
 * RPC from auth.uid() once employee Auth mapping is complete. See
 * SPIORA_FINANCE_CUTOVER_CHECKLIST_036.md § Technical debt.
 *
 * FOLLOW-UP PR #33.2: push listClients filter/sort/pagination into SQL/RPC
 * so the server does not materialize the full client set.
 */
import "server-only";

import type { SessionUser } from "@/lib/auth/types";
import { getClientDetail } from "@/lib/clients/store";
import { calculateClientFinance } from "./calculations";
import { normalizeFinanceDirection, matchesDirectionFilter } from "./directions";
import { FinanceError } from "./errors";
import { FINANCE_CURRENCY_CODE } from "./money";
import type {
  ChangeContractInput,
  CreateContractInput,
  CreatePaymentInput,
  FinanceAnalyticsQuery,
  FinanceClientsQuery,
  FinanceStore,
  VoidPaymentInput,
} from "./store";
import type {
  FinanceAnalyticsResult,
  FinanceClientDetail,
  FinanceClientListItem,
  FinanceContractChangeRecord,
  FinancePaymentRecord,
  FinanceProfileRecord,
} from "./types";
import { assertSafeCents } from "./validation";
import {
  sbFinanceChangeContract,
  sbFinanceCreateContract,
  sbFinanceCreatePayment,
  sbFinanceDashboardSummary,
  sbFinanceGetAnalytics,
  sbFinanceListClientRows,
  sbFinanceLoadClientBundle,
  sbFinanceResolveClientUuid,
  sbFinanceVoidPayment,
  type FinanceClientJoinRow,
} from "./supabase-finance-repo";

function mapStatus(row: {
  contract_amount_cents: number | string | null;
  paid_cents: number | string | null;
}): ReturnType<typeof calculateClientFinance> {
  const contract =
    row.contract_amount_cents == null
      ? null
      : assertSafeCents(row.contract_amount_cents);
  const paid = assertSafeCents(row.paid_cents ?? 0);
  return calculateClientFinance(contract, paid);
}

function toProfile(
  row: {
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
  },
  clientExternalId: string,
): FinanceProfileRecord {
  return {
    id: row.id,
    clientExternalId,
    clientUuid: row.client_id,
    currencyCode: FINANCE_CURRENCY_CODE,
    contractAmountCents:
      row.contract_amount_cents == null
        ? null
        : assertSafeCents(row.contract_amount_cents),
    contractDate: row.contract_date,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    archivedAt: row.archived_at,
  };
}

async function buildClientDetail(
  actor: SessionUser,
  clientExternalId: string,
): Promise<FinanceClientDetail> {
  const detail = await getClientDetail(clientExternalId);
  if (!detail) {
    throw new FinanceError("FINANCE_CLIENT_NOT_FOUND", "Client not found", 404);
  }
  const clientUuid = await sbFinanceResolveClientUuid(clientExternalId);
  if (!clientUuid) {
    throw new FinanceError("FINANCE_CLIENT_NOT_FOUND", "Client not found", 404);
  }
  const bundle = await sbFinanceLoadClientBundle(clientUuid);
  const profile = bundle.profile
    ? toProfile(bundle.profile, clientExternalId)
    : null;
  const paid = bundle.payments
    .filter((p) => !p.voided_at)
    .reduce((sum, p) => sum + assertSafeCents(p.amount_cents), 0);
  const summary = calculateClientFinance(
    profile?.contractAmountCents ?? null,
    paid,
  );
  const payments: FinancePaymentRecord[] = bundle.payments.map((p) => ({
    id: p.id,
    financeProfileId: p.finance_profile_id,
    clientExternalId,
    amountCents: assertSafeCents(p.amount_cents),
    currencyCode: FINANCE_CURRENCY_CODE,
    paymentDate: p.payment_date,
    comment: p.comment,
    createdBy: p.created_by,
    createdByName: p.created_by_name || p.created_by,
    createdAt: p.created_at,
    voidedAt: p.voided_at,
    voidedBy: p.voided_by,
    voidedByName: p.voided_by_name,
    voidReason: p.void_reason,
    idempotencyKey: p.idempotency_key,
  }));
  const contractChanges: FinanceContractChangeRecord[] = bundle.changes.map(
    (c) => ({
      id: c.id,
      financeProfileId: c.finance_profile_id,
      clientExternalId,
      changeType: c.change_type as FinanceContractChangeRecord["changeType"],
      oldContractAmountCents:
        c.old_contract_amount_cents == null
          ? null
          : assertSafeCents(c.old_contract_amount_cents),
      newContractAmountCents:
        c.new_contract_amount_cents == null
          ? null
          : assertSafeCents(c.new_contract_amount_cents),
      oldContractDate: c.old_contract_date,
      newContractDate: c.new_contract_date,
      reason: c.reason,
      changedBy: c.changed_by,
      changedByName: c.changed_by_name || c.changed_by,
      createdAt: c.created_at,
    }),
  );

  void actor;
  return {
    clientExternalId: detail.client.id,
    clientName: detail.client.name,
    clientEmail: detail.client.email,
    direction: detail.client.direction,
    directionNormalized: normalizeFinanceDirection(detail.client.direction),
    profile,
    summary,
    payments,
    contractChanges,
  };
}

function mapRpcError(error: { message?: string }): never {
  const msg = error.message ?? "";
  const codes = [
    "FINANCE_CONTRACT_ALREADY_EXISTS",
    "FINANCE_CONCURRENT_MODIFICATION",
    "FINANCE_CONTRACT_NOT_SET",
    "FINANCE_CLIENT_NOT_FOUND",
    "FINANCE_PAYMENT_AMOUNT_INVALID",
    "FINANCE_PAYMENT_DATE_INVALID",
    "FINANCE_CHANGE_REASON_REQUIRED",
    "FINANCE_AMOUNT_UNCHANGED",
    "FINANCE_IDEMPOTENCY_REQUIRED",
    "FINANCE_PAYMENT_NOT_FOUND",
  ] as const;
  for (const code of codes) {
    if (msg.includes(code)) {
      throw new FinanceError(
        code,
        msg,
        code === "FINANCE_CONCURRENT_MODIFICATION" ||
          code === "FINANCE_CONTRACT_ALREADY_EXISTS"
          ? 409
          : 400,
      );
    }
  }
  throw new FinanceError("FINANCE_STORE_UNAVAILABLE", msg || "Finance DB error", 503);
}

export function createSupabaseFinanceStore(): FinanceStore {
  return {
    async getSummary() {
      return sbFinanceDashboardSummary();
    },

    async listClients(_actor, query: FinanceClientsQuery) {
      const page = Math.max(1, query.page ?? 1);
      const limit = Math.min(100, Math.max(1, query.limit ?? 20));
      const rows = await sbFinanceListClientRows({
        search: query.search,
        direction: query.direction,
      });

      let items: FinanceClientListItem[] = rows.map((row: FinanceClientJoinRow) => {
        const summary = mapStatus(row);
        return {
          clientExternalId: row.external_id,
          clientName: row.full_name,
          clientEmail: row.email || "—",
          direction: row.direction || "—",
          directionNormalized: normalizeFinanceDirection(row.direction),
          manager: row.assigned_manager_name || "—",
          contractDate: row.contract_date,
          contractAmountCents: summary.contractAmountCents,
          paidAmountCents: summary.paidAmountCents,
          balanceCents: summary.balanceCents,
          overpaymentCents: summary.overpaymentCents,
          paymentStatus: summary.paymentStatus,
          lastPaymentDate: row.last_payment_date,
        };
      });

      const statusFilter = query.paymentStatus ?? "all";
      if (statusFilter !== "all") {
        items = items.filter((i) => i.paymentStatus === statusFilter);
      }

      // Direction already filtered in SQL when possible; keep none/all safety
      if (query.direction && query.direction !== "all") {
        items = items.filter((i) =>
          matchesDirectionFilter(i.direction, query.direction),
        );
      }

      const sort = query.sort ?? "name";
      items.sort((a, b) => {
        switch (sort) {
          case "balance":
            return (b.balanceCents ?? -1) - (a.balanceCents ?? -1);
          case "contractDate":
            return (b.contractDate ?? "").localeCompare(a.contractDate ?? "");
          case "lastPayment":
            return (b.lastPaymentDate ?? "").localeCompare(
              a.lastPaymentDate ?? "",
            );
          default:
            return a.clientName.localeCompare(b.clientName, "en");
        }
      });

      const total = items.length;
      const start = (page - 1) * limit;
      return {
        items: items.slice(start, start + limit),
        total,
        page,
        limit,
      };
    },

    async getClientFinance(actor, clientExternalId) {
      return buildClientDetail(actor, clientExternalId);
    },

    async createContract(actor, clientExternalId, input: CreateContractInput) {
      const clientUuid = await sbFinanceResolveClientUuid(clientExternalId);
      if (!clientUuid) {
        throw new FinanceError(
          "FINANCE_CLIENT_NOT_FOUND",
          "Client not found",
          404,
        );
      }
      try {
        await sbFinanceCreateContract({
          clientUuid,
          amountCents: input.amountCents,
          contractDate: input.contractDate,
          actorId: actor.id,
          actorName: actor.name,
        });
      } catch (error) {
        mapRpcError(error as { message?: string });
      }
      return buildClientDetail(actor, clientExternalId);
    },

    async changeContract(actor, clientExternalId, input: ChangeContractInput) {
      const clientUuid = await sbFinanceResolveClientUuid(clientExternalId);
      if (!clientUuid) {
        throw new FinanceError(
          "FINANCE_CLIENT_NOT_FOUND",
          "Client not found",
          404,
        );
      }
      try {
        await sbFinanceChangeContract({
          clientUuid,
          amountCents: input.amountCents ?? null,
          contractDate: input.contractDate ?? null,
          reason: input.reason,
          expectedVersion: input.expectedVersion ?? null,
          actorId: actor.id,
          actorName: actor.name,
        });
      } catch (error) {
        mapRpcError(error as { message?: string });
      }
      return buildClientDetail(actor, clientExternalId);
    },

    async createPayment(actor, clientExternalId, input: CreatePaymentInput) {
      if (!input.idempotencyKey?.trim()) {
        throw new FinanceError(
          "FINANCE_IDEMPOTENCY_REQUIRED",
          "Idempotency key required",
        );
      }
      const clientUuid = await sbFinanceResolveClientUuid(clientExternalId);
      if (!clientUuid) {
        throw new FinanceError(
          "FINANCE_CLIENT_NOT_FOUND",
          "Client not found",
          404,
        );
      }
      try {
        await sbFinanceCreatePayment({
          clientUuid,
          amountCents: input.amountCents,
          paymentDate: input.paymentDate,
          comment: input.comment ?? null,
          idempotencyKey: input.idempotencyKey,
          actorId: actor.id,
          actorName: actor.name,
        });
      } catch (error) {
        mapRpcError(error as { message?: string });
      }
      return buildClientDetail(actor, clientExternalId);
    },

    async voidPayment(actor, clientExternalId, input: VoidPaymentInput) {
      const clientUuid = await sbFinanceResolveClientUuid(clientExternalId);
      if (!clientUuid) {
        throw new FinanceError(
          "FINANCE_CLIENT_NOT_FOUND",
          "Client not found",
          404,
        );
      }
      try {
        await sbFinanceVoidPayment({
          clientUuid,
          paymentId: input.paymentId,
          reason: input.reason,
          actorId: actor.id,
          actorName: actor.name,
        });
      } catch (error) {
        mapRpcError(error as { message?: string });
      }
      return buildClientDetail(actor, clientExternalId);
    },

    async getAnalytics(_actor, query: FinanceAnalyticsQuery) {
      const periodType = query.periodType ?? "year";
      const year = query.year ?? new Date().getFullYear();
      const month =
        periodType === "month"
          ? (query.month ?? new Date().getMonth() + 1)
          : null;
      const raw = await sbFinanceGetAnalytics({
        year,
        month,
        direction: query.direction ?? null,
      });
      const result: FinanceAnalyticsResult = {
        periodType,
        year,
        month,
        direction: query.direction ?? null,
        contractsSignedCents: assertSafeCents(raw.contractsSignedCents ?? 0),
        newClientsCount: Number(raw.newClientsCount ?? 0),
        receivedCents: assertSafeCents(raw.receivedCents ?? 0),
        paymentsCount: Number(raw.paymentsCount ?? 0),
        monthly: (raw.monthly ?? []).map((m) => ({
          month: m.month,
          labelKey: m.labelKey,
          receivedCents: assertSafeCents(m.receivedCents ?? 0),
          contractsSignedCents: assertSafeCents(m.contractsSignedCents ?? 0),
        })),
      };
      return result;
    },
  };
}
