import type { AppLocale } from "@/i18n/config";
import { extractPersonNameTokens } from "@/lib/ai/name-matching";
import { normalizeComparable } from "@/lib/ai/search-normalize";
import {
  rankIntakeClientsByQuery,
} from "@/lib/ai/intake-client-lookup";
import { getEmployeeCaseDetail } from "@/lib/client-portal/case-service";
import type { ClientCaseIntakeItem } from "@/lib/client-portal/case-types";
import type { ConsultingAgreementSignView } from "@/lib/client-portal/sign-types";
import { listClients } from "@/lib/clients/store";

const SIGN_STATUS_LABELS_RU: Record<ConsultingAgreementSignView["status"], string> = {
  draft: "Черновик",
  awaiting_client_signature: "Ожидается подпись клиента",
  client_signed: "Клиент подписал, ожидается подпись SPIORA",
  provider_signed: "Подписан исполнителем SPIORA",
  completed: "Двусторонний договор подписан обеими сторонами",
  expired: "Истёк",
  cancelled: "Договор аннулирован",
  superseded: "Заменён",
};

const SIGN_STATUS_LABELS_EN: Record<ConsultingAgreementSignView["status"], string> = {
  draft: "Draft",
  awaiting_client_signature: "Awaiting client signature",
  client_signed: "Client signed, awaiting SPIORA signature",
  provider_signed: "Signed by SPIORA",
  completed: "Fully signed by both parties",
  expired: "Expired",
  cancelled: "Agreement annulled",
  superseded: "Superseded",
};

export function asksContractQuery(query: string): boolean {
  if (
    /(?:договор|contract|agreement|консультационн(?:ый|ого)\s+договор|подпис(?:ан|ание|ать)|signature)/iu.test(
      query,
    )
  ) {
    return true;
  }
  return (
    /(?:стади|stage|этап|статус)/iu.test(query) &&
    /(?:договор|contract|подпис)/iu.test(query)
  );
}

export type ContractLookupReply = {
  reply: string;
  found: boolean;
  caseId?: string;
};

function intakeFullName(item: ClientCaseIntakeItem): string {
  return [item.firstName, item.lastName]
    .map((part) => part.trim())
    .filter((part) => part && part !== "—")
    .join(" ")
    .trim();
}

async function findCrmClientByNameTokens(
  tokens: string[],
): Promise<Awaited<ReturnType<typeof listClients>>["items"][number] | null> {
  if (tokens.length === 0) return null;

  const { items } = await listClients(1, 500);
  return (
    items.find((entry) => {
      const hay = `${entry.name} ${entry.citizenship ?? ""}`.toLowerCase();
      const comparable = normalizeComparable(`${entry.name} ${entry.citizenship ?? ""}`);
      return tokens.every(
        (token) =>
          hay.includes(token.toLowerCase()) ||
          comparable.includes(normalizeComparable(token)),
      );
    }) ?? null
  );
}

function statusLabel(
  status: ConsultingAgreementSignView["status"],
  locale: AppLocale,
): string {
  return locale === "ru"
    ? SIGN_STATUS_LABELS_RU[status]
    : SIGN_STATUS_LABELS_EN[status];
}

function isFullySigned(status: ConsultingAgreementSignView["status"]): boolean {
  return status === "completed" || status === "provider_signed";
}

function isPartiallySigned(status: ConsultingAgreementSignView["status"]): boolean {
  return status === "client_signed";
}

