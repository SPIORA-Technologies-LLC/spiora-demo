import type { AppLocale } from "@/i18n/config";
import { extractPersonNameTokens } from "@/lib/ai/name-matching";
import { normalizeComparable } from "@/lib/ai/search-normalize";
import {
  rankIntakeClientsByQuery,
} from "@/lib/ai/intake-client-lookup";
import { getEmployeeCaseDetail } from "@/lib/client-portal/case-service";
import type { ClientCaseIntakeItem } from "@/lib/client-portal/case-types";
import type { ConsultingAgreementSignView } from "@/lib/client-portal/sign-types";
import { listPendingContractSignatures } from "@/lib/dashboard/command-center-pending-signatures";
import { listClients } from "@/lib/clients/store";

const CONTRACT_LIST_NOISE = new Set([
  "каких",
  "какие",
  "какой",
  "какая",
  "какое",
  "еще",
  "ещё",
  "других",
  "другие",
  "другой",
  "всех",
  "все",
  "проблема",
  "проблемы",
  "проблему",
  "договор",
  "договора",
  "договором",
  "договорами",
  "договоров",
  "подпис",
  "подписать",
  "подписан",
  "подписание",
  "нужно",
  "надо",
  "осталось",
  "есть",
  "клиент",
  "клиента",
  "клиентов",
  "клиентом",
  "contract",
  "contracts",
  "agreement",
  "agreements",
  "signature",
  "signed",
  "signing",
  "pending",
  "awaiting",
  "проблем",
]);

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

function intakeContractNavPath(locale: AppLocale): string {
  return locale === "ru"
    ? "Новые клиенты из анкеты → **Заявка клиента** → вкладка **«Договор»**"
    : "New clients from questionnaire → **Client application** → **Agreement** tab";
}

function intakeContractLinkLabel(locale: AppLocale): string {
  return locale === "ru"
    ? "Заявка клиента → Договор"
    : "Client application → Agreement";
}

function intakeContractCardHint(locale: AppLocale): string {
  return locale === "ru"
    ? "Полная карточка по отправленной анкете, вкладка «Договор»"
    : "Full card for the submitted questionnaire, Agreement tab";
}

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

/** Список клиентов с договорами на подписании («у каких клиентов…»). */
export function asksContractListQuery(query: string): boolean {
  if (!asksContractQuery(query)) return false;

  if (
    /(?:у\s+)?(?:каких|какие|какой|какая)\s+(?:ещ[её]|еще|других|другие|всех|все)?\s*(?:клиент|client)/iu.test(
      query,
    ) ||
    /(?:какие|каких|кто)\s+(?:ещ[её]|еще|другие|других|еще\s+есть)/iu.test(
      query,
    ) ||
    (/(?:список|перечисли|покажи)\s+(?:всех|клиент)/iu.test(query) &&
      /(?:договор|подпис|contract)/iu.test(query)) ||
    /(?:где|кому)\s+(?:нужно|надо|осталось)\s+подпис/iu.test(query) ||
    /проблем(?:а|ы)\s+с\s+договор/iu.test(query) ||
    /договор(?:а|ов)?\s+(?:на\s+)?подпис/iu.test(query) ||
    /(?:pending|awaiting)\s+(?:client\s+)?(?:signature|sign)/iu.test(query)
  ) {
    return true;
  }

  return extractContractClientNameTokens(query).length === 0;
}

export function extractContractClientNameTokens(query: string): string[] {
  return extractPersonNameTokens(query).filter(
    (token) => !CONTRACT_LIST_NOISE.has(token.toLowerCase()),
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
    parts.push(
      `Подробнее: [${intakeContractLinkLabel("ru")}](${href}) (${intakeContractCardHint("ru")}).`,
    );
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
  parts.push(
    `Details: [${intakeContractLinkLabel("en")}](${href}) (${intakeContractCardHint("en")}).`,
  );
  return parts.join(" ");
}

function formatCrmContractReply(
  clientName: string,
  contract: string,
  locale: AppLocale,
): string {
  return locale === "ru"
    ? `**Договор** (${clientName}) в таблице «Клиенты»: ${contract}. Электронное подписание — в ${intakeContractNavPath("ru").toLowerCase()}.`
    : `**Agreement** (${clientName}) in Clients table: ${contract}. E-signing status: ${intakeContractNavPath("en").toLowerCase()}.`;
}

function pendingStatusLabel(
  status: "awaiting_client_signature" | "client_signed",
  locale: AppLocale,
): string {
  if (locale === "ru") {
    return status === "awaiting_client_signature"
      ? "ожидается подпись клиента"
      : "клиент подписал, ожидается подпись SPIORA";
  }
  return status === "awaiting_client_signature"
    ? "awaiting client signature"
    : "client signed, awaiting SPIORA";
}

async function lookupContractListReply(
  locale: AppLocale,
): Promise<ContractLookupReply> {
  const pending = await listPendingContractSignatures();

  if (pending.length === 0) {
    return {
      found: true,
      reply:
        locale === "ru"
          ? "Сейчас **нет клиентов с незавершённым подписанием договора** — все актуальные договоры либо подписаны, либо ещё не созданы в карточках заявок."
          : "There are **no clients with agreements still awaiting signature** — active agreements are either fully signed or not created yet.",
    };
  }

  const lines = pending.slice(0, 20).map((item, index) => {
    const status = pendingStatusLabel(item.status, locale);
    const linkLabel = intakeContractLinkLabel(locale);
    return `${index + 1}. **${item.clientName}** — ${status} · [${linkLabel}](${item.href})`;
  });

  const header =
    locale === "ru"
      ? `**Клиенты с незавершённым подписанием договора** (${pending.length}):`
      : `**Clients with agreements awaiting signature** (${pending.length}):`;

  const footer =
    pending.length > 20
      ? locale === "ru"
        ? `\n\nПоказано 20 из ${pending.length}. Откройте карточку: ${intakeContractNavPath("ru")}.`
        : `\n\nShowing 20 of ${pending.length}. Open each card: ${intakeContractNavPath("en")}.`
      : locale === "ru"
        ? `\n\nПуть в интерфейсе: ${intakeContractNavPath("ru")}.`
        : `\n\nNavigation: ${intakeContractNavPath("en")}.`;

  return {
    found: true,
    reply: `${header}\n${lines.join("\n")}${footer}`,
  };
}

export async function lookupContractReply(
  query: string,
  locale: AppLocale = "ru",
): Promise<ContractLookupReply | null> {
  if (!asksContractQuery(query)) return null;

  if (asksContractListQuery(query)) {
    return lookupContractListReply(locale);
  }

  const tokens = extractContractClientNameTokens(query);
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
          ? `У **${name}** заявка есть — откройте [${intakeContractLinkLabel("ru")}](/clients/intake/${match.id}) (${intakeContractCardHint("ru")}). Электронный договор ещё не создан.`
          : `Intake case exists for **${name}** — open [${intakeContractLinkLabel("en")}](/clients/intake/${match.id}) (${intakeContractCardHint("en")}). No e-sign agreement yet.`,
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
        ? `Клиента **${nameHint}** не нашёл ни в «Клиентах», ни в заявках из анкеты. Проверьте написание или откройте ${intakeContractNavPath("ru").toLowerCase()}.`
        : `No client **${nameHint}** in Clients or intake. Check spelling or open ${intakeContractNavPath("en").toLowerCase()}.`,
  };
}
