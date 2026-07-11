import type { ChatCompletionOptions, ChatMessage } from "@/lib/ai/openai";
import { createChatCompletion, streamChatCompletion } from "@/lib/ai/openai";
import type { AppLocale } from "@/i18n/config";
import {
  translateWorkspaceMessage,
  translateWorkspaceSource,
} from "@/i18n/ai-workspace-messages";
import {
  buildDemoFallbackReply,
  shouldUseDemoResponsesOnly,
} from "@/lib/ai/workspace-demo-scenarios";
import {
  formatDemoClientLookupMessage,
  isWorkspaceDiagnosticsEnabled,
} from "@/lib/ai/workspace-demo-safe";
import {
  buildOffTopicReply,
  detectOffTopicCategory,
} from "@/lib/ai/workspace-off-topic";
import {
  detectWorkspaceIntent,
  isPassportNumberLookupQuery,
} from "@/lib/ai/query-intent";
import { extractPersonNameTokens } from "@/lib/ai/name-matching";
import { extractPassportFromClientRecord } from "@/lib/ai/client-passport";
import {
  formatPassportLookupReply,
  formatPassportMissingReply,
  looksLikePassportNumber,
} from "@/lib/ai/format-client";
import {
  getWorkspaceAiConfig,
  type WorkspaceResponseMode,
} from "@/lib/ai/workspace-config";
import {
  formatClientCandidatesForAi,
  formatClientContextBlock,
  formatDebugClientReply,
  formatMergedClientContextBlock,
  isMergedClientContext,
  type ClientCandidateScenario,
  type ClientContext,
  type EmigrantDeskContextSlice,
  type ResolvedClientContext,
} from "@/lib/ai/client-context";
import {
  formatClientSearchIntentForAi,
  shouldOfferClientSelection,
} from "@/lib/ai/client-search-intent";
import {
  buildClientSearchQuery,
  groupDuplicateClients,
  isDebugClientCommand,
  lookupAllClientMatches,
  lookupClientsWithAiSearch,
  lookupFuzzyClientCandidates,
  parseDebugClientQuery,
  scanRawRowsForTokens,
} from "@/lib/ai/client-lookup";
import {
  followUpToClientContext,
  resolveClientSelectionFollowUp,
} from "@/lib/ai/client-selection-followup";
import { mergeClientContexts } from "@/lib/ai/client-deduplication";
import {
  redactSensitiveText,
  sanitizeClientContextsForTransport,
} from "@/lib/ai/context-redaction";
import { buildWorkspaceSystemPrompt } from "@/lib/ai/workspace-prompt";
import { buildWorkspaceContext } from "@/lib/ai/workspace-context";
import {
  emigrantDeskClientToContextSlice,
  findEmigrantDeskClientByQuery,
} from "@/lib/emigrant-desk/clients";
import {
  formatFormgridRowSummary,
  listFormgridRowsSince,
  parseRecentDaysFromQuery,
} from "@/lib/google-sheets/formgrid-dates";
import { getFormgridLeadsTable } from "@/lib/google-sheets/formgrid-leads";
import { listClients } from "@/lib/google-sheets/service";

export type { WorkspaceResponseMode } from "@/lib/ai/workspace-config";

export type WorkspaceChatTurn = {
  role: "user" | "assistant";
  content: string;
};

export type WorkspaceAiResult = {
  reply: string;
  sources: string[];
  demo: boolean;
  pendingClientCandidates?: ClientContext[];
  needsClientSelection?: boolean;
};

export type WorkspaceAiStreamMeta = {
  sources: string[];
  demo: boolean;
  pendingClientCandidates?: ClientContext[];
  needsClientSelection?: boolean;
};

export type WorkspaceAiStreamStatus = {
  status: "context" | "generating";
};

function pendingCandidatesForTransport(
  pending: ClientContext[] | null | undefined,
): ClientContext[] | undefined {
  return sanitizeClientContextsForTransport(pending ?? undefined);
}

