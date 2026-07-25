"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import type { ClientCaseIntakeItem } from "@/lib/client-portal/case-types";
import { caseStatusLabel } from "@/lib/client-portal/case-status-labels";
import { Card } from "@/components/ui/Card";
import styles from "./ClientsList.module.css";

function formatDate(iso: string, locale: string) {
  try {
    return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

export function ClientIntakeList() {
  const locale = useLocale() as "en" | "ru";
  const t = useTranslations("clientIntake");
  const [items, setItems] = useState<ClientCaseIntakeItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(`/api/client-cases?${params.toString()}`);
      if (!res.ok) throw new Error("failed");
      const data = (await res.json()) as {
        items: ClientCaseIntakeItem[];
        total: number;
      };
      setItems(data.items);
    } catch {
      setItems([]);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchItems();
    }, search ? 200 : 0);
    return () => clearTimeout(timer);
  }, [fetchItems, search]);

  async function onDelete(item: ClientCaseIntakeItem) {
    const name = [item.firstName, item.lastName].filter(Boolean).join(" ").trim();
    if (!window.confirm(t("confirmDelete", { name: name || item.email }))) {
      return;
    }
    setDeletingId(item.id);
    try {
      const res = await fetch(`/api/client-cases/${encodeURIComponent(item.id)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("failed");
      setItems((prev) => prev.filter((row) => row.id !== item.id));
    } catch {
      setError(true);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <i className={`fa-solid fa-magnifying-glass ${styles.searchIcon}`} aria-hidden />
          <input
            className={styles.search}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchPlaceholder")}
          />
        </div>
      </div>

      <Card className={styles.tableCard}>
        {loading ? <p className={styles.meta}>{t("loading")}</p> : null}
        {error ? <p className={styles.meta}>{t("loadFailed")}</p> : null}
        {!loading && !error && items.length === 0 ? (
          <p className={styles.meta}>{t("empty")}</p>
        ) : null}
        {!loading && items.length > 0 ? (
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t("columns.firstName")}</th>
                  <th>{t("columns.lastName")}</th>
                  <th>{t("columns.email")}</th>
                  <th>{t("columns.service")}</th>
                  <th>{t("columns.submittedAt")}</th>
                  <th>{t("columns.assignee")}</th>
                  <th>{t("columns.status")}</th>
                  <th>{t("columns.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <Link href={`/clients/intake/${item.id}`}>{item.firstName}</Link>
                    </td>
                    <td>{item.lastName}</td>
                    <td>{item.email}</td>
                    <td>{item.serviceType ?? "—"}</td>
                    <td>{formatDate(item.submittedAt, locale)}</td>
                    <td>{item.assignedName ?? "—"}</td>
                    <td>{caseStatusLabel(item.currentStatus, locale)}</td>
                    <td>
                      <button
                        type="button"
                        className={styles.intakeDeleteBtn}
                        disabled={deletingId === item.id}
                        onClick={() => void onDelete(item)}
                      >
                        {deletingId === item.id ? "…" : t("delete")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
