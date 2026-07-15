import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import {
  translateMessage,
  getMessagesForLocale,
} from "@/i18n/messages.ts";
import { translateTeamMemberName } from "@/i18n/team-members.ts";
import {
  countTasksLeafKeys,
  translateTasksMessage,
  translateTasksPriority,
  translateTasksStatus,
} from "@/i18n/tasks-messages.ts";
import { DEMO_TASK_SEEDS } from "@/lib/tasks/demo-tasks.ts";
import { buildDemoTasks } from "@/lib/tasks/demo-tasks-builder.ts";
import { resolveDemoTaskText } from "@/lib/tasks/demo-task-text.ts";
import { localizeTask } from "@/lib/tasks/resolve-task-text.ts";
import {
  advanceLoginRateLimitForTests,
  checkLoginRateLimit,
  LOGIN_MAX_ATTEMPTS_PER_MINUTE,
  resetLoginRateLimitForTests,
} from "@/lib/auth/login-rate-limit.ts";
import {
  areDebugFeaturesEnabled,
  isDebugApiAllowed,
  isDebugClientCommandAllowed,
} from "@/lib/demo/debug-guard.ts";
import { isWorkspaceDiagnosticsEnabled } from "@/lib/ai/workspace-demo-safe.ts";
import { getNavItemsForRole } from "@/lib/auth/permissions.ts";
import type { TaskStatus, TaskPriority } from "@/lib/tasks/types.ts";

const TASK_STATUSES: TaskStatus[] = [
  "new",
  "in_progress",
  "pending_approval",
  "needs_revision",
  "completed",
];

const TASK_PRIORITIES: TaskPriority[] = ["low", "medium", "high", "urgent"];

const SIDEBAR_KEYS = [
  "crmLeads",
  "newFormgridClients",
  "meetingRecordings",
  "relocation",
  "checkupsErevan",
] as const;

describe("PR #11 — Tasks i18n (EN)", () => {
  it("возвращает английские заголовки и подписи модуля Tasks", () => {
    assert.equal(translateTasksMessage("en", "title"), "Team tasks");
    assert.equal(translateTasksMessage("en", "newTask"), "New task");
    assert.equal(translateTasksMessage("en", "search.placeholder"), "Search by title, description, author, assignee…");
    assert.equal(translateTasksMessage("en", "empty.list"), "No tasks yet. Create the first one — the whole team will see it.");
    assert.equal(translateTasksMessage("en", "loading.list"), "Loading tasks…");
  });

  it("локализует demo-задачу Sofia Martins на английском", () => {
    const title = resolveDemoTaskText("en", "demo:review-sofia-documents.title");
    assert.match(title, /Sofia Martins/i);
    assert.doesNotMatch(title, /[а-яА-ЯёЁ]/);
  });
});

describe("PR #11 — Tasks i18n (RU)", () => {
  it("возвращает русские заголовки и подписи модуля Tasks", () => {
    assert.equal(translateTasksMessage("ru", "title"), "Задачи команды");
    assert.equal(translateTasksMessage("ru", "newTask"), "Новая задача");
    assert.match(translateTasksMessage("ru", "search.placeholder"), /Поиск/);
    assert.match(translateTasksMessage("ru", "empty.list"), /Пока нет задач/);
  });

  it("локализует demo-задачу на русском", () => {
    const title = resolveDemoTaskText("ru", "demo:review-sofia-documents.title");
    assert.match(title, /София|документ/i);
    assert.match(title, /[а-яА-ЯёЁ]/);
  });
});

describe("PR #11 — Task statuses", () => {
  it("EN: To Do / In Progress / Waiting / Blocked / Completed", () => {
    assert.equal(translateTasksStatus("en", "new"), "To Do");
    assert.equal(translateTasksStatus("en", "in_progress"), "In Progress");
    assert.equal(translateTasksStatus("en", "pending_approval"), "Waiting");
    assert.equal(translateTasksStatus("en", "needs_revision"), "Blocked");
    assert.equal(translateTasksStatus("en", "completed"), "Completed");
  });

  it("RU: локализованные статусы без английских UI-меток", () => {
    for (const status of TASK_STATUSES) {
      const label = translateTasksStatus("ru", status);
      assert.match(label, /[а-яА-ЯёЁ]/, `status ${status}`);
    }
  });
});