function buildSources(
  context: Awaited<ReturnType<typeof buildWorkspaceContext>>,
  intent: ReturnType<typeof detectWorkspaceIntent>,
  locale: AppLocale = "en",
): string[] {
  const sources: string[] = [];
  if (intent.needsKb) sources.push(translateWorkspaceSource(locale, "knowledgeBase"));
  if (intent.needsEmigrantDrive && context.meta.emigrantDriveConfigured) {
    sources.push(translateWorkspaceSource(locale, "emigrantDrive"));
  }
  if (intent.needsClients && context.meta.clientsTotal > 0) {
    sources.push(
      translateWorkspaceSource(locale, "crmCount", context.meta.clientsTotal),
    );
  }
  if (intent.needsEmigrantDesk && context.meta.emigrantDeskTotal > 0) {
    sources.push(
      translateWorkspaceSource(
        locale,
        "emigrantDeskCount",
        context.meta.emigrantDeskTotal,
      ),
    );
  }
  if (intent.needsFormgrid && context.meta.formgridRows > 0) {
    sources.push(
      translateWorkspaceSource(locale, "formgridCount", context.meta.formgridRows),
    );
  }
  return sources.length > 0
    ? sources
    : [translateWorkspaceSource(locale, "crm")];
}

function buildContextBlock(
  context: Awaited<ReturnType<typeof buildWorkspaceContext>>,
  intent: ReturnType<typeof detectWorkspaceIntent>,
  clientContext: ResolvedClientContext | null,
  clientCandidates: ResolvedClientContext[] | null = null,
  candidateScenario: ClientCandidateScenario | null = null,
  clientSearchIntentNote: string | null = null,
  clientCandidatesTotalFound: number | null = null,
  deskSlice: EmigrantDeskContextSlice | null = null,
): string {
  const contextParts: string[] = [];

  if (clientSearchIntentNote) {
    contextParts.push(
      `=== CLIENT SEARCH INTENT ===\n${clientSearchIntentNote}`,
    );
  }

  if (clientContext) {
    const header = isMergedClientContext(clientContext)
      ? "=== CLIENT CONTEXT (MERGED) ==="
      : "=== CLIENT CONTEXT (Google Sheets) ===";
    contextParts.push(
      `${header}\n${formatClientContextBlock(clientContext, { desk: deskSlice })}`,
    );
  }

  if (clientCandidates && clientCandidates.length > 0 && candidateScenario) {
    const header =
      candidateScenario === "not_found"
        ? "=== CLIENT CANDIDATES (fuzzy, точного совпадения нет) ==="
        : candidateScenario === "weak"
          ? "=== CLIENT CANDIDATES (похожие совпадения) ==="
          : candidateScenario === "structured"
            ? "=== CLIENT CANDIDATES (структурированный поиск) ==="
            : "=== CLIENT CANDIDATES (найдено несколько) ===";
    contextParts.push(
      `${header}\n${formatClientCandidatesForAi(
        clientCandidates,
        candidateScenario,
        clientCandidatesTotalFound ?? clientCandidates.length,
      )}`,
    );
  }

  if (intent.needsKb) {
    contextParts.push(`=== KNOWLEDGE BASE ===\n${context.knowledgeBaseText}`);
  }
  if (intent.needsEmigrantDrive) {
    contextParts.push(`=== ЭМИГРАНТ (документы клиентов) ===\n${context.emigrantDriveText}`);
  }
  if (intent.needsClients && !clientContext && !clientCandidates?.length) {
    contextParts.push(`=== КЛИЕНТЫ ===\n${context.clientsText}`);
  }
  if (intent.needsEmigrantDesk && !deskSlice) {
    contextParts.push(`=== EMIGRANT CROATIA DESK ===\n${context.emigrantDeskText}`);
  }
  if (intent.needsFormgrid && !clientContext) {
    contextParts.push(`=== FORMGRID ===\n${context.formgridText}`);
  }
  return contextParts.join("\n\n");
}

