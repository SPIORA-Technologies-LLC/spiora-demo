import type { AppLocale } from "@/i18n/config";
import {
  scorePersonName,
  tokenizeSearchQuery,
} from "@/lib/ai/name-matching";
import {
  getEmployeeCaseDetail,
  listIntakeCases,
} from "@/lib/client-portal/case-service";
import { caseStatusLabel } from "@/lib/client-portal/case-status-labels";
import type { ClientCaseIntakeItem } from "@/lib/client-portal/case-types";

const MAX_INTAKE_LIST = 80;
const MAX_SELECTED_SUMMARY = 12;
const MAX_DETAILED_CASES = 3;
const MAX_REVIEW_ITEMS = 40;

function intakeFullName(item: ClientCaseIntakeItem): string {
  return [item.firstName, item.lastName]
    .map((part) => part.trim())
    .filter((part) => part && part !== "—")
    .join(" ")
    .trim();
}

function scoreIntakeItem(item: ClientCaseIntakeItem, tokens: string[]): number {
  const name = intakeFullName(item);
  const nameParts = name.split(/\s+/).filter(Boolean);
  const nameScore = scorePersonName(
    nameParts[0],
    nameParts.slice(1).join(" ") || null,
    tokens,
  );
  if (nameScore > 0) return nameScore;

  const hay = [
    name,
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

function formatIntakeSummary(
  item: ClientCaseIntakeItem,
  locale: AppLocale,
): string {
  const name = intakeFullName(item) || "—";
  const status = caseStatusLabel(item.currentStatus, locale === "ru" ? "ru" : "en");
  const parts = [
    `- ${name}`,
    `email: ${item.email || "—"}`,
    `статус: ${status}`,
    item.serviceType ? `услуга: ${item.serviceType}` : null,
    item.assignedName ? `менеджер: ${item.assignedName}` : null,
    `подано: ${item.submittedAt.slice(0, 10)}`,
    `caseId: ${item.id}`,
  ].filter(Boolean);
  return parts.join(" · ");
}

function formatIntakeDetail(
  item: ClientCaseIntakeItem,
  detail: NonNullable<Awaited<ReturnType<typeof getEmployeeCaseDetail>>>,
  locale: AppLocale,
): string {
  const name = intakeFullName(item) || "—";
  const status = caseStatusLabel(item.currentStatus, locale === "ru" ? "ru" : "en");
  const lines = [
    `---`,
    `Анкета / кейс: ${name}`,
    `Email: ${item.email || "—"}`,
    `Телефон: ${detail.record.phone || "—"}`,
    `Статус: ${status}`,
    item.serviceType ? `Услуга: ${item.serviceType}` : null,
    item.assignedName ? `Назначен: ${item.assignedName}` : null,
    `Подано: ${item.submittedAt.slice(0, 10)}`,
    item.crmClientId ? `Связан с CRM: ${item.crmClientId}` : "Связь с CRM: нет",
    `caseId: ${item.id}`,
  ].filter(Boolean) as string[];

  if (detail.comments.length > 0) {
    const latest = detail.comments.slice(0, 3);
    lines.push("Комментарии команды:");
    for (const comment of latest) {
      lines.push(
        `- ${comment.authorName}: ${comment.body.slice(0, 240)}`,
      );
    }
  }

  if (detail.clientDocuments.length > 0 || detail.employeeDocuments.length > 0) {
    lines.push(
      `Документы: клиент ${detail.clientDocuments.length}, сотрудник ${detail.employeeDocuments.length}`,
    );
  }

  let reviewCount = 0;
  for (const section of detail.reviewSections) {
    const filled = section.items.filter((entry) => entry.value && entry.value !== "—");
    if (filled.length === 0) continue;
    lines.push(`Секция анкеты: ${section.title}`);
    for (const entry of filled) {
      if (reviewCount >= MAX_REVIEW_ITEMS) break;
      lines.push(`- ${entry.label}: ${entry.value}`);
      reviewCount += 1;
    }
    if (reviewCount >= MAX_REVIEW_ITEMS) {
      lines.push("… (остальные ответы анкеты сокращены)");
      break;
    }
  }

  lines.push("---");
  return lines.join("\n");
}

function wantsIntakeDetails(userQuery: string, selectedCount: number): boolean {
  if (selectedCount <= 2) return true;
  return /анкет|questionnaire|суммир|подроб|что\s+в|ответы|review|паспорт|passport|родил|рожден|date of birth|дата рожд|гражданств|citizenship|адрес|address|прожива|телефон|phone|email|почт|семейн| marital|пол\b|граждан|внж|услуг/iu.test(
    userQuery,
  );
}

export async function buildIntakeContextForAi(
  userQuery: string,
  locale: AppLocale = "en",
): Promise<{ text: string; count: number }> {
  try {
    const tokens = tokenizeSearchQuery(userQuery);
    const search =
      tokens.length > 0 ? tokens.slice(0, 3).join(" ") : undefined;

    const listed = await listIntakeCases({
      search,
      page: 1,
      pageSize: MAX_INTAKE_LIST,
    });

    if (listed.total === 0) {
      return {
        text: "Новые клиенты из анкеты: заявок нет или раздел пуст.",
        count: 0,
      };
    }

    const ranked = [...listed.items].sort(
      (a, b) => scoreIntakeItem(b, tokens) - scoreIntakeItem(a, tokens),
    );

    const selected =
      tokens.length === 0
        ? ranked.slice(0, MAX_SELECTED_SUMMARY)
        : ranked.some((item) => scoreIntakeItem(item, tokens) > 0)
          ? ranked
              .filter((item) => scoreIntakeItem(item, tokens) > 0)
              .slice(0, MAX_SELECTED_SUMMARY)
          : ranked.slice(0, MAX_SELECTED_SUMMARY);

    const detailed = wantsIntakeDetails(userQuery, selected.length);
    const detailTargets = detailed
      ? selected.slice(0, MAX_DETAILED_CASES)
      : [];

    const details = await Promise.all(
      detailTargets.map(async (item) => {
        try {
          const detail = await getEmployeeCaseDetail(
            item.id,
            locale === "ru" ? "ru" : "en",
          );
          return detail ? { item, detail } : null;
        } catch {
          return null;
        }
      }),
    );

    const detailedLines = details
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      .map(({ item, detail }) => formatIntakeDetail(item, detail, locale));

    const summaryOnly = selected
      .filter((item) => !detailTargets.some((target) => target.id === item.id))
      .map((item) => formatIntakeSummary(item, locale));

    const body = [...detailedLines, ...summaryOnly].join("\n");
    const header = `Новые клиенты из анкеты (/clients/intake): всего ${listed.total}, в контексте ${selected.length}${
      detailedLines.length > 0
        ? `, подробных анкет ${detailedLines.length}`
        : ""
    }.`;

    return {
      text: `${header}\n${body}`,
      count: listed.total,
    };
  } catch (error) {
    console.error("[workspace-ai] intake context failed", error);
    return {
      text: "Новые клиенты из анкеты: не удалось загрузить заявки.",
      count: 0,
    };
  }
}
