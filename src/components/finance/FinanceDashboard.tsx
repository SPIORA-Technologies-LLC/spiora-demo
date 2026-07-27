/*
 * Translation key tree used (namespace "finance"):
 *   finance.title
 *   finance.openAnalytics
 *   finance.kpi.totalContracts
 *   finance.kpi.received
 *   finance.kpi.outstandingDebt
 *   finance.kpi.clientsWithDebt
 *   finance.filters.searchPlaceholder
 *   finance.filters.allDirections
 *   finance.filters.noDirection
 *   finance.filters.allStatuses
 *   finance.filters.pageSize
 *   finance.filters.pageSizeAria
 *   finance.table.client
 *   finance.table.direction
 *   finance.table.contract
 *   finance.table.paid
 *   finance.table.balance
 *   finance.table.status
 *   finance.table.lastPayment
 *   finance.empty.noData
 *   finance.empty.noMatch
 *   finance.meta.loading
 *   finance.meta.count
 *   finance.pagination.prev
 *   finance.pagination.next
 *   finance.status.no_contract
 *   finance.status.unpaid
 *   finance.status.partial
 *   finance.status.paid
 *   finance.status.overpaid
 *   finance.directions.Spain
 *   finance.directions.Croatia
 *   finance.directions.Slovenia
 */

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { AppLocale } from "@/i18n/config";
import type { FinanceClientListItem } from "@/lib/finance/types";
import type { FinanceDashboardKpis } from "@/lib/finance/calculations";
import type { FinancePaymentStatus } from "@/lib/finance/calculations";
import { formatEuroFromCents } from "@/lib/finance/money";
import { FINANCE_DIRECTIONS } from "@/lib/finance/directions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import styles from "./FinanceDashboard.module.css";

type SummaryResponse = FinanceDashboardKpis;
type ClientsResponse = {
  items: FinanceClientListItem[];
  total: number;
  page: number;
  limit: number;
};

const STATUS_STYLE: Record<FinancePaymentStatus, string> = {
  paid: styles.statusPaid,
  partial: styles.statusPartial,
  unpaid: styles.statusUnpaid,
  overpaid: styles.statusOverpaid,
  no_contract: styles.statusNoContract,
};