function buildChatMessages(
  trimmed: string,
  contextBlock: string,
  history: WorkspaceChatTurn[],
  mode: WorkspaceResponseMode,
): ChatMessage[] {
  const historyMessages: ChatMessage[] = history.slice(-4).map((turn) => ({
    role: turn.role,
    content: turn.content,
  }));

  const clientNote = contextBlock.includes("CLIENT CONTEXT")
    ? "\n\nДля данных о клиенте используй CLIENT CONTEXT. У каждого поля указан источник — в ответе кратко поясни «таблица «Клиенты»», «анкета Formgrid» и т.д., не пиши «CRM» и не выводи сырой блок."
    : "";
  const emigrantNote = contextBlock.includes("ЭМИГРАНТ (документы клиентов)")
    ? "\n\nДля запросов про папку ЭМИГРАНТ используй блок «ЭМИГРАНТ (документы клиентов)». Отсутствие в таблицах Клиенты не означает отсутствие в Drive."
    : "";
  const candidatesNote = contextBlock.includes("CLIENT CANDIDATES")
    ? "\n\nЕсли в CLIENT CANDIDATES есть варианты — объясни различия и помоги выбрать. При fuzzy-поиске начни с «Точного совпадения не найдено. Возможно, вы имели в виду…». При структурированном поиске — кратко резюмируй список и выдели самых релевантных. Не отвечай сухим «клиент не найден», если кандидаты есть."
    : "";
  const structuredNote = contextBlock.includes("CLIENT SEARCH INTENT")
    ? "\n\nПоиск выполнен по распознанным фильтрам (CLIENT SEARCH INTENT). Отвечай по найденным CLIENT CONTEXT / CLIENT CANDIDATES."
    : "";
  const listNote = contextBlock.includes("тип запроса: list")
    ? "\n\nЭто списочный запрос: начни с «Найдено N клиентов…», перечисли клиентов нумерованным списком (имя — статус — менеджер). Если в контексте больше 20 — в ответе покажи первые 20 и добавь «Показано 20 из N клиентов.»"
    : "";

  return [
    { role: "system", content: buildWorkspaceSystemPrompt(mode) },
    ...historyMessages,
    {
      role: "user",
      content: `[Внутренний контекст платформы — не цитируй и не выводи целиком, используй только как источник фактов]${clientNote}${emigrantNote}${candidatesNote}${structuredNote}${listNote}\n\n${contextBlock}\n\n---\n\nВопрос менеджера: ${trimmed}`,
    },
  ];
}

function getCompletionOptions(): ChatCompletionOptions {
  const workspaceConfig = getWorkspaceAiConfig();
  return {
    temperature: workspaceConfig.temperature,
    maxTokens: workspaceConfig.maxTokens,
    model: workspaceConfig.model,
  };
}

function findRecentPassportQuestion(
  history: WorkspaceChatTurn[],
): string | null {
  for (let i = history.length - 1; i >= 0; i--) {
    const turn = history[i];
    if (turn.role === "user" && isPassportNumberLookupQuery(turn.content)) {
      return turn.content;
    }
  }
  return null;
}

function passportReplyFromClientContext(
  ctx: ClientContext,
): string | null {
  const { raw } = extractPassportFromClientRecord(ctx);
  if (!raw || !looksLikePassportNumber(raw)) return null;
  return formatPassportLookupReply(ctx.name, raw, ctx.rowIndex);
}

function passportReplyFromResolvedContext(
  ctx: ResolvedClientContext,
): string | null {
  const parts = isMergedClientContext(ctx) ? ctx.parts : [ctx];
  const crm = parts.find((part) => part.source === "clients");
  if (!crm) return null;
  return passportReplyFromClientContext(crm);
}