function formatSignContractReply(
  clientName: string,
  sign: ConsultingAgreementSignView,
  caseId: string,
  locale: AppLocale,
): string {
  const status = statusLabel(sign.status, locale);
  const href = `/clients/intake/${caseId}`;
  const number = sign.agreementNumber?.trim();

  if (locale === "ru") {
    const signedLine = isFullySigned(sign.status)
      ? "Да, договор подписан."
      : isPartiallySigned(sign.status)
        ? "Клиент подписал; ожидается подпись SPIORA."
        : sign.status === "awaiting_client_signature"
          ? "Нет, договор ещё не подписан клиентом."
          : sign.status === "cancelled"
            ? "Договор аннулирован."
            : sign.status === "draft"
              ? "Договор в черновике, подписание не начато."
              : `Статус подписания: ${status}.`;

    const parts = [
      `**Договор** (${clientName}): ${signedLine}`,
      `Стадия: **${status}**.`,
    ];
    if (number) parts.push(`№ договора: ${number}.`);
    if (sign.clientSignedAt) {
      parts.push(`Подпись клиента: ${sign.clientSignedAt.slice(0, 10)}.`);
    }
    if (sign.providerSignedAt) {
      parts.push(`Подпись SPIORA: ${sign.providerSignedAt.slice(0, 10)}.`);
    }
    parts.push(`Подробнее: ${href} → раздел «Договор».`);
    return parts.join(" ");
  }

  const signedLine = isFullySigned(sign.status)
    ? "Yes, the agreement is signed."
    : isPartiallySigned(sign.status)
      ? "Client signed; awaiting SPIORA signature."
      : sign.status === "awaiting_client_signature"
        ? "No, the client has not signed yet."
        : sign.status === "cancelled"
          ? "The agreement was annulled."
          : sign.status === "draft"
            ? "Agreement is still a draft."
            : `Signing status: ${status}.`;

  const parts = [
    `**Agreement** (${clientName}): ${signedLine}`,
    `Stage: **${status}**.`,
  ];
  if (number) parts.push(`Agreement #: ${number}.`);
  if (sign.clientSignedAt) {
    parts.push(`Client signed: ${sign.clientSignedAt.slice(0, 10)}.`);
  }
  if (sign.providerSignedAt) {
    parts.push(`SPIORA signed: ${sign.providerSignedAt.slice(0, 10)}.`);
  }
  parts.push(`Details: ${href} → Agreement tab.`);
  return parts.join(" ");
}

function formatCrmContractReply(
  clientName: string,
  contract: string,
  locale: AppLocale,
): string {
  return locale === "ru"
    ? `**Договор** (${clientName}) в таблице «Клиенты»: ${contract}. Электронное подписание смотрите в карточке заявки из анкеты, если клиент проходил онбординг.`
    : `**Agreement** (${clientName}) in Clients table: ${contract}. For e-signing status, open the intake case if the client completed onboarding.`;
}

export async function lookupContractReply(
  query: string,
  locale: AppLocale = "ru",
): Promise<ContractLookupReply | null> {
  if (!asksContractQuery(query)) return null;

  const tokens = extractPersonNameTokens(query);
  if (tokens.length === 0) return null;

  const ranked = await rankIntakeClientsByQuery(query);
  const crmClient = await findCrmClientByNameTokens(tokens);

  if (
    ranked.length > 1 &&
    ranked[0] &&
    ranked[1] &&
    ranked[0].id !== ranked[1].id
  ) {
    const options = ranked
      .slice(0, 5)
      .map((item) => `- ${intakeFullName(item)} (${item.email || "—"})`)
      .join("\n");
    return {
      found: true,
      reply:
        locale === "ru"
          ? `Нашёл несколько заявок. Уточните клиента для проверки договора:\n${options}`
          : `Multiple intake cases match. Please clarify the client:\n${options}`,
    };
  }

  if (ranked.length === 1) {
    const match = ranked[0];
    const detail = await getEmployeeCaseDetail(
      match.id,
      locale === "ru" ? "ru" : "en",
    );
    const name = intakeFullName(match) || crmClient?.name || "—";
    const sign = detail?.agreement?.sign;

    if (sign) {
      return {
        found: true,
        caseId: match.id,
        reply: formatSignContractReply(name, sign, match.id, locale),
      };
    }

    if (crmClient?.contract && crmClient.contract !== "—") {
      return {
        found: true,
        reply: formatCrmContractReply(name, crmClient.contract, locale),
      };
    }

    return {
      found: true,
      caseId: match.id,
      reply:
        locale === "ru"
          ? `У **${name}** заявка есть (/clients/intake/${match.id}), но электронный договор ещё не создан. Откройте карточку → раздел «Договор».`
          : `Intake case exists for **${name}** (/clients/intake/${match.id}), but no e-sign agreement yet. Open the case → Agreement tab.`,
    };
  }

  if (crmClient?.contract && crmClient.contract !== "—") {
    return {
      found: true,
      reply: formatCrmContractReply(crmClient.name, crmClient.contract, locale),
    };
  }

  const nameHint = tokens.slice(0, 2).join(" ");
  return {
    found: false,
    reply:
      locale === "ru"
        ? `Клиента **${nameHint}** не нашёл ни в «Клиентах», ни в заявках из анкеты. Проверьте написание или откройте раздел «Договор» в карточке заявки.`
        : `No client **${nameHint}** in Clients or intake. Check spelling or open the Agreement tab on the intake case.`,
  };
}
