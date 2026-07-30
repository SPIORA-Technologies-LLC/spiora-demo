"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";
import { ClientFinancePanel } from "@/components/finance/ClientFinancePanel";
import {
  ClientUnsavedChangesProvider,
  useClientUnsavedChanges,
} from "./ClientUnsavedChanges";
import styles from "./ClientDetailView.module.css";
import editStyles from "./ClientCrmProfile.module.css";

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
  const tEdit = useTranslations("clients.edit");
  const { requestLeave, editChrome, discardEdits } = useClientUnsavedChanges();
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);

  function switchTab(next: Tab) {
    if (next === activeTab) return;
    requestLeave(() => setActiveTab(next));
  }

  const showOverview = !canViewFinance || activeTab === "overview";

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

      <div className={styles.overviewStack} hidden={!showOverview}>
        {overviewContent}
        {editChrome?.active ? (
          <div className={editStyles.pageActions}>
            <button
              type="button"
              className={editStyles.secondary}
              disabled={editChrome.saving}
              onClick={discardEdits}
            >
              {tEdit("cancel")}
            </button>
            <button
              type="submit"
              form={editChrome.formId}
              className={editStyles.primary}
              disabled={editChrome.saving}
            >
              {editChrome.saving ? tEdit("saving") : tEdit("save")}
            </button>
          </div>
        ) : null}
      </div>
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