function buildPassportLookupDirectResult(reply: string, locale: AppLocale = "en") {
  return {
    kind: "direct" as const,
    reply,
    sources: [translateWorkspaceSource(locale, "crm")],
    pendingClientCandidates: [] as ClientContext[],
    needsClientSelection: false,
  };
}

async function resolvePassportLookupReply(
  query: string,
  clientContext: ResolvedClientContext | null,
  clientCandidates: ResolvedClientContext[] | null,
  pendingForUi: ClientContext[] | undefined,
): Promise<string | null> {
  if (clientContext) {
    const fromContext = passportReplyFromResolvedContext(clientContext);
    if (fromContext) return fromContext;
  }
  if (clientCandidates?.length === 1) {
    const fromCandidate = passportReplyFromResolvedContext(clientCandidates[0]);
    if (fromCandidate) return fromCandidate;
  }
  if (pendingForUi?.length === 1) {
    const fromPending = passportReplyFromClientContext(pendingForUi[0]);
    if (fromPending) return fromPending;
  }
  return tryDirectPassportAnswer(query);
}

async function prepareWorkspaceRequest(
  userMessage: string,
  history: WorkspaceChatTurn[],
  mode: WorkspaceResponseMode,
  pendingClientCandidates: ClientContext[] | null = null,
  locale: AppLocale = "en",
): Promise<
  | { kind: "empty" }
  | {
      kind: "direct";
      reply: string;
      sources: string[];
      demo?: boolean;
      pendingClientCandidates?: ClientContext[];
      needsClientSelection?: boolean;
    }
  | {
      kind: "ai";
      messages: ChatMessage[];
      sources: string[];
      context: Awaited<ReturnType<typeof buildWorkspaceContext>>;
      trimmed: string;
      clientContext: ResolvedClientContext | null;
      pendingClientCandidates?: ClientContext[];
      needsClientSelection?: boolean;
    }
