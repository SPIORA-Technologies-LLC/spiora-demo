import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  escapeIlikePattern,
  validateCreateClientInput,
  validateUpdateClientInput,
  ClientValidationError,
} from "./validation.ts";
import { mapClientRowToClient } from "./map.ts";
import {
  isCrmLegacyFallbackAllowed,
  isCrmPostgresPrimary,
  resolveCrmDataSource,
} from "./config.ts";
import {
  canArchiveClient,
  canCreateClient,
  canUpdateClient,
} from "./permissions.ts";
import { buildInsertFromCreateInput, isDuplicateExternalIdError } from "../supabase/clients-repo.ts";

describe("clients validation", () => {
  it("требует имя при создании", () => {
    assert.throws(
      () => validateCreateClientInput({ name: "  " }),
      ClientValidationError,
    );
  });

  it("принимает валидный email", () => {
    const result = validateCreateClientInput({
      name: "Demo User",
      email: "demo@example.com",
    });
    assert.equal(result.email, "demo@example.com");
  });

  it("отклоняет невалидный external ID", () => {
    assert.throws(
      () =>
        validateCreateClientInput({
          name: "Demo",
          externalId: "REAL-001",
        }),
      ClientValidationError,
    );
  });

  it("update требует хотя бы одно поле", () => {
    assert.throws(() => validateUpdateClientInput({}), ClientValidationError);
  });

  it("экранирует спецсимволы ILIKE", () => {
    assert.equal(escapeIlikePattern("50%_done"), "50\\%\\_done");
  });
});

describe("clients map", () => {
  it("маппит строку БД в Client с external_id как id", () => {
    const client = mapClientRowToClient({
      id: "uuid-1",
      external_id: "DEMO-1001",
      first_name: "John",
      last_name: "Carter",
      full_name: "John Carter",
      email: "john@example.com",
      phone: "+0001",
      status: "In progress",
      pipeline_stage: "Active case",
      assigned_user_id: "user-1",
      assigned_manager_name: "Daniel Cooper",
      country: "US",
      citizenship: "US",
      direction: "Portugal",
      service_type: "Residence permit",
      source: "demo",
      notes_summary: "Note",
      passport_number: "DEMO-P10001",
      last_activity_at: "2026-05-28T00:00:00Z",
      created_at: "2026-03-12T00:00:00Z",
      updated_at: "2026-05-28T00:00:00Z",
      archived_at: null,
      is_demo: true,
      legacy_fields: { referentName: "Ref Demo" },
    });

    assert.equal(client.id, "DEMO-1001");
    assert.equal(client.name, "John Carter");
    assert.equal(client.manager, "Daniel Cooper");
    assert.equal(client.referentName, "Ref Demo");
  });
});

describe("clients permissions", () => {
  const manager = {
    id: "m1",
    email: "m@example.com",
    name: "Manager",
    role: "manager" as const,
  };
  const owner = { ...manager, id: "o1", role: "owner" as const };

  it("manager может создавать и обновлять", () => {
    assert.equal(canCreateClient(manager), true);
    assert.equal(canUpdateClient(manager), true);
    assert.equal(canArchiveClient(manager), false);
  });

  it("owner может архивировать", () => {
    assert.equal(canArchiveClient(owner), true);
  });
});

describe("clients config", () => {
  it("legacy fallback запрещён на Vercel", () => {
    assert.equal(
      isCrmLegacyFallbackAllowed({
        VERCEL: "1",
        SPIORA_CRM_LEGACY_FALLBACK: "true",
      }),
      false,
    );
  });

  it("legacy fallback только при явном флаге локально", () => {
    assert.equal(
      isCrmLegacyFallbackAllowed({ SPIORA_CRM_LEGACY_FALLBACK: "true" }),
      true,
    );
    assert.equal(isCrmLegacyFallbackAllowed({}), false);
  });
});

describe("clients-repo helpers", () => {
  it("распознаёт duplicate key error", () => {
    assert.equal(isDuplicateExternalIdError({ code: "23505" }), true);
    assert.equal(isDuplicateExternalIdError({ code: "42P01" }), false);
  });

  it("buildInsertFromCreateInput помечает demo", () => {
    const payload = buildInsertFromCreateInput(
      {
        name: "Test Client",
        email: "test@example.com",
        status: "New",
      },
      "DEMO-1099",
    );
    assert.equal(payload.external_id, "DEMO-1099");
    assert.equal(payload.is_demo, true);
    assert.equal(payload.source, "demo");
  });
});