describe("PR #11 — Task priorities", () => {
  it("EN: Low / Medium / High / Urgent", () => {
    assert.equal(translateTasksPriority("en", "low"), "Low");
    assert.equal(translateTasksPriority("en", "medium"), "Medium");
    assert.equal(translateTasksPriority("en", "high"), "High");
    assert.equal(translateTasksPriority("en", "urgent"), "Urgent");
  });

  it("RU: локализованные приоритеты", () => {
    for (const priority of TASK_PRIORITIES) {
      const label = translateTasksPriority("ru", priority);
      assert.match(label, /[а-яА-ЯёЁ]/, `priority ${priority}`);
    }
  });
});

describe("PR #11 — Demo tasks seed", () => {
  it("содержит минимум 20 реалистичных demo-задач", () => {
    assert.ok(DEMO_TASK_SEEDS.length >= 20, `expected >= 20, got ${DEMO_TASK_SEEDS.length}`);
  });

  it("demo-задачи используют demo: prefix и локализуются", () => {
    const tasks = buildDemoTasks();
    assert.equal(tasks.length, DEMO_TASK_SEEDS.length);
    for (const task of tasks) {
      assert.match(task.title, /^demo:/);
      const localized = localizeTask("en", task);
      assert.doesNotMatch(localized.title, /^demo:/);
      assert.ok(localized.title.length > 3);
    }
  });

  it("demo-задачи назначены на команду Olivia / Daniel / Emma / Lucas", () => {
    const allowed = new Set([
      "olivia-bennett",
      "daniel-cooper",
      "emma-wilson",
      "lucas-martin",
    ]);
    for (const seed of DEMO_TASK_SEEDS) {
      assert.ok(allowed.has(seed.createdById), seed.slug);
      for (const id of seed.assigneeIds) {
        assert.ok(allowed.has(id), `${seed.slug} assignee ${id}`);
      }
    }
  });
});

describe("PR #11 — Error pages i18n", () => {
  it("404 EN / RU", () => {
    assert.equal(translateMessage("en", "errors.notFound.title"), "Page not found");
    assert.equal(translateMessage("ru", "errors.notFound.title"), "Страница не найдена");
  });

  it("500 EN / RU", () => {
    assert.equal(translateMessage("en", "errors.serverError.title"), "Something went wrong");
    assert.equal(translateMessage("ru", "errors.serverError.title"), "Произошла ошибка");
  });
});

describe("PR #11 — Sidebar nav i18n", () => {
  it("EN: бывшие hardcoded RU пункты на английском", () => {
    for (const key of SIDEBAR_KEYS) {
      const label = translateMessage("en", `nav.${key}`);
      assert.doesNotMatch(label, /[а-яА-ЯёЁ]/, key);
      assert.ok(label.length > 1, key);
    }
  });

  it("RU: пункты sidebar на русском", () => {
    assert.equal(translateMessage("ru", "nav.crmLeads"), "Новые лиды");
    assert.equal(translateMessage("ru", "nav.relocation"), "Эмиграция");
    assert.match(translateMessage("ru", "nav.checkupsErevan"), /Ереван/);
    assert.equal(translateMessage("ru", "nav.analytics"), "Аналитика");
    assert.equal(translateMessage("ru", "nav.team"), "Команда");
    assert.equal(translateMessage("ru", "nav.settings"), "Настройки");
  });

  it("RU: страницы Эмиграция и Чекапы переведены", () => {
    assert.match(
      translateMessage("ru", "relocationPage.resources.croatia-clients-sheet.title"),
      /[а-яА-ЯёЁ]/,
    );
    assert.match(
      translateMessage("ru", "checkupsPage.resources.yerevan-checkups-site.title"),
      /[а-яА-ЯёЁ]/,
    );
  });

  it("RU: имена команды на кириллице", () => {
    assert.equal(
      translateTeamMemberName("ru", "olivia-bennett", "Olivia Bennett"),
      "Оливия Беннетт",
    );
    assert.match(
      translateTeamMemberName("ru", "daniel-cooper", "Daniel Cooper"),
      /[а-яА-ЯёЁ]/,
    );
  });

  it("nav items используют labelKey вместо hardcoded label", () => {
    const items = getNavItemsForRole("owner");
    const fixed = items.filter((item) =>
      SIDEBAR_KEYS.some((key) => item.labelKey === key),
    );
    assert.equal(fixed.length, SIDEBAR_KEYS.length);
    for (const item of fixed) {
      assert.equal(item.labelNs, "nav");
      assert.ok(!item.label, item.labelKey);
    }
  });
});