> {
  const trimmed = userMessage.trim();
  if (!trimmed) {
    return { kind: "empty" };
  }

  const offTopicCategory = detectOffTopicCategory(trimmed);
  if (offTopicCategory) {
    return {
      kind: "direct",
      reply: buildOffTopicReply(locale, offTopicCategory),
      sources: [],
      demo: true,
    };
  }

  const safePendingCandidates =
    sanitizeClientContextsForTransport(pendingClientCandidates ?? undefined) ??
    null;

  if (isDebugClientCommand(trimmed)) {
    const debugQuery = parseDebugClientQuery(trimmed) || trimmed;

    if (!isWorkspaceDiagnosticsEnabled()) {
      const matches = await lookupAllClientMatches(debugQuery);
      return {
        kind: "direct",
        reply: formatDemoClientLookupMessage(locale, matches.length > 0),
        sources: [translateWorkspaceSource(locale, "crm")],
        demo: true,
      };
    }

    const searchQuery = buildClientSearchQuery(debugQuery);
    const [matches, rawHits] = await Promise.all([
      lookupAllClientMatches(debugQuery),
      scanRawRowsForTokens(debugQuery),
    ]);
    const dedupGroups = groupDuplicateClients(matches);
    const dedupInfo = dedupGroups.map((group) => ({
      parts: group.parts,
      mergeReasons: group.mergeReasons,
      mergedName: group.merged.name,
    }));
    let debugReply = formatDebugClientReply(
      debugQuery,
      matches,
      searchQuery.morphology,
      rawHits,
      dedupInfo,
    );
    const mergedGroups = dedupGroups.filter((group) => group.parts.length > 1);
    if (mergedGroups.length > 0) {
      debugReply += `\n\n**Merged context preview:**\n\n${mergedGroups
        .map((group) => formatMergedClientContextBlock(group.merged))
        .join("\n\n---\n\n")}`;
    }
    return {
      kind: "direct",
      reply: redactSensitiveText(debugReply),
      sources: [
        translateWorkspaceSource(locale, "crm"),
        translateWorkspaceSource(locale, "newClients"),
      ],
    };
  }

  const followUp = resolveClientSelectionFollowUp(
    trimmed,
    safePendingCandidates,
    history,
  );

  if (followUp?.kind === "select" && findRecentPassportQuestion(history)) {
    const fromSelected = passportReplyFromClientContext(followUp.client);
    if (fromSelected) {
      return buildPassportLookupDirectResult(fromSelected, locale);
    }
    const passportQuery = findRecentPassportQuestion(history);
    if (passportQuery) {
      const retry = await tryDirectPassportAnswer(passportQuery);
      if (retry) {
        return buildPassportLookupDirectResult(retry, locale);
      }
    }
  }

  const intent = detectWorkspaceIntent(trimmed);

  if (isPassportNumberLookupQuery(trimmed)) {
    const early = await tryDirectPassportAnswer(trimmed);
    if (early) {
      return buildPassportLookupDirectResult(early, locale);
    }
  }

  let clientContext: ResolvedClientContext | null = null;
  let clientCandidates: ResolvedClientContext[] | null = null;
  let candidateScenario: ClientCandidateScenario | null = null;
  let pendingForUi: ClientContext[] | undefined;
  let needsClientSelection = false;
  let clientSearchIntentNote: string | null = null;
  let clientCandidatesTotalFound: number | null = null;

  if (followUp) {
    clientContext = followUpToClientContext(followUp);
  } else {
    const aiSearch = await lookupClientsWithAiSearch(trimmed);
    const clientLookup = aiSearch.lookup;
    clientSearchIntentNote = formatClientSearchIntentForAi(aiSearch.intent);
    clientCandidatesTotalFound = aiSearch.foundClients;

    console.log(
      `[workspace-ai] Found clients: ${aiSearch.foundClients}, Sent to Claude: ${aiSearch.sentToClaude}, Intent type: ${aiSearch.intentType}`,
    );

    if (
      aiSearch.intentType === "list" &&
      clientLookup.kind === "single"
    ) {
      clientCandidates = [clientLookup.client];
      candidateScenario = "structured";
    } else if (clientLookup.kind === "single") {
      clientContext = clientLookup.client;
    } else if (clientLookup.kind === "multiple") {
      clientCandidates = clientLookup.clients;
      candidateScenario = aiSearch.usedStructuredSearch ? "structured" : "multiple";
      if (
        shouldOfferClientSelection(
          aiSearch.intentType,
          clientLookup.kind,
          clientLookup.clients.length,
        )
      ) {
        pendingForUi = clientLookup.pendingParts;
        needsClientSelection = true;
      }
    } else if (clientLookup.kind === "weak") {
      clientCandidates = clientLookup.clients;
      candidateScenario = "weak";
      if (aiSearch.intentType !== "list") {
        pendingForUi = clientLookup.clients.flatMap((client) =>
          isMergedClientContext(client) ? client.parts : [client],
        );
      }
    } else if (clientLookup.kind === "not_found") {
      const fuzzy = await lookupFuzzyClientCandidates(trimmed, 10);
      if (fuzzy.length > 0 && aiSearch.intentType !== "list") {
        clientCandidates = fuzzy;
        candidateScenario = "not_found";
        pendingForUi = fuzzy.flatMap((client) =>
          isMergedClientContext(client) ? client.parts : [client],
        );
      }
    }
  }

  if (isPassportNumberLookupQuery(trimmed)) {
    const passportReply = await resolvePassportLookupReply(
      trimmed,
      clientContext,
      clientCandidates,
      pendingForUi,
    );
    if (passportReply) {
      return buildPassportLookupDirectResult(passportReply, locale);
    }
    needsClientSelection = false;
    pendingForUi = undefined;
  }

  if (intent.fastClientLookup && !clientContext) {
    const direct = await tryDirectBookingAnswer(trimmed);
    if (direct) {
      return {
        kind: "direct",
        reply: direct,
        sources: [translateWorkspaceSource(locale, "crm")],
      };
    }
  }

  if (intent.needsEmigrantDesk && /статус/iu.test(trimmed)) {
    const direct = await tryDirectEmigrantStatusAnswer(trimmed);
    if (direct) {
      return {
        kind: "direct",
        reply: direct,
        sources: [translateWorkspaceSource(locale, "emigrantDesk")],
      };
    }
  }

  if (intent.needsFormgrid) {
    const direct = await tryDirectFormgridRecentAnswer(trimmed);
    if (direct) {
      return {
        kind: "direct",
        reply: direct,
        sources: [translateWorkspaceSource(locale, "formgrid")],
      };
    }
  }

  let context: Awaited<ReturnType<typeof buildWorkspaceContext>>;
  try {
    context = await buildWorkspaceContext(trimmed, intent, locale);
  } catch (error) {
    console.error("[workspace-ai] context build failed", error);
    context = {
      clientsText: "Клиенты: не удалось загрузить таблицу.",
      emigrantDeskText: "Emigrant Croatia Desk: не удалось загрузить статусы дел.",
      emigrantDriveText: "Папка ЭМИГРАНТ: не удалось загрузить Google Drive.",
      formgridText: "Formgrid: не удалось загрузить анкеты.",
      knowledgeBaseText: "Knowledge Base: не удалось загрузить Drive.",
      meta: {
        clientsTotal: 0,
        emigrantDeskTotal: 0,
        emigrantDriveConfigured: false,
        formgridRows: 0,
      },
    };
  }

  let deskSlice: EmigrantDeskContextSlice | null = null;
  if (clientContext && intent.needsEmigrantDesk) {
    try {
      const deskClient = await findEmigrantDeskClientByQuery(clientContext.name);
      if (deskClient) {
        deskSlice = emigrantDeskClientToContextSlice(deskClient);
      }
    } catch (error) {
      console.error("[workspace-ai] desk lookup for client context failed", error);
    }
  }

  const sources = clientContext
    ? [
        isMergedClientContext(clientContext)
          ? deskSlice
            ? `${translateWorkspaceSource(locale, "crm")} + ${translateWorkspaceSource(locale, "newClients")} + ${translateWorkspaceSource(locale, "emigrantDesk")}`
            : `${translateWorkspaceSource(locale, "crm")} + ${translateWorkspaceSource(locale, "newClients")}`
          : deskSlice
            ? `${translateWorkspaceSource(locale, "clientContext")} + ${translateWorkspaceSource(locale, "emigrantDesk")}`
            : translateWorkspaceSource(locale, "clientContext"),
        ...buildSources(context, intent, locale).filter(
          (source) =>
            !new RegExp(
              `^${translateWorkspaceSource(locale, "crm")}|^${translateWorkspaceSource(locale, "formgrid")}|^${translateWorkspaceSource(locale, "emigrantDesk")}`,
            ).test(source),
        ),
      ]
    : clientCandidates?.length
      ? [
          `${translateWorkspaceSource(locale, "crm")} (${clientCandidates.length})`,
          ...buildSources(context, intent, locale),
        ]
      : buildSources(context, intent, locale);
  const contextBlock = buildContextBlock(
    context,
    intent,
    clientContext,
    clientCandidates,
    candidateScenario,
    clientSearchIntentNote,
    clientCandidatesTotalFound,
    deskSlice,
  );
  const messages = buildChatMessages(trimmed, contextBlock, history, mode);

  return {
    kind: "ai",
    messages,
    sources,
    context,
    trimmed,
    clientContext,
    pendingClientCandidates: pendingCandidatesForTransport(pendingForUi),
    needsClientSelection,
  };
}

