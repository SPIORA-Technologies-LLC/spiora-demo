import "server-only";

import type { SessionUser } from "@/lib/auth/types";
import { listAllClients, getClientDetail } from "@/lib/clients/store";
import {
  calculateClientFinance,
  calculateDashboardKpis,
} from "./calculations";
import { normalizeFinanceDirection, matchesDirectionFilter } from "./directions";
import { FinanceError } from "./errors";
import {
  newFinanceId,
  readFinanceStore,
  writeFinanceStore,
  type FinanceStoreData,
} from "./demo-store";
import { FINANCE_CURRENCY_CODE } from "./money";
import type {
  FinanceAnalyticsResult,
  FinanceClientDetail,
  FinanceClientListItem,
  FinanceContractChangeRecord,
  FinancePaymentRecord,
  FinanceProfileRecord,
} from "./types";
import { validateContractDate, validatePaymentDate } from "./validation";
import type {
  ChangeContractInput,
  CreateContractInput,
  CreatePaymentInput,
  FinanceAnalyticsQuery,
  FinanceClientsQuery,
  FinanceStore,
  VoidPaymentInput,
} from "./store";

function activePayments(
  store: FinanceStoreData,
  profileId: string,
): FinancePaymentRecord[] {
  return store.payments.filter(
    (p) => p.financeProfileId === profileId && !p.voidedAt,
  );
}

function paidTotal(store: FinanceStoreData, profileId: string): number {
  return activePayments(store, profileId).reduce((sum, p) => sum + p.amountCents, 0);
}

function lastPaymentDate(
  store: FinanceStoreData,
  profileId: string,
): string | null {
  const dates = activePayments(store, profileId).map((p) => p.paymentDate);
  if (dates.length === 0) return null;
  return dates.sort().at(-1) ?? null;
}

function findActiveProfile(
  store: FinanceStoreData,
  clientExternalId: string,
): FinanceProfileRecord | undefined {
  return store.profiles.find(
    (p) => p.clientExternalId === clientExternalId && !p.archivedAt,
  );
}

function assertPositiveCents(amountCents: number): number {
  if (
    typeof amountCents !== "number" ||
    !Number.isInteger(amountCents) ||
    amountCents <= 0 ||
    !Number.isSafeInteger(amountCents)
  ) {
    throw new FinanceError(
      "FINANCE_PAYMENT_AMOUNT_INVALID",
      "Invalid amount",
    );
  }
  return amountCents;
}

