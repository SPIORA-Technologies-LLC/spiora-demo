import { branding } from "@/config/branding";
import type { AppLocale } from "@/i18n/config";
import {
  CONSULTING_AGREEMENT_ARTICLES,
  CONSULTING_AGREEMENT_BRAND,
  pickLocaleText,
} from "./consulting-agreement-content";
import {
  normalizeConsultingAgreementParty,
  type ConsultingAgreementView,
} from "./consulting-agreement-fields";

function dash(value?: string | null): string {
  return (value ?? "").trim() || "____________________";
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function buildConsultingAgreementHtml(
  view: ConsultingAgreementView,
  labels: {
    no: string;
    provider: string;
    client: string;
    providerFields: Record<string, string>;
    clientFields: Record<string, string>;
    jointly: string;
    signatures: string;
    placeAndDate: string;
    providerRole: string;
    clientRole: string;
    namePosition: string;
    accepted: string;
    notAccepted: string;
  },
): string {
  const locale: AppLocale = view.locale;
  const party = normalizeConsultingAgreementParty(view.party);
  const articles = CONSULTING_AGREEMENT_ARTICLES.map((article) => {
    const clauses = article.clauses
      .map((clause) => {
        const items = clause.items
          ? `<ol class="items">${clause.items
              .map(
                (item) =>
                  `<li><span class="key">${escapeHtml(item.key)})</span> ${escapeHtml(item[locale])}</li>`,
              )
              .join("")}</ol>`
          : "";
        return `<p class="clause"><span class="n">${escapeHtml(clause.n)}.</span> ${escapeHtml(clause[locale])}</p>${items}`;
      })
      .join("");
    return `<section class="article"><h2>${escapeHtml(article.roman)}. ${escapeHtml(pickLocaleText(article.title, locale))}</h2>${clauses}</section>`;
  }).join("");

  const place = [party.city, view.agreementDate].filter(Boolean).join(", ");

  return `<!DOCTYPE html>
<html lang="${locale}">
<head>
<meta charset="utf-8"/>
<title>${escapeHtml(pickLocaleText(CONSULTING_AGREEMENT_BRAND.title, locale))}</title>
<style>
  body { font-family: Georgia, "Times New Roman", serif; color: #111; background: #fff; margin: 0; padding: 32px; line-height: 1.45; }
  .logo { text-align: center; margin: 0 auto 18px; padding: 12px 18px; max-width: 260px; background: #000; border-radius: 8px; }
  .logo img { width: 220px; height: auto; display: block; margin: 0 auto; }
  h1 { text-align: center; font-size: 18px; margin: 8px 0; }
  .meta { text-align: center; margin: 0 0 24px; }
  .party { margin: 16px 0; }
  .party h3 { margin: 0 0 8px; font-size: 13px; letter-spacing: 0.08em; }
  .fill { margin: 4px 0; }
  .article { margin: 22px 0; }
  h2 { font-size: 14px; margin: 0 0 10px; }
  .clause { margin: 8px 0; }
  .n { font-weight: 700; margin-right: 6px; }
  .items { margin: 6px 0 10px 1.4rem; }
  .key { font-weight: 700; margin-right: 4px; }
  .sign { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 28px; }
  .box { border-top: 1px solid #111; padding-top: 10px; }
  .check { margin-top: 8px; }
</style>
</head>
<body>
  <p class="logo"><img src="${escapeHtml(branding.logoPath)}" alt="${escapeHtml(branding.productName)}" /></p>
  <p class="meta">${escapeHtml(pickLocaleText(CONSULTING_AGREEMENT_BRAND.program, locale))}</p>
  <h1>${escapeHtml(pickLocaleText(CONSULTING_AGREEMENT_BRAND.title, locale))}</h1>
  <p class="meta">${escapeHtml(labels.no)} ${escapeHtml(view.agreementNumber)}</p>
  <section class="party">
    <h3>${escapeHtml(labels.provider)}</h3>
    <p>${escapeHtml(pickLocaleText(CONSULTING_AGREEMENT_BRAND.providerLegalName, locale))}</p>
    <p class="fill">${escapeHtml(labels.providerFields.ico)} ${escapeHtml("____________________")}</p>
    <p class="fill">${escapeHtml(labels.providerFields.dic)} ${escapeHtml("____________________")}</p>
    <p class="fill">${escapeHtml(labels.providerFields.authority)} ${escapeHtml("____________________")}</p>
    <p class="fill">${escapeHtml(labels.providerFields.bank)} ${escapeHtml("____________________")}</p>
  </section>
  <section class="party">
    <h3>${escapeHtml(labels.client)}</h3>
    <p><strong>${escapeHtml(dash(party.fullName))}</strong></p>
    <p class="fill">${escapeHtml(labels.clientFields.passport)} ${escapeHtml(dash(party.passportNumber))}</p>
    <p class="fill">${escapeHtml(labels.clientFields.issued)} ${escapeHtml(dash(party.passportIssueDate))}</p>
    <p class="fill">${escapeHtml(labels.clientFields.country)} ${escapeHtml(dash(party.country))}</p>
    <p class="fill">${escapeHtml(labels.clientFields.postalCode)} ${escapeHtml(dash(party.postalCode))}</p>
    <p class="fill">${escapeHtml(labels.clientFields.city)} ${escapeHtml(dash(party.city))}</p>
    <p class="fill">${escapeHtml(labels.clientFields.address)} ${escapeHtml(dash(party.address))}</p>
    <p class="fill">${escapeHtml(labels.clientFields.email)} ${escapeHtml(dash(party.email))}</p>
    <p class="fill">${escapeHtml(labels.clientFields.phone)} ${escapeHtml(dash(party.phone))}</p>
  </section>
  <p>${escapeHtml(labels.jointly)}</p>
  ${articles}
  <h2>${escapeHtml(labels.signatures)}</h2>
  <p>${escapeHtml(labels.placeAndDate)} ${escapeHtml(dash(place))}</p>
  <div class="sign">
    <div class="box">
      <p>${escapeHtml(labels.providerRole)}</p>
      <p>${escapeHtml(labels.namePosition)}</p>
      <p class="check">${view.employeeAccepted ? escapeHtml(labels.accepted) : escapeHtml(labels.notAccepted)}</p>
    </div>
    <div class="box">
      <p>${escapeHtml(labels.clientRole)}</p>
      <p>${escapeHtml(labels.namePosition)} <strong>${escapeHtml(dash(party.fullName))}</strong></p>
      <p class="check">${view.clientAccepted ? escapeHtml(labels.accepted) : escapeHtml(labels.notAccepted)}</p>
    </div>
  </div>
</body>
</html>`;
}

export function consultingAgreementFileName(locale: AppLocale): string {
  return locale === "ru"
    ? "Dogovor-SPIORA-konsultacionnye-uslugi.html"
    : "SPIORA-consulting-services-agreement.html";
}
