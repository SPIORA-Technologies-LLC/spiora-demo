import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ClientContext } from "@/lib/ai/client-context";
import { analyzeLeadDuplicates } from "@/lib/leads/lead-review-dedup";
import type { EmigrantDeskClient } from "@/lib/emigrant-desk/types";

function ctx(
  partial: Partial<ClientContext> & Pick<ClientContext, "source" | "name">,
): ClientContext {
  return {
    sourceLabel: partial.source === "clients" ? "Клиенты" : "Новые клиенты",
    rowIndex: partial.rowIndex ?? 1,
    phone: "",
    email: "",
    country: "",
    direction: "",
    status: "",
    manager: "",
    lastActivity: "",
    surveyData: "",
    score: 50,
    matchedFields: [],
    debugRow: {},
    ...partial,
  };
}

function desk(partial: Partial<EmigrantDeskClient>): EmigrantDeskClient {
  return {
    id: partial.id ?? "desk-uuid",
    firstName: null,
    lastName: null,
    email: "",
    currentStatus: "В работе",
    caseNumber: null,
    consulate: null,
    submissionCity: null,
    submissionDate: null,
    statusUpdatedAt: null,
    internalComment: null,
    ...partial,
  };
}

describe("analyzeLeadDuplicates desk integration", () => {
  it("adds Desk STRONG match as informational hint when case_number equals passport", () => {
    const lead = ctx({
      source: "new_clients",
      name: "Demo Client Alpha",
      rowIndex: 7,
      email: "demo.client.a@example.com",
    });

    const analysis = analyzeLeadDuplicates(
      lead,
      [],
      [],
      [
        desk({
          id: "desk-alpha",
          lastName: "Alpha",
          firstName: "Demo",
          caseNumber: "DEMO-P90001",
          email: "desk.alpha@example.com",
        }),
      ],
      {
        name: "Demo Client Alpha",
        passport: "DEMO-P90001",
        email: "demo.client.a@example.com",
      },
    );

    assert.equal(analysis.hasBlockingStrongMatch, false);
    assert.equal(analysis.hasDeskHint, true);
    assert.equal(analysis.deskStrongMatches.length, 1);
    assert.equal(analysis.deskStrongMatches[0].source, "desk");
    assert.ok(analysis.deskStrongMatches[0].reasons.includes("Desk case_number"));
    assert.equal(analysis.blockingStrongMatches.length, 0);
  });

  it("keeps CRM blocking and Desk informational separate", () => {
    const lead = ctx({
      source: "new_clients",
      name: "Demo Client Beta Full",
      rowIndex: 3,
      debugRow: { passport: "DEMO-P90010" },
    });
    const crm = ctx({
      source: "clients",
      name: "Demo Client Beta",
      debugRow: { passport: "DEMO-P90010" },
    });

    const analysis = analyzeLeadDuplicates(
      lead,
      [crm],
      [],
      [
        desk({
          lastName: "Beta",
          firstName: "Demo",
          caseNumber: "DEMO-P90010",
        }),
      ],
      {
        name: "Demo Client Beta Full",
        passport: "DEMO-P90010",
        email: "",
      },
    );

    assert.equal(analysis.hasBlockingStrongMatch, true);
    assert.equal(analysis.blockingStrongMatches.length, 1);
    assert.equal(analysis.blockingStrongMatches[0].source, "crm");
    assert.equal(analysis.deskStrongMatches.length, 1);
    assert.equal(analysis.hasDeskHint, true);
  });

  it("adds Desk MEDIUM match as informational hint for name-only overlap", () => {
    const lead = ctx({
      source: "new_clients",
      name: "Иванов Иван Иванович",
      rowIndex: 12,
      email: "ivan.new@example.com",
    });

    const analysis = analyzeLeadDuplicates(
      lead,
      [],
      [],
      [
        desk({
          lastName: "Иванов",
          firstName: "Иван",
          caseNumber: "DEMO-P90011",
          email: "ivan.desk@example.com",
        }),
      ],
      {
        name: "Иванов Иван Иванович",
        passport: "DEMO-P90012",
        email: "ivan.new@example.com",
      },
    );

    assert.equal(analysis.hasBlockingStrongMatch, false);
    assert.equal(analysis.hasDeskHint, true);
    assert.equal(analysis.deskMediumMatches.length, 1);
    assert.equal(analysis.deskMediumMatches[0].source, "desk");
    assert.ok(analysis.deskMediumMatches[0].reasons.includes("Desk ФИО"));
  });

  it("classifies clean lead as LOW risk (no blocking or desk hints)", () => {
    const lead = ctx({
      source: "new_clients",
      name: "Demo Client Delta",
      rowIndex: 10,
      email: "demo.client.d@example.com",
    });

    const analysis = analyzeLeadDuplicates(
      lead,
      [],
      [],
      [
        desk({
          lastName: "Unrelated",
          firstName: "Client",
          caseNumber: "DEMO-P90013",
          email: "petrov@example.com",
        }),
      ],
      {
        name: "Demo Client Delta",
        passport: "DEMO-P90014",
        email: "demo.client.d@example.com",
      },
    );

    assert.equal(analysis.hasBlockingStrongMatch, false);
    assert.equal(analysis.hasDeskHint, false);
    assert.equal(analysis.hasPossibleMatch, false);
  });
});