export function createDemoFinanceStore(): FinanceStore {
  const storeApi: FinanceStore = {
    async getSummary(_actor) {
      const store = await readFinanceStore();
      const { items: clients } = await listAllClients();
      const activeClientIds = new Set(clients.map((c) => c.id));

      const rows = store.profiles
        .filter((p) => !p.archivedAt && activeClientIds.has(p.clientExternalId))
        .map((p) => ({
          contractAmountCents: p.contractAmountCents,
          paidAmountCents: paidTotal(store, p.id),
        }));

      return calculateDashboardKpis(rows);
    },

    async listClients(_actor, query: FinanceClientsQuery) {
      const store = await readFinanceStore();
      const { items: clients } = await listAllClients();
      const page = Math.max(1, query.page ?? 1);
      const limit = Math.min(100, Math.max(1, query.limit ?? 20));
      const search = query.search?.trim().toLowerCase() ?? "";
      const statusFilter = query.paymentStatus ?? "all";

      const items: FinanceClientListItem[] = [];

      for (const client of clients) {
        const profile = findActiveProfile(store, client.id);
        const paid = profile ? paidTotal(store, profile.id) : 0;
        const summary = calculateClientFinance(
          profile?.contractAmountCents ?? null,
          paid,
        );

        if (search) {
          const hay = `${client.name} ${client.email} ${client.id}`.toLowerCase();
          if (!hay.includes(search)) continue;
        }

        if (!matchesDirectionFilter(client.direction, query.direction)) continue;

        if (statusFilter !== "all" && summary.paymentStatus !== statusFilter) {
          continue;
        }

        items.push({
          clientExternalId: client.id,
          clientName: client.name,
          clientEmail: client.email,
          direction: client.direction,
          directionNormalized: normalizeFinanceDirection(client.direction),
          manager: client.manager,
          contractDate: profile?.contractDate ?? null,
          contractAmountCents: summary.contractAmountCents,
          paidAmountCents: summary.paidAmountCents,
          balanceCents: summary.balanceCents,
          overpaymentCents: summary.overpaymentCents,
          paymentStatus: summary.paymentStatus,
          lastPaymentDate: profile ? lastPaymentDate(store, profile.id) : null,
        });
      }

      const sort = query.sort ?? "name";
      items.sort((a, b) => {
        switch (sort) {
          case "balance":
            return (b.balanceCents ?? -1) - (a.balanceCents ?? -1);
          case "contractDate":
            return (b.contractDate ?? "").localeCompare(a.contractDate ?? "");
          case "lastPayment":
            return (b.lastPaymentDate ?? "").localeCompare(a.lastPaymentDate ?? "");
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

    async getClientFinance(_actor, clientExternalId) {
      const detail = await getClientDetail(clientExternalId);
      if (!detail) {
        throw new FinanceError("FINANCE_CLIENT_NOT_FOUND", "Client not found", 404);
      }
      const store = await readFinanceStore();
      const profile = findActiveProfile(store, clientExternalId) ?? null;
      const paid = profile ? paidTotal(store, profile.id) : 0;
      const summary = calculateClientFinance(
        profile?.contractAmountCents ?? null,
        paid,
      );
      const payments = profile
        ? store.payments
            .filter((p) => p.financeProfileId === profile.id)
            .sort(
              (a, b) =>
                b.paymentDate.localeCompare(a.paymentDate) ||
                b.createdAt.localeCompare(a.createdAt),
            )
        : [];
      const contractChanges = profile
        ? store.contractChanges
            .filter((c) => c.financeProfileId === profile.id)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        : [];

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
    },

    async createContract(actor, clientExternalId, input: CreateContractInput) {
      const detail = await getClientDetail(clientExternalId);
      if (!detail) {
        throw new FinanceError("FINANCE_CLIENT_NOT_FOUND", "Client not found", 404);
      }

      const amountCents = assertPositiveCents(input.amountCents);
      const contractDate = validateContractDate(input.contractDate);
      const store = await readFinanceStore();
      const existing = findActiveProfile(store, clientExternalId);
      if (existing?.contractAmountCents != null) {
        throw new FinanceError(
          "FINANCE_CONTRACT_ALREADY_EXISTS",
          "Contract already set. Use change endpoint.",
          409,
        );
      }

      const now = new Date().toISOString();
      let profile = existing;
      if (!profile) {
        profile = {
          id: newFinanceId(),
          clientExternalId,
          clientUuid: null,
          currencyCode: FINANCE_CURRENCY_CODE,
          contractAmountCents: amountCents,
          contractDate,
          version: 1,
          createdAt: now,
          updatedAt: now,
          createdBy: actor.id,
          updatedBy: actor.id,
          archivedAt: null,
        };
        store.profiles.push(profile);
      } else {
        profile.contractAmountCents = amountCents;
        profile.contractDate = contractDate;
        profile.updatedAt = now;
        profile.updatedBy = actor.id;
        profile.version += 1;
      }

      const change: FinanceContractChangeRecord = {
        id: newFinanceId(),
        financeProfileId: profile.id,
        clientExternalId,
        changeType: "contract_created",
        oldContractAmountCents: null,
        newContractAmountCents: amountCents,
        oldContractDate: null,
        newContractDate: contractDate,
        reason: "Initial contract setup",
        changedBy: actor.id,
        changedByName: actor.name,
        createdAt: now,
      };
      store.contractChanges.push(change);
      await writeFinanceStore(store);
      return storeApi.getClientFinance(actor, clientExternalId);
    },

    async changeContract(
      actor,
      clientExternalId,
      input: ChangeContractInput,
    ) {
      const reason = input.reason.trim();
      if (!reason) {
        throw new FinanceError(
          "FINANCE_CHANGE_REASON_REQUIRED",
          "Change reason is required",
        );
      }

      const store = await readFinanceStore();
      const profile = findActiveProfile(store, clientExternalId);
      if (!profile || profile.contractAmountCents == null) {
        throw new FinanceError(
          "FINANCE_CONTRACT_NOT_SET",
          "Contract is not set yet",
        );
      }

      if (
        input.expectedVersion != null &&
        input.expectedVersion !== profile.version
      ) {
        throw new FinanceError(
          "FINANCE_CONCURRENT_MODIFICATION",
          "Finance data was changed by another employee. Refresh and try again.",
          409,
        );
      }

      const now = new Date().toISOString();
      let changed = false;

      if (input.amountCents != null) {
        const newAmount = assertPositiveCents(input.amountCents);
        if (newAmount === profile.contractAmountCents) {
          throw new FinanceError(
            "FINANCE_AMOUNT_UNCHANGED",
            "New amount equals current amount",
          );
        }
        const change: FinanceContractChangeRecord = {
          id: newFinanceId(),
          financeProfileId: profile.id,
          clientExternalId,
          changeType: "amount_changed",
          oldContractAmountCents: profile.contractAmountCents,
          newContractAmountCents: newAmount,
          oldContractDate: profile.contractDate,
          newContractDate: profile.contractDate,
          reason,
          changedBy: actor.id,
          changedByName: actor.name,
          createdAt: now,
        };
        store.contractChanges.push(change);
        profile.contractAmountCents = newAmount;
        changed = true;
      }

      if (input.contractDate != null) {
        const newDate = validateContractDate(input.contractDate);
        if (newDate === profile.contractDate) {
          if (!changed) {
            throw new FinanceError(
              "FINANCE_AMOUNT_UNCHANGED",
              "New date equals current date",
            );
          }
        } else {
          const change: FinanceContractChangeRecord = {
            id: newFinanceId(),
            financeProfileId: profile.id,
            clientExternalId,
            changeType: "date_changed",
            oldContractAmountCents: profile.contractAmountCents,
            newContractAmountCents: profile.contractAmountCents,
            oldContractDate: profile.contractDate,
            newContractDate: newDate,
            reason,
            changedBy: actor.id,
            changedByName: actor.name,
            createdAt: now,
          };
          store.contractChanges.push(change);
          profile.contractDate = newDate;
          changed = true;
        }
      }

      if (!changed) {
        throw new FinanceError(
          "FINANCE_AMOUNT_UNCHANGED",
          "No contract fields to change",
        );
      }

      profile.updatedAt = now;
      profile.updatedBy = actor.id;
      profile.version += 1;
      await writeFinanceStore(store);
      return storeApi.getClientFinance(actor, clientExternalId);
    },

    async createPayment(
      actor,
      clientExternalId,
      input: CreatePaymentInput,
    ) {
      const idempotencyKey = input.idempotencyKey?.trim();
      if (!idempotencyKey) {
        throw new FinanceError(
          "FINANCE_IDEMPOTENCY_REQUIRED",
          "Idempotency key is required",
        );
      }

      const store = await readFinanceStore();
      const profile = findActiveProfile(store, clientExternalId);
      if (!profile || profile.contractAmountCents == null) {
        throw new FinanceError(
          "FINANCE_CONTRACT_NOT_SET",
          "Contract amount is required before payments",
        );
      }

      const existing = store.payments.find(
        (p) =>
          p.financeProfileId === profile.id &&
          p.idempotencyKey === idempotencyKey,
      );
      if (existing) {
        return storeApi.getClientFinance(actor, clientExternalId);
      }

      const amountCents = assertPositiveCents(input.amountCents);
      const paymentDate = validatePaymentDate(input.paymentDate);
      const comment = input.comment?.trim() || null;
      if (comment && comment.length > 500) {
        throw new FinanceError(
          "FINANCE_COMMENT_TOO_LONG",
          "Comment is too long",
        );
      }

      const now = new Date().toISOString();
      const payment: FinancePaymentRecord = {
        id: newFinanceId(),
        financeProfileId: profile.id,
        clientExternalId,
        amountCents,
        currencyCode: FINANCE_CURRENCY_CODE,
        paymentDate,
        comment,
        createdBy: actor.id,
        createdByName: actor.name,
        createdAt: now,
        voidedAt: null,
        voidedBy: null,
        voidedByName: null,
        voidReason: null,
        idempotencyKey,
      };
      store.payments.push(payment);
      profile.updatedAt = now;
      profile.updatedBy = actor.id;
      profile.version += 1;
      await writeFinanceStore(store);
      return storeApi.getClientFinance(actor, clientExternalId);
    },

    async voidPayment(
      actor,
      clientExternalId,
      input: VoidPaymentInput,
    ) {
      const trimmed = input.reason.trim();
      if (!trimmed) {
        throw new FinanceError(
          "FINANCE_CHANGE_REASON_REQUIRED",
          "Void reason is required",
        );
      }
      const store = await readFinanceStore();
      const payment = store.payments.find(
        (p) => p.id === input.paymentId && p.clientExternalId === clientExternalId,
      );
      if (!payment) {
        throw new FinanceError(
          "FINANCE_PAYMENT_NOT_FOUND",
          "Payment not found",
          404,
        );
      }
      if (payment.voidedAt) {
        throw new FinanceError(
          "FINANCE_PAYMENT_ALREADY_VOIDED",
          "Payment already voided",
          409,
        );
      }
      const now = new Date().toISOString();
      payment.voidedAt = now;
      payment.voidedBy = actor.id;
      payment.voidedByName = actor.name;
      payment.voidReason = trimmed;

      const profile = findActiveProfile(store, clientExternalId);
      if (profile) {
        profile.updatedAt = now;
        profile.updatedBy = actor.id;
        profile.version += 1;
      }
      await writeFinanceStore(store);
      return storeApi.getClientFinance(actor, clientExternalId);
    },

    async getAnalytics(
      _actor,
      query: FinanceAnalyticsQuery,
    ): Promise<FinanceAnalyticsResult> {
      const periodType = query.periodType ?? "year";
      const year = query.year ?? new Date().getFullYear();
      const month =
        periodType === "month" ? (query.month ?? new Date().getMonth() + 1) : null;
      const store = await readFinanceStore();
      const { items: clients } = await listAllClients();
      const clientById = new Map(clients.map((c) => [c.id, c]));

      const inPeriod = (isoDate: string | null | undefined): boolean => {
        if (!isoDate) return false;
        const d = isoDate.slice(0, 10);
        const y = Number(d.slice(0, 4));
        const m = Number(d.slice(5, 7));
        if (y !== year) return false;
        if (month != null && m !== month) return false;
        return true;
      };

      const directionOk = (clientId: string) => {
        const client = clientById.get(clientId);
        return matchesDirectionFilter(client?.direction, query.direction);
      };

      let contractsSignedCents = 0;
      for (const profile of store.profiles) {
        if (profile.archivedAt || profile.contractAmountCents == null) continue;
        if (!inPeriod(profile.contractDate)) continue;
        if (!directionOk(profile.clientExternalId)) continue;
        contractsSignedCents += profile.contractAmountCents;
      }

      let newClientsCount = 0;
      for (const client of clients) {
        if (!matchesDirectionFilter(client.direction, query.direction)) continue;
        const raw = client.createdAt;
        const m = raw.match(/(\d{2})\.(\d{2})\.(\d{4})/);
        if (m) {
          const [, dd, mm, yyyy] = m;
          void dd;
          if (Number(yyyy) !== year) continue;
          if (month != null && Number(mm) !== month) continue;
          newClientsCount += 1;
          continue;
        }
        if (raw.startsWith(String(year))) {
          if (
            month != null &&
            !raw.startsWith(`${year}-${String(month).padStart(2, "0")}`)
          ) {
            continue;
          }
          newClientsCount += 1;
        }
      }

      let receivedCents = 0;
      let paymentsCount = 0;
      for (const payment of store.payments) {
        if (payment.voidedAt) continue;
        if (!inPeriod(payment.paymentDate)) continue;
        if (!directionOk(payment.clientExternalId)) continue;
        receivedCents += payment.amountCents;
        paymentsCount += 1;
      }

      const monthly = Array.from({ length: 12 }, (_, idx) => {
        const m = idx + 1;
        let monthReceived = 0;
        let monthContracts = 0;
        for (const payment of store.payments) {
          if (payment.voidedAt) continue;
          if (
            !payment.paymentDate.startsWith(
              `${year}-${String(m).padStart(2, "0")}`,
            )
          ) {
            continue;
          }
          if (!directionOk(payment.clientExternalId)) continue;
          monthReceived += payment.amountCents;
        }
        for (const profile of store.profiles) {
          if (profile.archivedAt || profile.contractAmountCents == null) continue;
          if (
            !profile.contractDate?.startsWith(
              `${year}-${String(m).padStart(2, "0")}`,
            )
          ) {
            continue;
          }
          if (!directionOk(profile.clientExternalId)) continue;
          monthContracts += profile.contractAmountCents;
        }
        return {
          month: m,
          labelKey: `m${m}`,
          receivedCents: monthReceived,
          contractsSignedCents: monthContracts,
        };
      });

      return {
        periodType,
        year,
        month,
        direction: query.direction ?? null,
        contractsSignedCents,
        newClientsCount,
        receivedCents,
        paymentsCount,
        monthly,
      };
    },
  };

  return storeApi;
}
