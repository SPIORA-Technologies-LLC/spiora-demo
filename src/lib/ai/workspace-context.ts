import type { AppLocale } from "@/i18n/config";
import {
  formatClientForAi,
  formatClientOneLiner,
} from "@/lib/ai/format-client";
import { buildIntakeContextForAi } from "@/lib/ai/intake-context";
import {
  scorePersonName,
  tokenizeSearchQuery,
} from "@/lib/ai/name-matching";
import type { WorkspaceQueryIntent } from "@/lib/ai/query-intent";
import { listClients } from "@/lib/clients/store";
import { buildEmigrantDeskContextForAi } from "@/lib/emigrant-desk/clients";
import type { Client } from "@/lib/google-sheets/types";

const MAX_CLIENTS = 300;

function clientLine(client: Client, detailed = false): string {
  if (detailed) {
    return `---\n${formatClientForAi(client)}\n---`;
  }
  return formatClientOneLiner(client);
}

function scoreClient(client: Client, tokens: string[]): number {
  const nameParts = client.name.trim().split(/\s+/);
  const nameScore = scorePersonName(
    nameParts[0],
    nameParts.slice(1).join(" ") || null,
    tokens,
  );
  if (nameScore > 0) return nameScore;

  const hay = clientLine(client).toLowerCase();
  return tokens.reduce((score, token) => {
    if (token.length >= 4 && hay.includes(token)) return score + 2;
    return score;
  }, 0);
}

export async function buildClientsContextForAi(
  userQuery: string,
): Promise<{ text: string; count: number }> {
  const { items, total, source } = await listClients(1, MAX_CLIENTS);
  const tokens = tokenizeSearchQuery(userQuery);

  const ranked = [...items].sort(
    (a, b) => scoreClient(b, tokens) - scoreClient(a, tokens),
  );

  const selected =
    tokens.length === 0
      ? ranked.slice(0, 12)
      : ranked.some((c) => scoreClient(c, tokens) > 0)
        ? ranked.filter((c) => scoreClient(c, tokens) > 0).slice(0, 6)
        : ranked.slice(0, 10);

  const detailed =
    selected.length <= 3 ||
    tokens.some((t) =>
      ["букинг", "адрес", "паспорт"].some((k) => t.includes(k) || k.includes(t)),
    );
  const lines = selected.map((c) => clientLine(c, detailed || selected.length <= 3));
  const header = `Клиенты (источник: ${source}): всего ${total}, в контексте ${lines.length}.`;

  return {
    text: `${header}\n${lines.join("\n")}`,
    count: total,
  };
}

export type WorkspaceContextBundle = {
  clientsText: string;
  intakeText: string;
  emigrantDeskText: string;
  knowledgeBaseText: string;
  meta: {
    clientsTotal: number;
    intakeTotal: number;
    emigrantDeskTotal: number;
  };
};

export async function buildWorkspaceContext(
  userMessage: string,
  intent: WorkspaceQueryIntent,
  locale: AppLocale = "en",
): Promise<WorkspaceContextBundle> {
  const [clients, intake, emigrantDesk, knowledgeBaseText] = await Promise.all([
    intent.needsClients
      ? buildClientsContextForAi(userMessage)
      : Promise.resolve({ text: "Клиенты: не запрашивались.", count: 0 }),
    intent.needsIntake
      ? buildIntakeContextForAi(userMessage, locale)
      : Promise.resolve({
          text: "Новые клиенты из анкеты: не запрашивались.",
          count: 0,
        }),
    intent.needsEmigrantDesk
      ? buildEmigrantDeskContextForAi(userMessage)
      : Promise.resolve({
          text: "Emigrant Croatia Desk: не запрашивался.",
          count: 0,
        }),
    intent.needsKb
      ? (async () => {
          const { getKnowledgeBaseTextForAi } = await import(
            "@/lib/knowledge-base/knowledge-base-service"
          );
          return getKnowledgeBaseTextForAi(locale, userMessage);
        })()
      : Promise.resolve(
          "База данных: для этого вопроса не подключалась (ускорение ответа).",
        ),
  ]);

  return {
    clientsText: clients.text,
    intakeText: intake.text,
    emigrantDeskText: emigrantDesk.text,
    knowledgeBaseText,
    meta: {
      clientsTotal: clients.count,
      intakeTotal: intake.count,
      emigrantDeskTotal: emigrantDesk.count,
    },
  };
}
