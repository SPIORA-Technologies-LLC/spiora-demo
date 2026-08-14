"use client";

import { useTranslations } from "next-intl";
import {
  CONSULTING_AGREEMENT_ARTICLES,
  CONSULTING_AGREEMENT_BRAND,
  pickLocaleText,
} from "@/lib/client-portal/consulting-agreement-content";
import {
  buildConsultingAgreementHtml,
  consultingAgreementFileName,
} from "@/lib/client-portal/consulting-agreement-html";
import type { ConsultingAgreementView } from "@/lib/client-portal/consulting-agreement-fields";
import styles from "./ConsultingAgreementDocument.module.css";

type Props = {
  view: ConsultingAgreementView;
  onClientAccept?: (accepted: boolean) => void;
  onEmployeeAccept?: (accepted: boolean) => void;
  clientDisabled?: boolean;
  employeeDisabled?: boolean;
  showEmployeeCheckbox?: boolean;
  showActions?: boolean;
};

function Fill({ value }: { value?: string | null }) {
  if (typeof value === "string" && value.trim()) {
    return <span className={styles.value}>{value}</span>;
  }
  return <span className={styles.blank} />;
}

export function ConsultingAgreementDocument({
  view,
  onClientAccept,
  onEmployeeAccept,
  clientDisabled = false,
  employeeDisabled = false,
  showEmployeeCheckbox = false,
  showActions = true,
}: Props) {
  const t = useTranslations("clientPortal.consultingAgreement");
  const locale = view.locale;
  const party = view.party ?? {
    firstName: "",
    lastName: "",
    patronymic: "",
    fullName: "",
    passportNumber: "",
    passportIssueDate: "",
    passportIssueDateIso: "",
    address: "",
    city: "",
  };
  const place = [party.city, view.agreementDate].filter(Boolean).join(", ");

  function html() {
    return buildConsultingAgreementHtml(view, {
      no: t("no"),
      provider: t("provider"),
      client: t("client"),
      providerFields: {
        ico: t("providerFields.ico"),
        dic: t("providerFields.dic"),
        authority: t("providerFields.authority"),
        bank: t("providerFields.bank"),
      },
      clientFields: {
        passport: t("clientFields.passport"),
        issued: t("clientFields.issued"),
        address: t("clientFields.address"),
      },
      jointly: t("jointly"),
      signatures: t("signatures"),
      placeAndDate: t("placeAndDate"),
      providerRole: t("providerRole"),
      clientRole: t("clientRole"),
      namePosition: t("namePosition"),
      accepted: t("accepted"),
      notAccepted: t("notAccepted"),
    });
  }

  function download() {
    const blob = new Blob([html()], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = consultingAgreementFileName(locale);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function printAgreement() {
    const popup = window.open("", "_blank", "noopener,noreferrer");
    if (!popup) {
      window.print();
      return;
    }
    popup.document.write(html());
    popup.document.close();
    popup.focus();
    popup.print();
  }

  return (
    <article className={styles.sheet}>
      <p className={styles.brand}>{CONSULTING_AGREEMENT_BRAND.letters}</p>
      <p className={styles.slogan}>{CONSULTING_AGREEMENT_BRAND.slogan}</p>
      <p className={styles.program}>
        {pickLocaleText(CONSULTING_AGREEMENT_BRAND.program, locale)}
      </p>
      <h1 className={styles.title}>
        {pickLocaleText(CONSULTING_AGREEMENT_BRAND.title, locale)}
      </h1>
      <p className={styles.meta}>
        {t("no")} {view.agreementNumber}
      </p>

      <section className={styles.party}>
        <h2 className={styles.partyTitle}>{t("provider")}</h2>
        <p>
          {pickLocaleText(CONSULTING_AGREEMENT_BRAND.providerLegalName, locale)}
        </p>
        <p>{t("providerHereinafter")}</p>
        <p className={styles.fill}>
          {t("providerFields.ico")} <span className={styles.blank} />
        </p>
        <p className={styles.fill}>
          {t("providerFields.dic")} <span className={styles.blank} />
        </p>
        <p className={styles.fill}>
          {t("providerFields.authority")} <span className={styles.blank} />
        </p>
        <p className={styles.fill}>
          {t("providerFields.bank")} <span className={styles.blank} />
        </p>
      </section>

      <section className={styles.party}>
        <h2 className={styles.partyTitle}>{t("client")}</h2>
        <p>
          <Fill value={party.fullName} />
        </p>
        <p className={styles.fill}>
          {t("clientFields.passport")} <Fill value={party.passportNumber} />
        </p>
        <p className={styles.fill}>
          {t("clientFields.issued")} <Fill value={party.passportIssueDate} />
        </p>
        <p className={styles.fill}>
          {t("clientFields.address")} <Fill value={party.address} />
        </p>
      </section>

      <p className={styles.jointly}>{t("jointly")}</p>

      {CONSULTING_AGREEMENT_ARTICLES.map((article) => (
        <section key={article.roman} className={styles.article}>
          <h2 className={styles.articleTitle}>
            {article.roman}. {pickLocaleText(article.title, locale)}
          </h2>
          {article.clauses.map((clause) => (
            <div key={`${article.roman}-${clause.n}`}>
              <p className={styles.clause}>
                <span className={styles.num}>{clause.n}.</span>
                {clause[locale]}
              </p>
              {clause.items ? (
                <ul className={styles.items}>
                  {clause.items.map((item) => (
                    <li key={item.key}>
                      <span className={styles.key}>{item.key})</span>
                      {item[locale]}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </section>
      ))}

      <h2 className={styles.signTitle}>{t("signatures")}</h2>
      <p className={styles.fill}>
        {t("placeAndDate")} <Fill value={place} />
      </p>
      <div className={styles.signGrid}>
        <div className={styles.signBox}>
          <p className={styles.signRole}>{t("providerRole")}</p>
          <p>{t("namePosition")}</p>
          <label
            className={`${styles.checkRow} ${employeeDisabled || !onEmployeeAccept ? styles.checkRowDisabled : ""}`}
          >
            <input
              type="checkbox"
              checked={view.employeeAccepted}
              disabled={employeeDisabled || !onEmployeeAccept}
              onChange={(event) => onEmployeeAccept?.(event.target.checked)}
            />
            <span>
              {showEmployeeCheckbox || view.employeeAccepted
                ? t("employeeConsent")
                : t("employeePending")}
            </span>
          </label>
        </div>
        <div className={styles.signBox}>
          <p className={styles.signRole}>{t("clientRole")}</p>
          <p>
            {t("namePosition")} <Fill value={party.fullName} />
          </p>
          <label
            className={`${styles.checkRow} ${clientDisabled || !onClientAccept ? styles.checkRowDisabled : ""}`}
          >
            <input
              type="checkbox"
              checked={view.clientAccepted}
              disabled={clientDisabled || !onClientAccept}
              onChange={(event) => onClientAccept?.(event.target.checked)}
            />
            <span>{t("clientConsent")}</span>
          </label>
        </div>
      </div>

      {showActions ? (
        <div className={styles.actions}>
          <button type="button" className={styles.actionBtn} onClick={download}>
            {t("download")}
          </button>
          <button
            type="button"
            className={`${styles.actionBtn} ${styles.actionBtnSecondary}`}
            onClick={printAgreement}
          >
            {t("print")}
          </button>
        </div>
      ) : null}
    </article>
  );
}
