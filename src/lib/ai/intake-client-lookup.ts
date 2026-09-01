import type { AppLocale } from "@/i18n/config";
import {
  formatPassportLookupReply,
  looksLikePassportNumber,
} from "@/lib/ai/format-client";
import {
  asksIntakeFieldLookup,
  collectIntakeReviewFields,
  extractFieldHint,
  rankIntakeFieldsForQuery,
} from "@/lib/ai/intake-field-match";
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
  email: [/email/i, /e-mail/i, /почт/i],
  phone: [/phone/i, /телефон/i],
};

const NAME_NOISE_TOKENS =
  /^(?:паспорт(?:а|у|ом)?|когда|родилась|номер|гражданств(?:о|а|e)?|citizenship|адрес(?:а|у|ом)?|address|email|e-mail|почт(?:а|у|e)?|телефон(?:а|у|ом)?|phone)$/iu;

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

  if (fieldKey === "email" && detail.record.email?.trim()) {
    return detail.record.email.trim();
  }
  if (fieldKey === "phone" && detail.record.phone?.trim()) {
    return detail.record.phone.trim();
  }

  return null;
}

function formatIntakeFieldReply(
  clientName: string,
  label: string,
  value: string,
  locale: AppLocale,
): string {
  return locale === "ru"
    ? `**${label}** (${clientName}): ${value} · из анкеты (/clients/intake).`
    : `**${label}** (${clientName}): ${value} · from intake (/clients/intake).`;
}

function formatIntakeFieldMissingReply(
  clientName: string,
  label: string,
  locale: AppLocale,
): string {
  return locale === "ru"
    ? `У **${clientName}** в анкете поле «${label}» не заполнено.`
    : `Field "${label}" is empty in the intake form for **${clientName}**.`;
}

function buildGenericIntakeFieldReply(
  query: string,
  detail: NonNullable<Awaited<ReturnType<typeof getEmployeeCaseDetail>>>,
  clientName: string,
  nameTokens: string[],
  locale: AppLocale,
): string | null {
  const fields = collectIntakeReviewFields(detail);
  const ranked = rankIntakeFieldsForQuery(query, fields, nameTokens);
  if (ranked.length === 0) return null;

  if (
    ranked.length > 1 &&
    ranked[0].score === ranked[1].score &&
    ranked[0].score < 20
  ) {
    const options = ranked
      .slice(0, 5)
      .map((field) => `- ${field.label}: ${field.value}`)
      .join("\n");
    return locale === "ru"
      ? `По **${clientName}** нашёл несколько полей анкеты. Уточните запрос:\n${options}`
      : `Multiple intake fields match for **${clientName}**. Please clarify:\n${options}`;
  }

  const best = ranked[0];
  return formatIntakeFieldReply(clientName, best.label, best.value, locale);
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

export function asksEmailQuery(query: string): boolean {
  return /(?:email|e-mail|почт)/iu.test(query);
}

export function asksPhoneQuery(query: string): boolean {
  return /(?:телефон|phone)/iu.test(query);
}

export function asksIntakeClientFact(query: string): boolean {
  const tokens = nameTokensFromQuery(query);
  return (
    /паспорт/iu.test(query) ||
    asksIntakeBirthDate(query) ||
    asksCitizenshipQuery(query) ||
    asksAddressQuery(query) ||
    asksEmailQuery(query) ||
    asksPhoneQuery(query) ||
    /личн(?:ые|ая)\s+данн/iu.test(query) ||
    asksIntakeFieldLookup(query, tokens)
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

function appendKnownFieldReplies(
  query: string,
  detail: NonNullable<Awaited<ReturnType<typeof getEmployeeCaseDetail>>>,
  name: string,
  locale: AppLocale,
): string[] {
  const parts: string[] = [];

  if (/паспорт/iu.test(query)) {
    const passport = findReviewValue(detail, "passport_number");
    if (passport && looksLikePassportNumber(passport)) {
      parts.push(
        formatPassportLookupReply(name, passport).replace(
          "таблица «Клиенты»",
          "анкета (/clients/intake)",
        ),
      );
    } else {
      parts.push(formatIntakeFieldMissingReply(name, "Номер паспорта", locale));
    }
  }

  if (asksIntakeBirthDate(query)) {
    const birth = findReviewValue(detail, "date_of_birth");
    parts.push(
      birth
        ? formatIntakeFieldReply(name, "Дата рождения", birth, locale)
        : formatIntakeFieldMissingReply(name, "Дата рождения", locale),
    );
  }

  if (asksCitizenshipQuery(query)) {
    const citizenship = findReviewValue(detail, "citizenship");
    parts.push(
      citizenship
        ? formatIntakeFieldReply(name, "Гражданство", citizenship, locale)
        : formatIntakeFieldMissingReply(name, "Гражданство", locale),
    );
  }

  if (asksAddressQuery(query)) {
    const address = findReviewValue(detail, "address");
    const country = findReviewValue(detail, "country_of_residence");
    const addressLine = [address, country ? `(${country})` : null]
      .filter(Boolean)
      .join(" ");
    parts.push(
      addressLine
        ? formatIntakeFieldReply(name, "Адрес", addressLine, locale)
        : formatIntakeFieldMissingReply(name, "Адрес", locale),
    );
  }

  if (asksEmailQuery(query)) {
    const email = findReviewValue(detail, "email");
    parts.push(
      email
        ? formatIntakeFieldReply(name, "Email", email, locale)
        : formatIntakeFieldMissingReply(name, "Email", locale),
    );
  }

  if (asksPhoneQuery(query)) {
    const phone = findReviewValue(detail, "phone");
    parts.push(
      phone
        ? formatIntakeFieldReply(name, "Телефон", phone, locale)
        : formatIntakeFieldMissingReply(name, "Телефон", locale),
    );
  }

  return parts;
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
  const parts = appendKnownFieldReplies(query, detail, name, locale);

  if (parts.length === 0) {
    const generic = buildGenericIntakeFieldReply(
      query,
      detail,
      name,
      tokens,
      locale,
    );
    if (generic) {
      parts.push(generic);
    } else if (asksIntakeClientFact(query)) {
      const hint = extractFieldHint(query, tokens);
      parts.push(
        locale === "ru"
          ? `У **${name}** в анкете не нашёл поле «${hint || "запрошенное"}».`
          : `Could not find field "${hint || "requested"}" in the intake form for **${name}**.`,
      );
    } else {
      parts.push(
        locale === "ru"
          ? `Заявка **${name}** есть в анкете (/clients/intake), статус: ${match.currentStatus}.`
          : `Intake application for **${name}** exists (/clients/intake), status: ${match.currentStatus}.`,
      );
    }
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

export { asksIntakeFieldLookup, extractFieldHint };
