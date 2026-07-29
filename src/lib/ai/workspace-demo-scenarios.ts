import type { AppLocale } from "@/i18n/config";
import { translateWorkspaceMessage } from "@/i18n/ai-workspace-messages";
import { isDemoMode } from "@/lib/demo/demo-mode";
import { isExternalAiIntegrationEnabled } from "@/lib/demo/integration-policy";
import { isAiConfigured } from "@/lib/ai/config";

export type DemoScenarioId =
  | "prioritiesToday"
  | "overdueTasks"
  | "findClientSofia"
  | "documentChecklist"
  | "upcomingMeetings"
  | "clientFollowUpEmail"
  | "summarizeClientCase"
  | "teamFocusToday"
  | "activeClients"
  | "knowledgeBase"
  | "generic";

type ScenarioMatcher = {
  id: DemoScenarioId;
  patterns: RegExp[];
};

const SCENARIO_MATCHERS: ScenarioMatcher[] = [
  {
    id: "prioritiesToday",
    patterns: [
      /priorit(?:y|ies)\s+(?:for\s+)?today/i,
      /summarize\s+today/i,
      /today(?:'s)?\s+priorit/i,
      /приоритет(?:ы|а)?\s+на\s+сегодня/iu,
      /что\s+важно\s+сегодня/iu,
    ],
  },
  {
    id: "overdueTasks",
    patterns: [
      /overdue\s+task/i,
      /show\s+overdue/i,
      /просроченн(?:ые|ая)\s+задач/iu,
      /просрочк/iu,
    ],
  },
  {
    id: "findClientSofia",
    patterns: [
      /sofia\s+martins/i,
      /find\s+client\s+sofia/i,
      /найди\s+клиент(?:а)?\s+sofia/iu,
      /клиент(?:а)?\s+sofia\s+martins/iu,
    ],
  },
  {
    id: "documentChecklist",
    patterns: [
      /document\s+checklist/i,
      /prepare\s+(?:a\s+)?document/i,
      /список\s+документ/iu,
      /подготов(?:ь|ить)\s+(?:список\s+)?документ/iu,
      /чек[\s-]?лист/iu,
    ],
  },
  {
    id: "upcomingMeetings",
    patterns: [
      /upcoming\s+meetings?/i,
      /next\s+meetings?/i,
      /ближайш(?:ие|ая)\s+встреч/iu,
      /покажи\s+встреч/iu,
    ],
  },
  {
    id: "clientFollowUpEmail",
    patterns: [
      /follow[\s-]?up\s+email/i,
      /draft\s+(?:a\s+)?client\s+email/i,
      /письмо\s+клиент/iu,
      /подготов(?:ь|ить)\s+письмо/iu,
    ],
  },
  {
    id: "summarizeClientCase",
    patterns: [
      /summarize\s+(?:this\s+)?client\s+case/i,
      /client\s+case\s+summary/i,
      /суммируй\s+дело\s+клиент/iu,
      /кратко\s+по\s+клиент/iu,
    ],
  },
  {
    id: "teamFocusToday",
    patterns: [
      /team\s+focus/i,
      /what\s+should\s+(?:the\s+)?team\s+focus/i,
      /команд(?:е|а)\s+сосредоточ/i,
      /на\s+ч[её]м\s+команд/iu,
    ],
  },
  {
    id: "activeClients",
    patterns: [
      /clients?\s+in\s+(?:progress|work)/i,
      /how\s+many\s+clients/i,
      /сколько\s+клиент/iu,
      /клиент(?:ы|ов)\s+в\s+работе/iu,
    ],
  },
  {
    id: "knowledgeBase",
    patterns: [
      /knowledge\s+base/i,
      /compare\s+programs/i,
      /база\s+знаний/iu,
      /требовани(?:я|й)\s+по\s+программ/iu,
    ],
  },
];

export function matchDemoScenario(message: string): DemoScenarioId | null {
  const trimmed = message.trim();
  if (!trimmed) return null;

  for (const matcher of SCENARIO_MATCHERS) {
    if (matcher.patterns.some((pattern) => pattern.test(trimmed))) {
      return matcher.id;
    }
  }

  return null;
}

export function resolveDemoScenarioReply(
  message: string,
  locale: AppLocale,
): { scenarioId: DemoScenarioId; reply: string } {
  const scenarioId = matchDemoScenario(message) ?? "generic";
  const reply = translateWorkspaceMessage(locale, `demoResponses.${scenarioId}`);
  return { scenarioId, reply };
}

export function shouldUseDemoResponsesOnly(): boolean {
  if (!isDemoMode()) {
    return !isAiConfigured();
  }
  return !isExternalAiIntegrationEnabled() || !isAiConfigured();
}

export function buildDemoFallbackReply(
  message: string,
  locale: AppLocale,
): string {
  if (shouldUseDemoResponsesOnly()) {
    return resolveDemoScenarioReply(message, locale).reply;
  }

  const { reply } = resolveDemoScenarioReply(message, locale);
  const modelHint = translateWorkspaceMessage(locale, "demo.modelUnavailable");
  return `${reply}\n\n${modelHint}`;
}
