import { extractPersonNameTokens } from "@/lib/ai/name-matching";

export type WorkspaceQueryIntent = {
  /** Букинг/адрес конкретного клиента — ответ из CRM без широкого контекста */
  fastClientLookup: boolean;
  needsKb: boolean;
  needsClients: boolean;
  needsIntake: boolean;
  needsEmigrantDesk: boolean;
};

/** Номер паспорта из CRM «Клиенты», а не скан/PDF документа. */
export function isPassportNumberLookupQuery(query: string): boolean {
  const lower = query.toLowerCase();
  if (
    /номер\s+(?:загран(?:ичного)?\s+)?паспорта/iu.test(query) ||
    /паспорт\s*(?:номер|№|no\.?)/iu.test(query)
  ) {
    return true;
  }
  if (!lower.includes("паспорт")) return false;
  if (
    lower.includes("скан") ||
    lower.includes("копи") ||
    lower.includes("pdf") ||
    lower.includes("drive") ||
    lower.includes("файл") ||
    (lower.includes("документ") && !lower.includes("номер"))
  ) {
    return false;
  }
  const hasClientName =
    extractPersonNameTokens(query).length > 0 ||
    /(?:клиент[а-я]*|у)\s+[\p{L}][\p{L}'-]{2,}/iu.test(query);
  return (
    hasClientName ||
    lower.includes("какой") ||
    lower.includes("какая") ||
    lower.includes("скажи")
  );
}

export function detectWorkspaceIntent(query: string): WorkspaceQueryIntent {
  const lower = query.toLowerCase();

  const asksPassportFromTable = isPassportNumberLookupQuery(query);

  const hasClientName =
    extractPersonNameTokens(query).length > 0 ||
    /(?:клиент[а-я]*|у)\s+[\p{L}][\p{L}'-]{2,}/iu.test(query);
  const fastClientLookup =
    hasClientName &&
    (lower.includes("букинг") ||
      lower.includes("адрес") ||
      lower.includes("статус") ||
      asksPassportFromTable);

  const needsKb =
    lower.includes("база знан") ||
    lower.includes("база данн") ||
    lower.includes("knowledge") ||
    lower.includes("программ") ||
    lower.includes("digital nomad") ||
    lower.includes("требован") ||
    lower.includes("immigration") ||
    lower.includes("иммиграц");

  const asksBirthDate =
    /родил|рожден|date of birth|дата рожд/iu.test(query);

  const needsIntake =
    lower.includes("анкет") ||
    lower.includes("intake") ||
    lower.includes("questionnaire") ||
    lower.includes("новые клиенты из анкет") ||
    /нов(?:ые|ая|ую)\s+заявк/iu.test(query) ||
    (lower.includes("заявк") &&
      (lower.includes("анкет") ||
        lower.includes("intake") ||
        lower.includes("questionnaire"))) ||
    (hasClientName && (asksPassportFromTable || asksBirthDate));

  const needsEmigrantDesk =
    lower.includes("emigrant") ||
    lower.includes("эмигрант") ||
    lower.includes("кабинет") ||
    lower.includes("статус дела") ||
    lower.includes("статус клиента") ||
    lower.includes("текущий статус") ||
    lower.includes("внж одобрен") ||
    lower.includes("виза d") ||
    lower.includes("дело №") ||
    lower.includes("дело no") ||
    (lower.includes("статус") && lower.includes("клиент"));

  const needsClientsBase =
    !needsKb ||
    needsEmigrantDesk ||
    fastClientLookup ||
    lower.includes("клиент") ||
    lower.includes("букинг") ||
    lower.includes("менеджер") ||
    lower.includes("хорват") ||
    lower.includes("сколько");

  const needsClients =
    needsIntake
      ? hasClientName ||
        lower.includes("клиент") ||
        lower.includes("базе клиент") ||
        lower.includes("база клиент")
      : needsClientsBase;

  return {
    fastClientLookup,
    needsKb: needsKb && !fastClientLookup,
    needsClients,
    needsIntake: needsIntake || hasClientName,
    needsEmigrantDesk,
  };
}