export async function runWorkspaceAi(
  userMessage: string,
  history: WorkspaceChatTurn[] = [],
  mode: WorkspaceResponseMode = "brief",
  pendingClientCandidates: ClientContext[] | null = null,
  locale: AppLocale = "en",
): Promise<WorkspaceAiResult> {
  const prepared = await prepareWorkspaceRequest(
    userMessage,
    history,
    mode,
    pendingClientCandidates,
    locale,
  );

  if (prepared.kind === "empty") {
    return {
      reply: translateWorkspaceMessage(locale, "errors.emptyMessage"),
      sources: [],
      demo: true,
    };
  }

  if (prepared.kind === "direct") {
    return {
      reply: prepared.reply,
      sources: prepared.sources,
      demo: prepared.demo ?? false,
      pendingClientCandidates: prepared.pendingClientCandidates,
      needsClientSelection: prepared.needsClientSelection,
    };
  }

  if (shouldUseDemoResponsesOnly()) {
    return {
      reply: buildDemoFallbackReply(prepared.trimmed, locale),
      sources: prepared.sources,
      demo: true,
      pendingClientCandidates: prepared.pendingClientCandidates,
      needsClientSelection: prepared.needsClientSelection,
    };
  }

  const aiReply = await createChatCompletion(
    prepared.messages,
    getCompletionOptions(),
  );

  if (aiReply) {
    return {
      reply: aiReply,
      sources: prepared.sources,
      demo: false,
      pendingClientCandidates: prepared.pendingClientCandidates,
      needsClientSelection: prepared.needsClientSelection,
    };
  }

  return {
    reply: buildDemoFallbackReply(prepared.trimmed, locale),
    sources: prepared.sources,
    demo: true,
    pendingClientCandidates: prepared.pendingClientCandidates,
    needsClientSelection: prepared.needsClientSelection,
  };
}

