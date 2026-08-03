import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import { translateAdminMessage, translateUserRole } from "@/i18n/admin-messages.ts";
import { translateAnalyticsMessage } from "@/i18n/analytics-messages.ts";
import { translateRole } from "@/i18n/roles.ts";
import {
  buildDemoOverviewAnalytics,
  DEMO_OVERVIEW_KPI_KEYS,
} from "@/lib/analytics/demo-overview.ts";
import { getIntegrationStatuses } from "@/lib/settings/integrations.ts";
import { canDeleteTeamMember } from "@/lib/team/permissions.ts";
import type { SessionUser } from "@/lib/auth/types.ts";

describe("admin modules demo analytics", () => {
  it("builds overview with all required KPI keys", () => {
    const data = buildDemoOverviewAnalytics("en");
    assert.equal(data.demo, true);
    assert.equal(DEMO_OVERVIEW_KPI_KEYS.length, 7);
    assert.equal(data.kpis.activeClients, 12);
    assert.equal(data.teamWorkload.length, 4);
    assert.equal(data.clientDistribution.length, 4);
  });

  it("EN: KPI labels without Cyrillic", () => {
    for (const key of DEMO_OVERVIEW_KPI_KEYS) {
      const label = translateAnalyticsMessage("en", `overview.kpis.${key}`);
      assert.doesNotMatch(label, /[А-Яа-яЁё]/);
    }
    assert.equal(translateAnalyticsMessage("en", "demoBadge"), "Demo data");
  });

  it("RU: demo badge in Russian", () => {
    assert.equal(
      translateAnalyticsMessage("ru", "demoBadge"),
      "Демонстрационные данные",
    );
  });
});

describe("roles localization", () => {
  it("EN: owner and manager without Cyrillic", () => {
    assert.equal(translateRole("en", "owner"), "Administrator");
    assert.equal(translateRole("en", "manager"), "Manager");
    assert.doesNotMatch(translateUserRole("en", "owner"), /[А-Яа-яЁё]/);
  });

  it("RU: localized roles", () => {
    assert.equal(translateUserRole("ru", "owner"), "Администратор");
    assert.equal(translateUserRole("ru", "finance_manager"), "Бухгалтер");
    assert.match(translateUserRole("ru", "manager"), /[А-Яа-яЁё]/);
  });
});

describe("demo integration statuses", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = { ...envBackup, SPIORA_DEMO_MODE: "true" };
  });

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it("never exposes secret fields in integration status payload", () => {
    const statuses = getIntegrationStatuses();
    const serialized = JSON.stringify(statuses);
    assert.doesNotMatch(serialized, /secret|api_key|service_role|password/i);
    assert.ok(statuses.googleDrive);
    assert.ok(statuses.supabase);
  });

  it("EN: integration disabled messages without Cyrillic", () => {
    const message = translateAdminMessage("en", "demoGuard.settingsIntegrations");
    assert.doesNotMatch(message, /[А-Яа-яЁё]/);
  });
});

describe("team RBAC", () => {
  const owner: SessionUser = {
    id: "olivia-bennett",
    email: "olivia@spiora.demo",
    name: "Olivia Bennett",
    role: "owner",
  };
  const manager: SessionUser = {
    id: "emma-wilson",
    email: "emma@spiora.demo",
    name: "Emma Wilson",
    role: "manager",
  };

  it("manager cannot delete owner", () => {
    assert.equal(
      canDeleteTeamMember(manager, { id: "olivia-bennett", role: "owner" }),
      false,
    );
  });

  it("manager cannot delete other managers", () => {
    assert.equal(
      canDeleteTeamMember(manager, { id: "lucas-martin", role: "manager" }),
      false,
    );
  });

  it("owner cannot delete self", () => {
    assert.equal(
      canDeleteTeamMember(owner, { id: "olivia-bennett", role: "owner" }),
      false,
    );
  });

  it("owner can delete a manager", () => {
    assert.equal(
      canDeleteTeamMember(owner, { id: "emma-wilson", role: "manager" }),
      true,
    );
  });
});

describe("demo guard messages", () => {
  it("EN/RU password reset guard", () => {
    const en = translateAdminMessage("en", "demoGuard.settingsPasswordReset");
    const ru = translateAdminMessage("ru", "demoGuard.settingsPasswordReset");
    assert.doesNotMatch(en, /[А-Яа-яЁё]/);
    assert.match(ru, /[А-Яа-яЁё]/);
  });

  it("team delete errors localized", () => {
    assert.equal(
      translateAdminMessage("en", "team.errors.deleteForbidden"),
      "Insufficient permissions to delete this user.",
    );
  });
});
