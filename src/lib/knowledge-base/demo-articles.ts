import type { KbArticleSeed } from "./types";

/** Static demo article seeds — content resolved via i18n at runtime. */
export const DEMO_KB_ARTICLE_SEEDS: KbArticleSeed[] = [
  {
    slug: "client-onboarding-checklist",
    categoryId: "client-workflow",
    tagKeys: ["onboarding", "clients", "workflow"],
    authorId: "daniel-cooper",
    updatedAt: "2026-06-15T10:00:00.000Z",
  },
  {
    slug: "document-naming-rules",
    categoryId: "document-management",
    tagKeys: ["documents", "templates"],
    authorId: "emma-wilson",
    updatedAt: "2026-05-20T14:30:00.000Z",
  },
  {
    slug: "internal-communication-guidelines",
    categoryId: "company-policies",
    tagKeys: ["communication", "compliance"],
    authorId: "olivia-bennett",
    updatedAt: "2026-04-10T09:00:00.000Z",
  },
  {
    slug: "consultation-prep",
    categoryId: "client-workflow",
    tagKeys: ["clients", "workflow"],
    authorId: "lucas-martin",
    updatedAt: "2026-06-01T11:15:00.000Z",
  },
  {
    slug: "task-management-standards",
    categoryId: "team-onboarding",
    tagKeys: ["tasks", "workflow"],
    authorId: "emma-wilson",
    updatedAt: "2026-03-25T16:00:00.000Z",
  },
  {
    slug: "calendar-meeting-policy",
    categoryId: "company-policies",
    tagKeys: ["calendar", "communication"],
    authorId: "olivia-bennett",
    updatedAt: "2026-02-14T08:45:00.000Z",
  },
  {
    slug: "data-security-basics",
    categoryId: "company-policies",
    tagKeys: ["security", "compliance"],
    authorId: "daniel-cooper",
    updatedAt: "2026-01-30T13:20:00.000Z",
  },
  {
    slug: "working-with-ai-workspace",
    categoryId: "ai-automation",
    tagKeys: ["ai", "workflow"],
    authorId: "daniel-cooper",
    updatedAt: "2026-06-20T15:00:00.000Z",
  },
  {
    slug: "handling-uploaded-documents",
    categoryId: "document-management",
    tagKeys: ["documents", "clients"],
    authorId: "lucas-martin",
    updatedAt: "2026-05-08T10:30:00.000Z",
  },
  {
    slug: "escalation-procedure",
    categoryId: "company-policies",
    tagKeys: ["workflow", "compliance"],
    authorId: "olivia-bennett",
    updatedAt: "2026-03-12T12:00:00.000Z",
  },
  {
    slug: "team-member-onboarding",
    categoryId: "team-onboarding",
    tagKeys: ["onboarding", "workflow"],
    authorId: "emma-wilson",
    updatedAt: "2026-02-28T09:30:00.000Z",
  },
  {
    slug: "monthly-reporting-guide",
    categoryId: "document-management",
    tagKeys: ["reporting", "templates"],
    authorId: "daniel-cooper",
    updatedAt: "2026-04-22T17:45:00.000Z",
  },
  {
    slug: "client-intake-workflow",
    categoryId: "client-workflow",
    tagKeys: ["clients", "workflow"],
    authorId: "lucas-martin",
    updatedAt: "2026-05-15T14:00:00.000Z",
  },
  {
    slug: "standard-document-checklist",
    categoryId: "document-management",
    tagKeys: ["documents", "clients", "templates"],
    authorId: "emma-wilson",
    updatedAt: "2026-06-10T11:00:00.000Z",
  },
  {
    slug: "quality-review-process",
    categoryId: "ai-automation",
    tagKeys: ["ai", "compliance", "workflow"],
    authorId: "olivia-bennett",
    updatedAt: "2026-06-05T10:15:00.000Z",
  },
];

export const DEMO_KB_CATEGORY_IDS = [
  "company-policies",
  "client-workflow",
  "document-management",
  "team-onboarding",
  "ai-automation",
] as const;
