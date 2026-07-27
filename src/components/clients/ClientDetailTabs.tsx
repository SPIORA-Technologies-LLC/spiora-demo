"use client";

import { useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";
import { ClientFinancePanel } from "@/components/finance/ClientFinancePanel";
import styles from "./ClientDetailView.module.css";

type Tab = "overview" | "finance";

type ClientDetailTabsProps = {
  clientId: string;
  canViewFinance: boolean;
  initialTab: Tab;
  overviewContent: ReactNode;
};

export function ClientDetailTabs({
  clientId,
  canViewFinance,
  initialTab,
  overviewContent,
}: ClientDetailTabsProps) {
  const t = useTranslations("clients.detail");
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);

  if (!canViewFinance) {
    return <>{overviewContent}</>;
  }

  return (
    <>
      <div className={styles.tabs} role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "overview"}
          className={`${styles.tab} ${activeTab === "overview" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("overview")}
        >
          {t("tabOverview")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "finance"}
          className={`${styles.tab} ${activeTab === "finance" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("finance")}
        >
          {t("tabFinance")}
        </button>
      </div>

      {activeTab === "overview" ? (
        overviewContent
      ) : (
        <ClientFinancePanel clientId={clientId} />
      )}
    </>
  );
}
