import type { AppLocale } from "@/i18n/config";
import {
  formatPassportLookupReply,
  looksLikePassportNumber,
} from "@/lib/ai/format-client";
import {
  scorePersonName,
  tokenizeSearchQuery,
} from "@/lib/ai/name-matching";
import { normalizeComparable } from "@/lib/ai/search-normalize";
import {
  getEmployeeCaseDetail,
  listIntakeCases,
} from "@/lib/client-portal/case-service";
import type { ClientCaseIntakeItem } from "@/lib/client-portal/case-types";

const INTAKE_FIELD_ALIASES: Record<string, RegExp[]> = {
  passport_number: [/passport/i, /паспорт/i, /номер паспорта/i],
  date_of_birth: [/date of birth/i, /дата рождения/i, /рожден/i],
  citizenship: [/citizenship/i, /гражданств/i],
  address: [/^address$/i, /^адрес$/i],
  country_of_residence: [/country of residence/i, /страна проживания/i],
};

const NAME_NOISE_TOKENS =
  /^(?:паспорт(?:а|у|ом)?|когда|родилась|номер|гражданств(?:о|а|e)?|citizenship|адрес(?:а|у|ом)?|address)$/iu;

function intakeFullName(item: ClientCaseIntakeItem): string {
  return [item.firstName, item.lastName]
    .map((part) => part.trim())
    .filter((part) => part && part !== "—")
    .join(" ")
    .trim();
}

function tokenMatchesText(token: string, text: string): boolean {
  const lower = text.toLowerCase();
  if (token.length >= 2 && lower.includes(token)) return true;
  const comparable = normalizeComparable(text);
  const tokenComparable = normalizeComparable(token);
  return tokenComparable.length >= 2 && comparable.includes(tokenComparable);
}

function scoreIntakeItem(item: ClientCaseIntakeItem, tokens: string[]): number {
  const nameParts = intakeFullName(item).split(/\s+/).filter(Boolean);
  const nameScore = scorePersonName(
    nameParts[0],
    nameParts.slice(1).join(" ") || null,
    tokens,
  );
  if (nameScore > 0) return nameScore;

  const hay = [
    intakeFullName(item),
    item.email,
    item.serviceType ?? "",
    item.assignedName ?? "",
    item.currentStatus,
  ]
    .join(" ")
    .toLowerCase();

  const matched = tokens.filter((token) => tokenMatchesText(token, hay));
  return matched.length * 12;
}

function findReviewValue(
  detail: NonNullable<Awaited<ReturnType<typeof getEmployeeCaseDetail>>>,
  fieldKey: keyof typeof INTAKE_FIELD_ALIASES,
): string | null {
  const aliases = INTAKE_FIELD_ALIASES[fieldKey];
  for (const section of detail.reviewSections) {
    for (const item of section.items) {
      const label = item.label.trim();
      if (!item.value || item.value === "—") continue;
      if (aliases.some((pattern) => pattern.test(label))) {
        return item.value.trim();
      }
    }
  }

  return null;
}

export function asksIntakeBirthDate(query: string): boolean {
  return /родил|рожден|date of birth|дата рожд/iu.test(query);
}

export function asksCitizenshipQuery(query: string): boolean {
  return /гражданств|citizenship/iu.test(query);
}

export function asksAddressQuery(query: string): boolean {
  return (
    /(?:^|[^\p{L}])адрес|address|прожива|residence address/iu.test(query) &&
    !/(?:email|e-mail|почт)/iu.test(query)
  );
}

export function asksIntakeClientFact(query: string): boolean {
  return (
    /паспорт/iu.test(query) ||
    asksIntakeBirthDate(query) ||
    asksCitizenshipQuery(query) ||
    asksAddressQuery(query) ||
    /(?:email|почт|e-mail)/iu.test(query) ||
    /(?:телефон|phone)/iu.test(query) ||
    /личн(?:ые|ая)\s+данн/iu.test(query)
  );
}

/** @deprecated use asksIntakeClientFact */
export function asksIntakePersonalData(query: string): boolean {
  return asksIntakeClientFact(query);
}

export type IntakeClientFactReply = {
  reply: string;
  caseId: string;
  found: boolean;
};

async function loadIntakeCasesForTokens(tokens: string[]) {
  const search = tokens.slice(0, 3).join(" ");
  let listed = await listIntakeCases({
    search,
    page: 1,
    pageSize: 80,
  });

  if (listed.items.length === 0 && tokens.length > 1) {
    listed = await listIntakeCases({
      search: tokens[0],
      page: 1,
      pageSize: 80,
    });
  }

  if (listed.items.length === 0) {
    listed = await listIntakeCases({ page: 1, pageSize: 80 });
  }

  return listed;
}

function nameTokensFromQuery(query: string): string[] {
  return tokenizeSearchQuery(query).filter((token) => !NAME_NOISE_TOKENS.test(token));
}

export async function rankIntakeClientsByQuery(
  query: string,
): Promise<ClientCaseIntakeItem[]> {
  const tokens = nameTokensFromQuery(query);
  if (tokens.length === 0) return [];

  const listed = await loadIntakeCasesForTokens(tokens);
  return [...listed.items]
    .filter((item) => scoreIntakeItem(item, tokens) > 0)
    .sort((a, b) => scoreIntakeItem(b, tokens) - scoreIntakeItem(a, tokens));
}

