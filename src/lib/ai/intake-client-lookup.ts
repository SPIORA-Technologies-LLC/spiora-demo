import type { AppLocale } from "@/i18n/config";
import {
  formatPassportLookupReply,
  looksLikePassportNumber,
} from "@/lib/ai/format-client";
import {
  scorePersonName,
  tokenizeSearchQuery,
} from "@/lib/ai/name-matching";
import {
  getEmployeeCaseDetail,
  listIntakeCases,
} from "@/lib/client-portal/case-service";
import type { ClientCaseIntakeItem } from "@/lib/client-portal/case-types";

const INTAKE_FIELD_ALIASES: Record<string, RegExp[]> = {
  passport_number: [/passport/i, /паспорт/i, /номер паспорта/i],
  date_of_birth: [/date of birth/i, /дата рождения/i, /рожден/i],
};

function intakeFullName(item: ClientCaseIntakeItem): string {
  return [item.firstName, item.lastName]
    .map((part) => part.trim())
    .filter((part) => part && part !== "—")
    .join(" ")
    .trim();
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

  return tokens.reduce((score, token) => {
    if (token.length >= 3 && hay.includes(token)) return score + 2;
    return score;
  }, 0);
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

export function asksIntakePersonalData(query: string): boolean {
  return (
    /паспорт/iu.test(query) ||
    asksIntakeBirthDate(query) ||
    /личн(?:ые|ая)\s+данн/iu.test(query)
  );
}

export type IntakePersonalDataReply = {
  reply: string;
  caseId: string;
};

export async function lookupIntakePersonalDataReply(
  query: string,
  locale: AppLocale = "ru",
): Promise<IntakePersonalDataReply | null> {
  const tokens = tokenizeSearchQuery(query).filter(
    (token) => !/^(?:паспорт(?:а|у|ом)?|когда|родилась|номер)$/iu.test(token),
  );
  if (tokens.length === 0) return null;

  const listed = await listIntakeCases({
    search: tokens.slice(0, 3).join(" "),
    page: 1,
    pageSize: 80,
  });

  const ranked = [...listed.items]
    .filter((item) => scoreIntakeItem(item, tokens) > 0)
    .sort((a, b) => scoreIntakeItem(b, tokens) - scoreIntakeItem(a, tokens));

  if (ranked.length === 0) {
    if (!asksIntakePersonalData(query)) return null;
    const nameHint = tokens.slice(0, 2).join(" ");
    return {
      caseId: "",
      reply:
        locale === "ru"
          ? `Клиента **${nameHint}** не нашёл в новых заявках из анкеты (/clients/intake). Проверьте написание или откройте раздел «Новые клиенты из анкеты».`
          : `No intake application found for **${nameHint}** (/clients/intake). Check the spelling or open New clients from questionnaire.`,
    };
  }

  if (ranked.length > 1 && scoreIntakeItem(ranked[0], tokens) === scoreIntakeItem(ranked[1], tokens)) {
    const options = ranked
      .slice(0, 5)
      .map((item) => `- ${intakeFullName(item)} (${item.email || "—"})`)
      .join("\n");
    return {
      caseId: "",
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
  const parts: string[] = [];

  if (wantsPassport) {
    const passport =
      findReviewValue(detail, "passport_number");
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

  if (parts.length === 0) {
    parts.push(
      locale === "ru"
        ? `Заявка **${name}** есть в анкете (/clients/intake), статус: ${match.currentStatus}.`
        : `Intake application for **${name}** exists (/clients/intake), status: ${match.currentStatus}.`,
    );
  }

  return {
    caseId: match.id,
    reply: parts.join("\n\n"),
  };
}