export function FinanceDashboard() {
  const router = useRouter();
  const locale = useLocale() as AppLocale;
  const t = useTranslations("finance");

  const [search, setSearch] = useState("");
  const [direction, setDirection] = useState("all");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<SummaryResponse | null>(null);
  const [clients, setClients] = useState<FinanceClientListItem[]>([]);
  const [total, setTotal] = useState(0);

  // Fetch summary KPIs
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/finance/summary");
        if (!res.ok) return;
        const data = (await res.json()) as { summary?: SummaryResponse };
        if (!cancelled) setKpis(data.summary ?? null);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // Build query string for clients
  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(pageSize));
    if (search) params.set("search", search);
    if (direction && direction !== "all") params.set("direction", direction);
    if (paymentStatus) params.set("paymentStatus", paymentStatus);
    return params.toString();
  }, [page, pageSize, search, direction, paymentStatus]);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/finance/clients?${queryString}`);
      if (!res.ok) throw new Error("fetch failed");
      const data = (await res.json()) as ClientsResponse;
      setClients(data.items);
      setTotal(data.total);
    } catch {
      setClients([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    const timer = setTimeout(() => { void fetchClients(); }, search ? 200 : 0);
    return () => clearTimeout(timer);
  }, [fetchClients, search]);

  useEffect(() => { setPage(1); }, [search, direction, paymentStatus, pageSize]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const openClient = useCallback(
    (clientId: string) => {
      router.push(`/clients/${encodeURIComponent(clientId)}?tab=finance`);
    },
    [router],
  );

  const fmt = useCallback(
    (cents: number | null | undefined) => formatEuroFromCents(cents, locale),
    [locale],
  );

  const statusLabel = useCallback(
    (s: FinancePaymentStatus) => t(`status.${s}`),
    [t],
  );

  const TABLE_COLS = ["client", "direction", "contract", "paid", "balance", "status", "lastPayment"] as const;

  return (
    <div className={styles.wrap} aria-busy={loading}>
      <SectionHeader
        title={t("title")}
        action={
          <Link href="/finance/analytics">
            <Button variant="secondary">{t("openAnalytics")}</Button>
          </Link>
        }
      />

      {/* KPI cards */}
      <ul className={styles.kpiRow}>
        <li className={styles.kpiCard}>
          <span className={styles.kpiValue}>{kpis ? fmt(kpis.totalContractsCents) : "…"}</span>
          <span className={styles.kpiLabel}>{t("kpi.totalContracts")}</span>
        </li>
        <li className={styles.kpiCard}>
          <span className={styles.kpiValue}>{kpis ? fmt(kpis.totalReceivedCents) : "…"}</span>
          <span className={styles.kpiLabel}>{t("kpi.received")}</span>
        </li>
        <li className={styles.kpiCardEmphasize}>
          <span className={styles.kpiValue}>{kpis ? fmt(kpis.totalDebtCents) : "…"}</span>
          <span className={styles.kpiLabel}>{t("kpi.outstandingDebt")}</span>
        </li>
        <li className={styles.kpiCard}>
          <span className={styles.kpiValue}>{kpis ? String(kpis.clientsWithDebt) : "…"}</span>
          <span className={styles.kpiLabel}>{t("kpi.clientsWithDebt")}</span>
        </li>
      </ul>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <i className={`fa-solid fa-magnifying-glass ${styles.searchIcon}`} />
          <input
            type="search"
            className={styles.search}
            placeholder={t("filters.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className={styles.filters}>
          <select
            className={styles.select}
            value={direction}
            onChange={(e) => setDirection(e.target.value)}
          >
            <option value="all">{t("filters.allDirections")}</option>
            {FINANCE_DIRECTIONS.map((d) => (
              <option key={d} value={d}>{t(`directions.${d}`)}</option>
            ))}
            <option value="none">{t("filters.noDirection")}</option>
          </select>
          <select
            className={styles.select}
            value={paymentStatus}
            onChange={(e) => setPaymentStatus(e.target.value)}
          >
            <option value="">{t("filters.allStatuses")}</option>
            {(["no_contract", "unpaid", "partial", "paid", "overpaid"] as FinancePaymentStatus[]).map((s) => (
              <option key={s} value={s}>{t(`status.${s}`)}</option>
            ))}
          </select>
          <select
            className={styles.select}
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            aria-label={t("filters.pageSizeAria")}
            title={t("filters.pageSizeAria")}
          >
            {[20, 50, 100].map((n) => (
              <option key={n} value={n}>{t("filters.pageSize", { n })}</option>
            ))}
          </select>
        </div>
      </div>

      <p className={styles.meta}>
        {loading ? t("meta.loading") : t("meta.count", { count: total })}
      </p>

      {/* Table */}
      <Card className={styles.tableCard}>
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                {TABLE_COLS.map((col) => (
                  <th key={col}>{t(`table.${col}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={TABLE_COLS.length} className={styles.empty}>
                    {t("meta.loading")}
                  </td>
                </tr>
              ) : clients.length === 0 ? (
                <tr>
                  <td colSpan={TABLE_COLS.length} className={styles.empty}>
                    {search || direction !== "all" || paymentStatus
                      ? t("empty.noMatch")
                      : t("empty.noData")}
                  </td>
                </tr>
              ) : (
                clients.map((c) => (
                  <tr
                    key={c.clientExternalId}
                    className={styles.clickableRow}
                    onClick={() => openClient(c.clientExternalId)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openClient(c.clientExternalId);
                      }
                    }}
                    tabIndex={0}
                    role="link"
                  >
                    <td className={styles.nameCell}>{c.clientName}</td>
                    <td>{c.directionNormalized ? t(`directions.${c.directionNormalized}`) : c.direction || "—"}</td>
                    <td>{fmt(c.contractAmountCents)}</td>
                    <td>{fmt(c.paidAmountCents)}</td>
                    <td>{fmt(c.balanceCents)}</td>
                    <td>
                      <span className={STATUS_STYLE[c.paymentStatus] ?? styles.statusBadge}>
                        {statusLabel(c.paymentStatus)}
                      </span>
                    </td>
                    <td>{c.lastPaymentDate ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className={styles.mobileList}>
          {loading ? (
            <p className={styles.mobileEmpty}>{t("meta.loading")}</p>
          ) : clients.length === 0 ? (
            <p className={styles.mobileEmpty}>
              {search || direction !== "all" || paymentStatus ? t("empty.noMatch") : t("empty.noData")}
            </p>
          ) : (
            <ul className={styles.mobileCards}>
              {clients.map((c) => (
                <li key={c.clientExternalId}>
                  <article
                    className={styles.clientCard}
                    onClick={() => openClient(c.clientExternalId)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openClient(c.clientExternalId);
                      }
                    }}
                    tabIndex={0}
                    role="link"
                  >
                    <div className={styles.clientCardHeader}>
                      <h3 className={styles.clientCardName}>{c.clientName}</h3>
                      <span className={STATUS_STYLE[c.paymentStatus] ?? styles.statusBadge}>
                        {statusLabel(c.paymentStatus)}
                      </span>
                    </div>
                    <dl className={styles.clientCardMeta}>
                      <div className={styles.clientCardRow}>
                        <dt>{t("table.contract")}</dt>
                        <dd>{fmt(c.contractAmountCents)}</dd>
                      </div>
                      <div className={styles.clientCardRow}>
                        <dt>{t("table.paid")}</dt>
                        <dd>{fmt(c.paidAmountCents)}</dd>
                      </div>
                      <div className={styles.clientCardRow}>
                        <dt>{t("table.balance")}</dt>
                        <dd>{fmt(c.balanceCents)}</dd>
                      </div>
                    </dl>
                  </article>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      {totalPages > 1 ? (
        <div className={styles.pagination}>
          <button
            type="button"
            className={styles.pageBtn}
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => p - 1)}
          >
            {t("pagination.prev")}
          </button>
          <span className={styles.pageInfo}>
            {page} / {totalPages}
          </span>
          <button
            type="button"
            className={styles.pageBtn}
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            {t("pagination.next")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