function buildNotFoundReply(
  tokens: string[],
  locale: AppLocale,
): IntakeClientFactReply {
  const nameHint = tokens.slice(0, 2).join(" ");
  return {
    caseId: "",
    found: false,
    reply:
      locale === "ru"
        ? `Клиента **${nameHint}** не нашёл в новых заявках из анкеты (/clients/intake). Проверьте написание или откройте раздел «Новые клиенты из анкеты».`
        : `No intake application found for **${nameHint}** (/clients/intake). Check the spelling or open New clients from questionnaire.`,
  };
}

export async function lookupIntakeClientFactReply(
  query: string,
  locale: AppLocale = "ru",
): Promise<IntakeClientFactReply | null> {
  const tokens = nameTokensFromQuery(query);
  if (tokens.length === 0) return null;

  const ranked = await rankIntakeClientsByQuery(query);

  if (ranked.length === 0) {
    if (!asksIntakeClientFact(query)) return null;
    return buildNotFoundReply(tokens, locale);
  }

  if (
    ranked.length > 1 &&
    scoreIntakeItem(ranked[0], tokens) === scoreIntakeItem(ranked[1], tokens)
  ) {
    const options = ranked
      .slice(0, 5)
      .map((item) => `- ${intakeFullName(item)} (${item.email || "—"})`)
      .join("\n");
    return {
      caseId: "",
      found: true,
      reply:
        locale === "ru"
          ? `Нашёл несколько заявок из анкеты. Уточните клиента:\n${options}`
          : `Multiple intake applications match. Please clarify:\n${options}`,
    };
  }

  const match = ranked[0];
  const detail = await getEmployeeCaseDetail(
    match.id,
    locale === "ru" ? "ru" : "en",
  );
  if (!detail) return null;

  const name = intakeFullName(match) || "—";
  const wantsPassport = /паспорт/iu.test(query);
  const wantsBirth = asksIntakeBirthDate(query);
  const wantsCitizenship = asksCitizenshipQuery(query);
  const wantsAddress = asksAddressQuery(query);
  const parts: string[] = [];

  if (wantsPassport) {
    const passport = findReviewValue(detail, "passport_number");
    if (passport && looksLikePassportNumber(passport)) {
      parts.push(
        formatPassportLookupReply(name, passport).replace(
          "таблица «Клиенты»",
          "анкета (/clients/intake)",
        ),
      );
    } else {
      parts.push(
        locale === "ru"
          ? `У **${name}** в анкете поле «Номер паспорта» не заполнено.`
          : `Passport number is empty in the intake form for **${name}**.`,
      );
    }
  }

  if (wantsBirth) {
    const birth = findReviewValue(detail, "date_of_birth");
    parts.push(
      birth
        ? locale === "ru"
          ? `Дата рождения **${name}**: ${birth} · из анкеты (/clients/intake).`
          : `Date of birth for **${name}**: ${birth} · from intake (/clients/intake).`
        : locale === "ru"
          ? `У **${name}** в анкете не указана дата рождения.`
          : `Date of birth is missing in the intake form for **${name}**.`,
    );
  }

  if (wantsCitizenship) {
    const citizenship = findReviewValue(detail, "citizenship");
    parts.push(
      citizenship
        ? locale === "ru"
          ? `Гражданство **${name}**: ${citizenship} · из анкеты (/clients/intake).`
          : `Citizenship for **${name}**: ${citizenship} · from intake (/clients/intake).`
        : locale === "ru"
          ? `У **${name}** в анкете не указано гражданство.`
          : `Citizenship is missing in the intake form for **${name}**.`,
    );
  }

  if (wantsAddress) {
    const address = findReviewValue(detail, "address");
    const country = findReviewValue(detail, "country_of_residence");
    const addressLine = [address, country ? `(${country})` : null]
      .filter(Boolean)
      .join(" ");
    parts.push(
      addressLine
        ? locale === "ru"
          ? `Адрес **${name}**: ${addressLine} · из анкеты (/clients/intake).`
          : `Address for **${name}**: ${addressLine} · from intake (/clients/intake).`
        : locale === "ru"
          ? `У **${name}** в анкете адрес не указан.`
          : `Address is missing in the intake form for **${name}**.`,
    );
  }

  if (parts.length === 0) {
    if (asksIntakeClientFact(query)) {
      return null;
    }
    parts.push(
      locale === "ru"
        ? `Заявка **${name}** есть в анкете (/clients/intake), статус: ${match.currentStatus}.`
        : `Intake application for **${name}** exists (/clients/intake), status: ${match.currentStatus}.`,
    );
  }

  return {
    caseId: match.id,
    found: true,
    reply: parts.join("\n\n"),
  };
}

/** @deprecated use lookupIntakeClientFactReply */
export async function lookupIntakePersonalDataReply(
  query: string,
  locale: AppLocale = "ru",
): Promise<{ reply: string; caseId: string } | null> {
  const result = await lookupIntakeClientFactReply(query, locale);
  if (!result) return null;
  return { reply: result.reply, caseId: result.caseId };
}