describe("PR #11 — Login rate limit (demo)", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = { ...envBackup, SPIORA_DEMO_MODE: "true" };
    resetLoginRateLimitForTests();
  });

  afterEach(() => {
    process.env = envBackup;
    resetLoginRateLimitForTests();
  });

  it("блокирует после 5 попыток за минуту", () => {
    const email = "demo@example.com";
    for (let i = 0; i < LOGIN_MAX_ATTEMPTS_PER_MINUTE; i++) {
      const result = checkLoginRateLimit(email, "127.0.0.1");
      assert.equal(result.allowed, true, `attempt ${i + 1}`);
    }
    const blocked = checkLoginRateLimit(email, "127.0.0.1");
    assert.equal(blocked.allowed, false);
    if (!blocked.allowed) {
      assert.ok(blocked.retryAfterMs > 0);
    }
  });

  it("не ограничивает вне demo mode", () => {
    process.env.SPIORA_DEMO_MODE = "false";
    for (let i = 0; i < 10; i++) {
      assert.equal(checkLoginRateLimit("a@b.com").allowed, true);
    }
  });

  it("auth.rateLimitExceeded локализован", () => {
    assert.match(translateMessage("en", "auth.rateLimitExceeded"), /Too many sign-in attempts/i);
    assert.match(translateMessage("ru", "auth.rateLimitExceeded"), /[а-яА-ЯёЁ]/);
  });

  it("разблокирует после истечения окна", () => {
    const email = "blocked@example.com";
    for (let i = 0; i <= LOGIN_MAX_ATTEMPTS_PER_MINUTE; i++) {
      checkLoginRateLimit(email, "10.0.0.1");
    }
    advanceLoginRateLimitForTests(61_000);
    assert.equal(checkLoginRateLimit(email, "10.0.0.1").allowed, true);
  });
});

describe("PR #11 — Debug disabled in demo", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = { ...envBackup, SPIORA_DEMO_MODE: "true" };
  });

  afterEach(() => {
    process.env = envBackup;
  });

  it("areDebugFeaturesEnabled === false", () => {
    assert.equal(areDebugFeaturesEnabled(), false);
    assert.equal(isDebugApiAllowed(), false);
    assert.equal(isDebugClientCommandAllowed(), false);
    assert.equal(isWorkspaceDiagnosticsEnabled(), false);
  });

  it("debug остаётся доступен вне demo", () => {
    delete process.env.SPIORA_DEMO_MODE;
    assert.equal(areDebugFeaturesEnabled(), true);
    assert.equal(isWorkspaceDiagnosticsEnabled(), true);
  });
});

describe("PR #11 — Mixed language (fixed surfaces)", () => {
  it("EN nav catalog не содержит кириллицы", () => {
    const en = getMessagesForLocale("en");
    const nav = en.nav as Record<string, string>;
    for (const [key, value] of Object.entries(nav)) {
      assert.doesNotMatch(value, /[а-яА-ЯёЁ]/, `nav.${key}`);
    }
  });

  it("RU: исправленные пункты sidebar без английских меток", () => {
    for (const key of SIDEBAR_KEYS) {
      const label = translateMessage("ru", `nav.${key}`);
      assert.match(label, /[а-яА-ЯёЁ]/, `nav.${key}: ${label}`);
    }
  });

  it("EN tasks namespace ≥ 190 leaf keys", () => {
    const count = countTasksLeafKeys();
    assert.ok(count >= 190, `tasks leaf keys: ${count}`);
  });
});
