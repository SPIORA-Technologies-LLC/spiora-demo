"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import type { ClientCaseIntakeItem } from "@/lib/client-portal/case-types";
import { caseStatusLabel, caseServiceTypeLabel } from "@/lib/client-portal/case-status-labels";
import { Card } from "@/components/ui/Card";
import styles from "./ClientsList.module.css";

function formatDate(iso: string, locale: string) {
  try {
    return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

function intakeDisplayName(item: ClientCaseIntakeItem) {
  return [item.firstName, item.lastName]
    .filter((part) => part && part !== "—")
    .join(" ")
    .trim();
}

export function ClientIntakeList() {
  const locale = useLocale() as "en" | "ru";
  const t = useTranslations("clientIntake");
  const router = useRouter();
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
    const name = intakeDisplayName(item);
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

  function openCase(id: string) {
    router.push(`/clients/intake/${id}`);
  }

  function renderMobileCards() {
    if (loading) {
      return <p className={styles.mobileEmpty}>{t("loading")}</p>;
    }
    if (error) {
      return <p className={styles.mobileEmpty}>{t("loadFailed")}</p>;
    }
    if (items.length === 0) {
      return <p className={styles.mobileEmpty}>{t("empty")}</p>;
    }

    return (
      <ul className={styles.mobileCards}>
        {items.map((item) => {
          const fullName = intakeDisplayName(item) || item.email;
          return (
            <li key={item.id}>
              <article
                className={styles.clientCard}
                onClick={() => openCase(item.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openCase(item.id);
                  }
                }}
                tabIndex={0}
                role="link"
                aria-label={t("openCardAria", { name: fullName })}
              >
                <div className={styles.clientCardHeader}>
                  <h3 className={styles.clientCardName}>{fullName}</h3>
                  <span className={styles.clientCardStatus}>
                    {caseStatusLabel(item.currentStatus, locale)}
                  </span>
                </div>
                <dl className={styles.clientCardMeta}>
                  <div className={styles.clientCardRow}>
                    <dt>{t("columns.email")}</dt>
                    <dd>{item.email}</dd>
                  </div>
                  <div className={styles.clientCardRow}>
                    <dt>{t("columns.service")}</dt>
                    <dd>{caseServiceTypeLabel(item.serviceType, locale)}</dd>
                  </div>
                  <div className={styles.clientCardRow}>
                    <dt>{t("columns.submittedAt")}</dt>
                    <dd>{formatDate(item.submittedAt, locale)}</dd>
                  </div>
                  <div className={styles.clientCardRow}>
                    <dt>{t("columns.assignee")}</dt>
                    <dd>{item.assignedName ?? "—"}</dd>
                  </div>
                </dl>
                <div className={styles.clientCardActions}>
                  <button
                    type="button"
                    className={styles.intakeDeleteBtn}
                    disabled={deletingId === item.id}
                    onClick={(event) => {
                      event.stopPropagation();
                      void onDelete(item);
                    }}
                  >
                    {deletingId === item.id ? "…" : t("delete")}
                  </button>
                </div>
              </article>
            </li>
          );
        })}
      </ul>
    );
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
        <div className={styles.tableScroll}>
          {loading ? <p className={styles.meta}>{t("loading")}</p> : null}
          {error ? <p className={styles.meta}>{t("loadFailed")}</p> : null}
          {!loading && !error && items.length === 0 ? (
            <p className={styles.meta}>{t("empty")}</p>
          ) : null}
          {!loading && items.length > 0 ? (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t("columns.name")}</th>
                  <th>{t("columns.email")}</th>
                  <th>{t("columns.service")}</th>
                  <th>{t("columns.submittedAt")}</th>
                  <th>{t("columns.assignee")}</th>
                  <th>{t("columns.status")}</th>
                  <th>{t("columns.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const fullName = intakeDisplayName(item);
                  return (
                    <tr key={item.id}>
                      <td>
                        <Link
                          href={`/clients/intake/${item.id}`}
                          className={styles.nameLink}
                        >
                          {fullName || item.email}
                        </Link>
                      </td>
                      <td>{item.email}</td>
                      <td>{caseServiceTypeLabel(item.serviceType, locale)}</td>
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
                  );
                })}
              </tbody>
            </table>
          ) : null}
        </div>
        <div className={styles.mobileList}>{renderMobileCards()}</div>
      </Card>
    </div>
  );
}
