"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";
import { ClientFinancePanel } from "@/components/finance/ClientFinancePanel";
import { ClientUnsavedChangesProvider, useClientUnsavedChanges } from "./ClientUnsavedChanges";
import styles from "./ClientDetailView.module.css";

type Tab = "overview" | "finance";

type ClientDetailTabsProps = {
  clientId: string;
  canViewFinance: boolean;
  initialTab: Tab;
  overviewContent: ReactNode;
};

function ClientDetailTabsInner({
  clientId,
  canViewFinance,
  initialTab,
  overviewContent,
}: ClientDetailTabsProps) {
  const t = useTranslations("clients.detail");
  const { requestLeave } = useClientUnsavedChanges();
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);

  function switchTab(next: Tab) {
    if (next === activeTab) return;
    requestLeave(() => setActiveTab(next));
  }

  return (
    <>
      {canViewFinance ? (
        <div className={styles.tabs} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "overview"}
            className={`${styles.tab} ${activeTab === "overview" ? styles.tabActive : ""}`}
            onClick={() => switchTab("overview")}
          >
            {t("tabOverview")}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "finance"}
            className={`${styles.tab} ${activeTab === "finance" ? styles.tabActive : ""}`}
            onClick={() => switchTab("finance")}
          >
            {t("tabFinance")}
          </button>
        </div>
      ) : null}

      <Link href="/clients" className={styles.back}>
        <i className="fa-solid fa-arrow-left" aria-hidden /> {t("backToList")}
      </Link>

      <div hidden={canViewFinance && activeTab !== "overview"}>{overviewContent}</div>
      {canViewFinance && activeTab === "finance" ? (
        <ClientFinancePanel clientId={clientId} />
      ) : null}
    </>
  );
}

export function ClientDetailTabs(props: ClientDetailTabsProps) {
  return (
    <ClientUnsavedChangesProvider>
      <ClientDetailTabsInner {...props} />
    </ClientUnsavedChangesProvider>
  );
}
