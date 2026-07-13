import type { TaskPriority, TaskStatus } from "./types";

export type DemoTaskSeed = {
  slug: string;
  status: TaskStatus;
  priority: TaskPriority;
  createdById: string;
  assigneeIds: string[];
  dueOffsetDays: number;
  completedOffsetDays?: number;
};

export const DEMO_TASK_SEEDS: DemoTaskSeed[] = [
  {
    slug: "review-sofia-documents",
    status: "in_progress",
    priority: "high",
    createdById: "emma-wilson",
    assigneeIds: ["daniel-cooper"],
    dueOffsetDays: 2,
  },
  {
    slug: "schedule-immigration-consultation",
    status: "new",
    priority: "medium",
    createdById: "olivia-bennett",
    assigneeIds: ["lucas-martin"],
    dueOffsetDays: 4,
  },
  {
    slug: "verify-passport-copy",
    status: "pending_approval",
    priority: "high",
    createdById: "daniel-cooper",
    assigneeIds: ["emma-wilson"],
    dueOffsetDays: -1,
  },
  {
    slug: "ai-review-application",
    status: "in_progress",
    priority: "medium",
    createdById: "olivia-bennett",
    assigneeIds: ["daniel-cooper"],
    dueOffsetDays: 3,
  },
  {
    slug: "prepare-residence-permit-package",
    status: "new",
    priority: "urgent",
    createdById: "emma-wilson",
    assigneeIds: ["lucas-martin", "daniel-cooper"],
    dueOffsetDays: 5,
  },
  {
    slug: "client-follow-up-carter",
    status: "completed",
    priority: "low",
    createdById: "daniel-cooper",
    assigneeIds: ["daniel-cooper"],
    dueOffsetDays: -5,
    completedOffsetDays: -2,
  },
  {
    slug: "proof-of-address-review",
    status: "needs_revision",
    priority: "high",
    createdById: "lucas-martin",
    assigneeIds: ["emma-wilson"],
    dueOffsetDays: 1,
  },
  {
    slug: "monthly-pipeline-summary",
    status: "in_progress",
    priority: "medium",
    createdById: "olivia-bennett",
    assigneeIds: ["olivia-bennett"],
    dueOffsetDays: 7,
  },
  {
    slug: "update-croatia-checklist",
    status: "new",
    priority: "low",
    createdById: "emma-wilson",
    assigneeIds: ["lucas-martin"],
    dueOffsetDays: 10,
  },
  {
    slug: "team-chat-kb-announcement",
    status: "completed",
    priority: "low",
    createdById: "olivia-bennett",
    assigneeIds: ["daniel-cooper"],
    dueOffsetDays: -3,
    completedOffsetDays: -1,
  },
  {
    slug: "marco-rossi-intake-review",
    status: "in_progress",
    priority: "medium",
    createdById: "daniel-cooper",
    assigneeIds: ["daniel-cooper", "lucas-martin"],
    dueOffsetDays: 2,
  },
  {
    slug: "anna-kowalska-document-check",
    status: "pending_approval",
    priority: "high",
    createdById: "lucas-martin",
    assigneeIds: ["emma-wilson"],
    dueOffsetDays: 0,
  },
  {
    slug: "calendar-prep-client-call",
    status: "new",
    priority: "medium",
    createdById: "emma-wilson",
    assigneeIds: ["emma-wilson"],
    dueOffsetDays: 1,
  },
  {
    slug: "escalation-policy-review",
    status: "completed",
    priority: "low",
    createdById: "olivia-bennett",
    assigneeIds: ["daniel-cooper"],
    dueOffsetDays: -7,
    completedOffsetDays: -4,
  },
  {
    slug: "demo-data-security-quiz",
    status: "in_progress",
    priority: "low",
    createdById: "olivia-bennett",
    assigneeIds: ["lucas-martin"],
    dueOffsetDays: 14,
  },
  {
    slug: "portugal-d7-questionnaire",
    status: "new",
    priority: "medium",
    createdById: "daniel-cooper",
    assigneeIds: ["emma-wilson"],
    dueOffsetDays: 6,
  },
  {
    slug: "overdue-visa-extension",
    status: "needs_revision",
    priority: "urgent",
    createdById: "emma-wilson",
    assigneeIds: ["daniel-cooper"],
    dueOffsetDays: -2,
  },
  {
    slug: "ai-workspace-prompt-audit",
    status: "in_progress",
    priority: "medium",
    createdById: "olivia-bennett",
    assigneeIds: ["daniel-cooper", "emma-wilson"],
    dueOffsetDays: 8,
  },
  {
    slug: "client-welcome-email-template",
    status: "completed",
    priority: "low",
    createdById: "emma-wilson",
    assigneeIds: ["lucas-martin"],
    dueOffsetDays: -4,
    completedOffsetDays: -3,
  },
  {
    slug: "spain-remote-work-file",
    status: "new",
    priority: "high",
    createdById: "lucas-martin",
    assigneeIds: ["lucas-martin", "daniel-cooper"],
    dueOffsetDays: 3,
  },
];

export const DEMO_TASK_COUNT = DEMO_TASK_SEEDS.length;