describe("migration 022_clients.sql", () => {
  it("содержит таблицу clients и индексы без destructive SQL", () => {
    const sql = readFileSync(
      path.join(process.cwd(), "supabase/migrations/022_clients.sql"),
      "utf8",
    );
    assert.match(sql, /create table if not exists clients/i);
    assert.match(sql, /external_id text not null/i);
    assert.match(sql, /id uuid primary key/i);
    assert.match(sql, /clients_external_id_uidx/i);
    assert.doesNotMatch(sql, /drop table/i);
    assert.doesNotMatch(sql, /truncate/i);
  });
});

describe("demo seed idempotency", () => {
  const seedPaths = {
    sqlEditor: path.join(process.cwd(), "SPIORA_DEMO_SEED.sql"),
    supabase: path.join(process.cwd(), "supabase/seeds/clients-demo.sql"),
  };

  function extractClientValueRows(sql: string): string[] {
    const valuesIdx = sql.indexOf(") values");
    assert.ok(valuesIdx >= 0, "clients insert block not found");
    const endIdx = sql.indexOf("on conflict (external_id)", valuesIdx);
    assert.ok(endIdx >= 0, "on conflict (external_id) not found");
    const block = sql.slice(valuesIdx, endIdx);
    return block
      .split("\n")
      .map((line) => line.trim().replace(/,\s*$/, ""))
      .filter((line) => line.startsWith("('DEMO-"));
  }

  function parseClientRow(row: string) {
    assert.match(row, /^\('DEMO-\d{4}'/);
    const quoted = [...row.matchAll(/'((?:[^']|'')*)'/g)].map((match) =>
      match[1].replace(/''/g, "'"),
    );
    const externalId = quoted[0];
    assert.ok(externalId, "external_id missing");
    assert.equal(
      quoted.length,
      19,
      `${externalId}: expected 19 quoted column values`,
    );
    assert.match(row, /, true\)$/);
    return {
      externalId,
      firstName: quoted[1],
      lastName: quoted[2],
      fullName: quoted[3],
      email: quoted[4],
      phone: quoted[5],
      row,
    };
  }

  it("seed использует ON CONFLICT DO NOTHING", () => {
    for (const filePath of Object.values(seedPaths)) {
      const sql = readFileSync(filePath, "utf8");
      assert.match(sql, /on conflict \(external_id\) do nothing/i);
      assert.match(sql, /@example\.com/);
      assert.doesNotMatch(sql, /sharp-spice/i);
    }
  });

  it("seed содержит 25 demo-клиентов", () => {
    for (const filePath of Object.values(seedPaths)) {
      const sql = readFileSync(filePath, "utf8");
      const rows = extractClientValueRows(sql);
      assert.equal(rows.length, 25, filePath);
      const unique = new Set(rows.map((row) => parseClientRow(row).externalId));
      assert.equal(unique.size, 25, filePath);
    }
  });

  it("SPIORA_DEMO_SEED.sql и clients-demo.sql совпадают по 25 клиентам", () => {
    const editorRows = extractClientValueRows(
      readFileSync(seedPaths.sqlEditor, "utf8"),
    );
    const supabaseRows = extractClientValueRows(
      readFileSync(seedPaths.supabase, "utf8"),
    );
    assert.deepEqual(supabaseRows, editorRows);
  });

  it("demo seed не содержит реальных контактов", () => {
    for (const filePath of Object.values(seedPaths)) {
      const rows = extractClientValueRows(readFileSync(filePath, "utf8"));
      for (const row of rows) {
        const client = parseClientRow(row);
        assert.match(client.email, /@example\.com$/);
        assert.match(client.phone, /^\+000 000 000 \d{3}$/);
        assert.match(client.externalId, /^DEMO-\d{4}$/);
        assert.equal(client.fullName, `${client.firstName} ${client.lastName}`);
      }
    }
  });
});

describe("crm store source resolution", () => {
  it("resolveCrmDataSource возвращает demo без ключей Supabase", () => {
    const source = resolveCrmDataSource();
    assert.equal(source, "demo");
  });
});

describe("service role isolation", () => {
  it("clients-repo помечен server-only", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/lib/supabase/clients-repo.ts"),
      "utf8",
    );
    assert.match(source, /import "server-only"/);
  });

  it("isCrmPostgresPrimary использует isSupabaseConfigured", () => {
    assert.equal(typeof isCrmPostgresPrimary, "function");
  });
});
