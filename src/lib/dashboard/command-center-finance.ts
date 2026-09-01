import "server-only";

import type { SessionUser } from "@/lib/auth/types";
import { canViewFinance } from "@/lib/finance/permissions";
import { getFinanceSummary, listFinanceClients } from "@/lib/finance/service";
import type { FinancePaymentStatus } from "@/lib/finance/calculations";

export type CommandCenterFinanceDebtor = {
  clientExternalId: string;
  clientName: string;
  balanceCents: number;
  paymentStatus: FinancePaymentStatus;
  href: string;
};

export type CommandCenterFinanceSnapshot = {
  totalContractsCents: number;
  totalReceivedCents: number;
  totalDebtCents: number;
  clientsWithDebt: number;
  clientsUnpaid: number;
  clientsPartial: number;
  debtors: CommandCenterFinanceDebtor[];
};

const DEBTOR_PREVIEW = 8;

export async function getCommandCenterFinanceSnapshot(
  user: SessionUser,
): Promise<CommandCenterFinanceSnapshot | null> {
  if (!canViewFinance(user)) return null;

  const [summary, unpaidPage, partialPage] = await Promise.all([
    getFinanceSummary(user),
    listFinanceClients(user, {
      paymentStatus: "unpaid",
      limit: 100,
      page: 1,
    }),
    listFinanceClients(user, {
      paymentStatus: "partial",
      limit: 100,
      page: 1,
    }),
  ]);

  const debtors = [...unpaidPage.items, ...partialPage.items]
    .filter((item) => (item.balanceCents ?? 0) > 0)
    .sort((a, b) => (b.balanceCents ?? 0) - (a.balanceCents ?? 0))
    .slice(0, DEBTOR_PREVIEW)
    .map((item) => ({
      clientExternalId: item.clientExternalId,
      clientName: item.clientName,
      balanceCents: item.balanceCents ?? 0,
      paymentStatus: item.paymentStatus,
      href: `/clients/${encodeURIComponent(item.clientExternalId)}`,
    }));

  return {
    totalContractsCents: summary.totalContractsCents,
    totalReceivedCents: summary.totalReceivedCents,
    totalDebtCents: summary.totalDebtCents,
    clientsWithDebt: summary.clientsWithDebt,
    clientsUnpaid: unpaidPage.total,
    clientsPartial: partialPage.total,
    debtors,
  };
}
