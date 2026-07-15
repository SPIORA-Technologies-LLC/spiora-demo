import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import type { ClientDetail } from "@/lib/google-sheets/types";
import { getClientSheetFields } from "@/lib/google-sheets/client-detail-fields";
import { translateClientStatus } from "@/i18n/statuses";
import type { AppLocale } from "@/i18n/config";
import { Card } from "@/components/ui/Card";
import { ClientAiActions } from "./ClientAiPanel";
import { ClientDocuments } from "./ClientDocuments";
import { ClientNotes } from "./ClientNotes";
import styles from "./ClientDetailView.module.css";

type ClientDetailViewProps = {
  detail: ClientDetail;
};

export async function ClientDetailView({ detail }: ClientDetailViewProps) {
  const locale = (await getLocale()) as AppLocale;
  const t = await getTranslations("clients.detail");
  const tFields = await getTranslations("clients.fields");
  const { client, surveys, documents, notes } = detail;
  const sheetFields = getClientSheetFields(client);
  const statusLabel = translateClientStatus(locale, client.status);

  return (
    <div className={styles.page}>
      <Link href="/clients" className={styles.back}>
        <i className="fa-solid fa-arrow-left" aria-hidden /> {t("backToList")}
      </Link>

      <div className={styles.summary}>
        <div className={styles.fieldRow}>
          <span className={styles.fieldLabel}>{t("fullName")}</span>
          <span className={styles.fieldValue}>{client.name}</span>
        </div>
        <div className={styles.fieldRow}>
          <span className={styles.fieldLabel}>{t("passport")}</span>
          <span className={styles.fieldValue}>
            {client.passportNumber ?? client.id}
          </span>
        </div>
        <div className={styles.fieldRow}>
          <span className={styles.fieldLabel}>{t("status")}</span>
          <span className={styles.fieldValue}>
            <span className={styles.statusBadge}>{statusLabel}</span>
          </span>
        </div>
        <div className={styles.fieldRow}>
          <span className={styles.fieldLabel}>{t("source")}</span>
          <span className={styles.fieldValue}>
            {detail.source === "postgresql"
              ? t("sourcePostgresql")
              : detail.source === "google_sheets"
                ? t("sourceSheets")
                : t("sourceDemo")}
            {client.rowIndex
              ? ` · ${t("rowIndex", { index: client.rowIndex })}`
              : null}
          </span>
        </div>
      </div>

      <div className={styles.detailLayout}>
        <Card className={styles.panel}>
          <h2 className={styles.panelTitle}>{t("sheetData")}</h2>
          <div className={styles.fieldGrid}>
            {sheetFields.map((field) => (
              <div key={field.labelKey} className={styles.fieldRow}>
                <span className={styles.fieldLabel}>
                  {tFields(field.labelKey)}
                </span>
                <span className={styles.fieldValue}>{field.value}</span>
              </div>
            ))}
          </div>
        </Card>

        {surveys.length > 0 ? (
          <Card className={styles.panel}>
            <h2 className={styles.panelTitle}>{t("surveys")}</h2>
            <ul className={styles.itemList}>
              {surveys.map((s) => (
                <li key={s.id} className={styles.item}>
                  <span className={styles.itemTitle}>{s.title}</span>
                  <span className={styles.itemMeta}>
                    {s.filledAt} · {s.processingStatus}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        <Card className={styles.panel}>
          <h2 className={styles.panelTitle}>{t("documents")}</h2>
          <ClientDocuments documents={documents} source={detail.source} />
        </Card>
      </div>

      <ClientAiActions clientId={client.id} clientName={client.name} />

      <Card className={styles.panelWide}>
        <h2 className={styles.panelTitle}>{t("managerNotes")}</h2>
        <ClientNotes clientId={client.id} initialNotes={notes} />
      </Card>
    </div>
  );
}
