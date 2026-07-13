export type PriorityTone = "good" | "attention" | "critical";

export type PriorityCard = {
  id: string;
  tone: PriorityTone;
  textKey: string;
};

export type AiInsight = {
  id: string;
  textKey: string;
  href?: string;
};

export type AskSpioraChip = {
  id: string;
  labelKey: string;
  href: string;
};

export type TeamActivityItem = {
  id: string;
  textKey: string;
};

export const COMPANY_HEALTH = {
  statusKey: "excellent",
  clients: 126,
  documents: 3482,
  meetings: 84,
  tasksCompletedPercent: 98,
  aiConversations: 421,
} as const;

export const PRIORITY_CARDS: PriorityCard[] = [
  { id: "meetings", tone: "good", textKey: "priorities.meetings" },
  { id: "documents", tone: "attention", textKey: "priorities.documents" },
  { id: "overdue", tone: "critical", textKey: "priorities.overdue" },
  { id: "permit", tone: "good", textKey: "priorities.permit" },
];

export const AI_INSIGHTS: AiInsight[] = [
  {
    id: "sofia",
    textKey: "insights.sofiaDocument",
    href: "/clients/DEMO-1002",
  },
  {
    id: "daniel",
    textKey: "insights.danielOverdue",
    href: "/tasks?status=in_progress",
  },
  {
    id: "consultations",
    textKey: "insights.mergeConsultations",
    href: "/calendar",
  },
];

export const ASK_SPIORA_CHIPS: AskSpioraChip[] = [
  {
    id: "priorities",
    labelKey: "askSpiora.priorities",
    href: "/ai-workspace",
  },
  {
    id: "atRisk",
    labelKey: "askSpiora.atRisk",
    href: "/ai-workspace",
  },
  {
    id: "draftEmail",
    labelKey: "askSpiora.draftEmail",
    href: "/ai-workspace",
  },
  {
    id: "deadlines",
    labelKey: "askSpiora.deadlines",
    href: "/calendar",
  },
  {
    id: "schedule",
    labelKey: "askSpiora.schedule",
    href: "/calendar",
  },
];

export const TEAM_ACTIVITY: TeamActivityItem[] = [
  { id: "emma", textKey: "activity.emmaPassport" },
  { id: "daniel", textKey: "activity.danielConsultation" },
  { id: "lucas", textKey: "activity.lucasChecklist" },
  { id: "ai", textKey: "activity.aiSummarized" },
  { id: "olivia", textKey: "activity.oliviaAssigned" },
];
