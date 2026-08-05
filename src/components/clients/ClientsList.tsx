"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { AppLocale } from "@/i18n/config";
import { translateClientStatus } from "@/i18n/statuses";
import {
  type Client,
  type ClientsListResult,
} from "@/lib/google-sheets/types";
import { canArchiveClient } from "@/lib/clients/permissions";
import { useSession } from "@/components/providers/SessionProvider";
import { Card } from "@/components/ui/Card";
import { CreateClientModal } from "./CreateClientModal";
import styles from "./ClientsList.module.css";

const PAGE_SIZE = 25;

const TABLE_COLUMNS = [
  "name",
  "status",
  "citizenship",
  "passport",
  "email",
  "submittedAt",
  "expectedApproval",
  "referent",
  "bookingAddress",
  "bookingDate",
  "approvalDate",
  "cardIssuedDate",
  "appPassword",
  "partner",
  "contract",
] as const;

export function ClientsList() {
  const router = useRouter();
  const session = useSession();
  const locale = useLocale() as AppLocale;
  const t = useTranslations("clients");
  const canDelete = canArchiveClient(session);
  const [clients, setClients] = useState<Client[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [source, setSource] = useState<ClientsListResult["source"]>("demo");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const columnCount = TABLE_COLUMNS.length + (canDelete ? 1 : 0);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(PAGE_SIZE));
    if (search) params.set("search", search);
    return params.toString();
  }, [page, search]);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await fetch(`/api/clients?${queryString}`);
      if (!res.ok) throw new Error("fetch failed");
      const data = (await res.json()) as ClientsListResult;
      setClients(data.items);
      setTotal(data.total);
      setSource(data.source);
    } catch {
      setClients([]);
      setTotal(0);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchClients();
    }, search ? 200 : 0);
    return () => clearTimeout(timer);
  }, [fetchClients, search]);

  useEffect(() => {
    const interval = setInterval(() => {
      void fetchClients();
    }, 20_000);
    return () => clearInterval(interval);
  }, [fetchClients]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const openClient = useCallback(
    (clientId: string) => {
      router.push(`/clients/${encodeURIComponent(clientId)}`);
    },
    [router],
  );

  async function onDeleteClient(client: Client) {
    if (!canDelete) return;
    if (!window.confirm(t("confirmDelete", { name: client.name }))) {
      return;
    }
    setDeletingId(client.id);
    setLoadError(false);
    try {
      const res = await fetch(`/api/clients/${encodeURIComponent(client.id)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("delete failed");
      setClients((prev) => prev.filter((row) => row.id !== client.id));
      setTotal((prev) => Math.max(0, prev - 1));
      void fetchClients();
    } catch {
      setLoadError(true);
      window.alert(t("errors.deleteFailed"));
    } finally {
      setDeletingId(null);
    }
  }

  const renderMobileCards = () => {
    if (loading) {
      return <p className={styles.mobileEmpty}>{t("empty.loading")}</p>;
    }

    if (clients.length === 0) {
      return (
        <p className={styles.mobileEmpty}>
          {loadError ? t("errors.loadFailed") : t("empty.notFound")}
        </p>
      );
    }

    return (
      <ul className={styles.mobileCards}>
        {clients.map((client) => (
          <li key={client.id}>
            <article
              className={styles.clientCard}
              onClick={() => openClient(client.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openClient(client.id);
                }
              }}
              tabIndex={0}
              role="link"
              aria-label={t("openCardAria", { name: client.name })}
            >
              <div className={styles.clientCardHeader}>
                <h3 className={styles.clientCardName}>{client.name}</h3>
                <span className={styles.clientCardStatus}>
                  {translateClientStatus(locale, client.status)}
                </span>
              </div>

              <dl className={styles.clientCardMeta}>
                <div className={styles.clientCardRow}>
                  <dt>{t("table.passport")}</dt>
                  <dd>{client.passportNumber || "—"}</dd>
                </div>
                <div className={styles.clientCardRow}>
                  <dt>{t("table.email")}</dt>
                  <dd>{client.email || "—"}</dd>
                </div>
                <div className={styles.clientCardRow}>
                  <dt>{t("table.referent")}</dt>
                  <dd>{client.referentName ?? client.manager}</dd>
                </div>
                {client.submittedAt ? (
                  <div className={styles.clientCardRow}>
                    <dt>{t("table.submittedAt")}</dt>
                    <dd>{client.submittedAt}</dd>
                  </div>
                ) : null}
              </dl>
              {canDelete ? (
                <div className={styles.clientCardActions}>
                  <button
                    type="button"
                    className={styles.intakeDeleteBtn}
                    disabled={deletingId === client.id}
                    onClick={(event) => {
                      event.stopPropagation();
                      void onDeleteClient(client);
                    }}
                  >
                    {deletingId === client.id ? "…" : t("delete")}
                  </button>
                </div>
              ) : null}
            </article>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <i className={`fa-solid fa-magnifying-glass ${styles.searchIcon}`} />
          <input
            type="search"
            className={styles.search}
            placeholder={t("search.placeholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button
          type="button"
          className={styles.addBtn}
          onClick={() => setCreateOpen(true)}
        >
          {t("create.open")}
        </button>
      </div>

      <p className={styles.meta}>
        {loading
          ? t("meta.loading")
          : loadError
            ? t("errors.loadFailed")
            : t("meta.count", { count: total })}
        <span className={styles.source}>
          {source === "postgresql"
            ? t("sources.postgresql")
            : source === "google_sheets"
              ? t("sources.googleSheets")
              : t("sources.demo")}
        </span>
      </p>

      <Card className={styles.tableCard}>
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                {TABLE_COLUMNS.map((column) => (
                  <th key={column}>{t(`table.${column}`)}</th>
                ))}
                {canDelete ? <th>{t("table.actions")}</th> : null}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={columnCount} className={styles.empty}>
                    {t("empty.loading")}
                  </td>
                </tr>
              ) : clients.length === 0 ? (
                <tr>
                  <td colSpan={columnCount} className={styles.empty}>
                    {loadError ? t("errors.loadFailed") : t("empty.notFound")}
                  </td>
                </tr>
              ) : (
                clients.map((client) => (
                  <tr
                    key={client.id}
                    className={styles.clickableRow}
                    onClick={() => openClient(client.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openClient(client.id);
                      }
                    }}
                    tabIndex={0}
                    role="link"
                    aria-label={t("openCardAria", { name: client.name })}
                  >
                    <td>
                      <Link
                        href={`/clients/${encodeURIComponent(client.id)}`}
                        className={styles.nameLink}
                        onClick={(event) => event.stopPropagation()}
                      >
                        {client.name}
                      </Link>
                    </td>
                    <td>
                      <span className={styles.tableStatus}>
                        {translateClientStatus(locale, client.status)}
                      </span>
                    </td>
                    <td>{client.citizenship ?? "—"}</td>
                    <td>{client.passportNumber || "—"}</td>
                    <td>{client.email ?? "—"}</td>
                    <td>{client.submittedAt ?? "—"}</td>
                    <td>{client.expectedApprovalAt ?? "—"}</td>
                    <td>{client.referentName ?? client.manager}</td>
                    <td>{client.bookingAddress ?? "—"}</td>
                    <td>{client.bookingRange ?? "—"}</td>
                    <td>{client.approvalAt ?? "—"}</td>
                    <td>{client.residenceCardIssuedAt ?? "—"}</td>
                    <td>{client.appPassword ?? "—"}</td>
                    <td>{client.partnerName ?? "—"}</td>
                    <td>{client.contract ?? "—"}</td>
                    {canDelete ? (
                      <td>
                        <button
                          type="button"
                          className={styles.intakeDeleteBtn}
                          disabled={deletingId === client.id}
                          onClick={(event) => {
                            event.stopPropagation();
                            void onDeleteClient(client);
                          }}
                        >
                          {deletingId === client.id ? "…" : t("delete")}
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className={styles.mobileList}>{renderMobileCards()}</div>
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

      <CreateClientModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setPage(1);
          void fetchClients();
        }}
      />
    </div>
  );
}