export async function* runWorkspaceAiStream(
  userMessage: string,
  history: WorkspaceChatTurn[] = [],
  mode: WorkspaceResponseMode = "brief",
  pendingClientCandidates: ClientContext[] | null = null,
  locale: AppLocale = "en",
): AsyncGenerator<string | WorkspaceAiStreamMeta | WorkspaceAiStreamStatus> {
  yield { status: "context" };

  const prepared = await prepareWorkspaceRequest(
    userMessage,
    history,
    mode,
    pendingClientCandidates,
    locale,
  );

  if (prepared.kind === "empty") {
    yield {
      sources: [],
      demo: true,
    };
    yield translateWorkspaceMessage(locale, "errors.emptyMessage");
    return;
  }

  if (prepared.kind === "direct") {
    yield {
      sources: prepared.sources,
      demo: prepared.demo ?? false,
      pendingClientCandidates: prepared.pendingClientCandidates,
      needsClientSelection: prepared.needsClientSelection,
    };
    yield prepared.reply;
    return;
  }

  if (shouldUseDemoResponsesOnly()) {
    yield {
      sources: prepared.sources,
      demo: true,
      pendingClientCandidates: prepared.pendingClientCandidates,
      needsClientSelection: prepared.needsClientSelection,
    };
    yield buildDemoFallbackReply(prepared.trimmed, locale);
    return;
  }

  yield {
    sources: prepared.sources,
    demo: false,
    pendingClientCandidates: prepared.pendingClientCandidates,
    needsClientSelection: prepared.needsClientSelection,
  };

  yield { status: "generating" };

  let hasContent = false;
  for await (const chunk of streamChatCompletion(
    prepared.messages,
    getCompletionOptions(),
  )) {
    hasContent = true;
    yield chunk;
  }

  if (!hasContent) {
    yield {
      sources: prepared.sources,
      demo: true,
    };
    yield buildDemoFallbackReply(prepared.trimmed, locale);
  }
}

async function tryDirectFormgridRecentAnswer(
  message: string,
): Promise<string | null> {
  const days = parseRecentDaysFromQuery(message);
  if (days === null) return null;
  if (!/анкет|formgrid|заявк|новые\s+клиент/i.test(message)) return null;

  const table = await getFormgridLeadsTable();
  if (table.rows.length === 0) return null;

  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - days);

  const recent = listFormgridRowsSince(table.headers, table.rows, since);
  if (recent.length === 0) {
    return `За последние **${days}** дн. в анкете Formgrid новых заявок нет.`;
  }

  const lines = recent.map((row) =>
    `- ${formatFormgridRowSummary(table.headers, row)}`,
  );

  return [
    `За последние **${days}** дн. в анкете Formgrid — **${recent.length}** заявок:`,
    ...lines,
  ].join("\n");
}

