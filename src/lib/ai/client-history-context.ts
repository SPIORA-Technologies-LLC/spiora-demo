import {
  extractMeaningfulPersonNameTokens,
} from "@/lib/ai/name-matching";

export type ChatTurn = { role: "user" | "assistant"; content: string };

const PRONOUN_REFERENCE =
  /(?:^|[\s,?])(?:у\s+)?(?:нее|неё|него|нем|нём|ней|них|ними|его|её|ey|her|him|them)(?=\s|$|[?.!,])/iu;

const SKIP_BOLD_LABEL =
  /^(?:договор|клиент|клиенты|анкет|заявк|статус|crm|intake|новые|раздел|путь|таблиц)/iu;

/** Запрос ссылается на клиента местоимением («у неё», «у него»). */
export function hasPronounClientReference(query: string): boolean {
  return PRONOUN_REFERENCE.test(query);
}

/** Имя клиента из недавней истории диалога. */
export function extractClientNameFromHistory(
  history: ChatTurn[],
): string | null {
  for (let i = history.length - 1; i >= 0; i--) {
    const turn = history[i];

    if (turn.role === "user") {
      const tokens = extractMeaningfulPersonNameTokens(turn.content);
      if (tokens.length >= 2) {
        return tokens.join(" ");
      }
      if (tokens.length === 1 && tokens[0].length >= 4) {
        return tokens[0];
      }
    }

    if (turn.role === "assistant") {
      const boldMatches = turn.content.matchAll(/\*\*([^*]{3,80})\*\*/g);
      for (const match of boldMatches) {
        const label = match[1].trim();
        if (SKIP_BOLD_LABEL.test(label)) continue;
        const tokens = extractMeaningfulPersonNameTokens(label);
        if (tokens.length >= 1) {
          return tokens.join(" ");
        }
      }

      const entity = turn.content.match(
        /(?:заявка|клиент|договор|гражданство|адрес|паспорт)[^\n*]*?\(([A-Za-zА-Яа-яЁё][A-Za-zА-Яа-яЁё\s'-]{2,60})\)/iu,
      );
      if (entity?.[1]) {
        const tokens = extractMeaningfulPersonNameTokens(entity[1]);
        if (tokens.length >= 1) {
          return tokens.join(" ");
        }
      }
    }
  }

  return null;
}

function injectClientName(query: string, clientName: string): string {
  if (hasPronounClientReference(query)) {
    return query
      .replace(
        /(?:^|\s)(?:у\s+)?(?:нее|неё|него|нем|нём|ней|его|её|her|him)(?=\s|$|[?.!,])/iu,
        ` у ${clientName}`,
      )
      .trim();
  }
  return `${clientName} ${query}`;
}

/**
 * Подставляет клиента из истории для follow-up («у неё паспорт», «какой адрес»).
 * Если в запросе уже есть имя — возвращает его без изменений.
 */
export function resolveContextualClientQuery(
  query: string,
  history: ChatTurn[] = [],
): string {
  const trimmed = query.trim();
  if (!trimmed) return trimmed;

  const meaningfulTokens = extractMeaningfulPersonNameTokens(trimmed);
  if (meaningfulTokens.length >= 1 && !hasPronounClientReference(trimmed)) {
    return trimmed;
  }

  const clientName = extractClientNameFromHistory(history);
  if (!clientName) return trimmed;

  if (
    hasPronounClientReference(trimmed) ||
    meaningfulTokens.length === 0 ||
    (meaningfulTokens.length === 1 && meaningfulTokens[0].length < 4)
  ) {
    return injectClientName(trimmed, clientName);
  }

  return trimmed;
}

export function hasRecentClientInHistory(history: ChatTurn[]): boolean {
  return extractClientNameFromHistory(history) !== null;
}
