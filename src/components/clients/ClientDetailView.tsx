import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { ClientDetail } from "@/lib/google-sheets/types";
import { Card } from "@/components/ui/Card";
import { ClientAiActions } from "./ClientAiPanel";
import { ClientCrmProfile } from "./ClientCrmProfile";
import { ClientDocuments } from "./ClientDocuments";
import { ClientNotes } from "./ClientNotes";
import { ClientDetailTabs } from "./ClientDetailTabs";
import styles from "./ClientDetailView.module.css";

type ClientDetailViewProps = {
  detail: ClientDetail;
  canViewFinance?: boolean;
  initialTab?: "overview" | "finance";
};

export async function ClientDetailView({
  detail,
  canViewFinance = false,
  initialTab = "overview",
}: ClientDetailViewProps) {
  const t = await getTranslations("clients.detail");
  const { client, surveys, documents, notes } = detail;

  const overviewContent = (
    <>
      <Link href="/clients" className={styles.back}>
        <i className="fa-solid fa-arrow-left" aria-hidden /> {t("backToList")}
      </Link>

      <ClientCrmProfile
        client={client}
        source={detail.source}
        rowIndex={client.rowIndex}
      />

      <div className={styles.detailLayout}>
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
          <ClientDocuments
            clientId={client.id}
            documents={documents}
            source={detail.source}
          />
        </Card>
      </div>

      <ClientAiActions clientId={client.id} clientName={client.name} />

      <Card className={styles.panelWide}>
        <h2 className={styles.panelTitle}>{t("managerNotes")}</h2>
        <ClientNotes clientId={client.id} initialNotes={notes} />
      </Card>
    </>
  );

  return (
    <div className={styles.page}>
      <ClientDetailTabs
        clientId={client.id}
        canViewFinance={canViewFinance}
        initialTab={initialTab}
        overviewContent={overviewContent}
      />
    </div>
  );
}