async function tryDirectEmigrantStatusAnswer(
  message: string,
): Promise<string | null> {
  const client = await findEmigrantDeskClientByQuery(message);
  if (!client) return null;

  const name = [client.firstName, client.lastName].filter(Boolean).join(" ");
  const status = client.currentStatus?.trim() || "не указан";
  const parts = [
    `**${name || client.email}** в Emigrant Croatia Desk: статус дела — **${status}**.`,
  ];

  if (client.caseNumber) {
    parts.push(`№ дела / паспорт в кабинете: ${client.caseNumber}.`);
  }
  if (client.statusUpdatedAt) {
    parts.push(`Статус обновлён: ${client.statusUpdatedAt.slice(0, 10)}.`);
  }
  if (client.consulate) {
    parts.push(`Консульство: ${client.consulate}.`);
  }

  return parts.join(" ");
}

async function tryDirectPassportAnswer(message: string): Promise<string | null> {
  const tokens = extractPersonNameTokens(message);
  if (tokens.length === 0) return null;

  const { items } = await listClients(1, 500);
  const client = items.find((entry) => {
    const nameLower = entry.name.toLowerCase();
    return tokens.every((token) => nameLower.includes(token.toLowerCase()));
  });
  if (!client) return null;

  const passport = client.passportNumber?.trim();
  if (passport && passport !== "—" && looksLikePassportNumber(passport)) {
    return formatPassportLookupReply(
      client.name,
      passport,
      client.rowIndex,
    );
  }

  return formatPassportMissingReply(client.name, client.rowIndex);
}

async function tryDirectBookingAnswer(message: string): Promise<string | null> {
  const lower = message.toLowerCase();
  if (!lower.includes("букинг") && !lower.includes("адрес")) {
    return null;
  }

  const { items } = await listClients(1, 300);
  const nameMatch = lower.match(/(?:клиент[а-я]*|у)\s+([а-яё\-]+)/iu);
  const needle = nameMatch?.[1]?.toLowerCase();
  if (!needle) return null;

  const client = items.find((c) => c.name.toLowerCase().includes(needle));
  if (!client) return null;

  const hasAddress =
    client.bookingAddress && client.bookingAddress !== "—";
  const hasDates = client.bookingRange && client.bookingRange !== "—";

  if (!hasAddress && !hasDates) return null;

  const parts = [
    `По **${client.name}** в таблице есть букинг.`,
  ];
  if (hasAddress) parts.push(`Адрес: **${client.bookingAddress}**.`);
  if (hasDates) parts.push(`Даты: ${client.bookingRange}.`);
  if (client.passportNumber && client.passportNumber !== "—") {
    parts.push(`Паспорт в базе: ${client.passportNumber}.`);
  }
  parts.push(
    "\n**Что дальше:** сверьте даты с клиентом и проверьте, всё ли готово к заезду.",
  );
  return parts.join(" ");
}

const STOP_WORDS = new Set([
  "найди",
  "найти",
  "покажи",
  "клиент",
  "клиента",
  "адрес",
  "букинг",
  "букинга",
  "у",
  "мне",
  "для",
  "что",
  "где",
]);

function extractNameTokens(query: string): string[] {
  const lower = query.toLowerCase();
  const afterClient = lower.match(
    /(?:клиент[а-я]*|у)\s+([а-яё\-]+(?:\s+[а-яё\-]+)?)/iu,
  );
  const focus = afterClient?.[1] ?? lower;

  return focus
    .split(/[^\p{L}\p{N}]+/u)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !STOP_WORDS.has(t));
}
