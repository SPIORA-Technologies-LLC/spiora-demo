import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  checkLeadAgainstDesk,
  deskFullNameMatches,
} from "@/lib/leads/desk-dedup";
import type { EmigrantDeskClient } from "@/lib/emigrant-desk/types";

function desk(partial: Partial<EmigrantDeskClient>): EmigrantDeskClient {
  return {
    id: "desk-1",
    firstName: null,
    lastName: null,
    email: "",
    currentStatus: null,
    caseNumber: null,
    consulate: null,
    submissionCity: null,
    submissionDate: null,
    statusUpdatedAt: null,
    internalComment: null,
    ...partial,
  };
}

describe("checkLeadAgainstDesk", () => {
  it("marks case_number match as STRONG duplicate", () => {
    const check = checkLeadAgainstDesk(
      {
        name: "Demo Client Alpha",
        passport: "DEMO-P90001",
        email: "other@example.com",
      },
      desk({
        lastName: "Alpha",
        firstName: "Demo",
        caseNumber: "DEMO-P90001",
        email: "demo.client.a@example.com",
      }),
    );

    assert.equal(check.isStrongDuplicate, true);
    assert.ok(check.strongReasons.includes("desk_case_number"));
    assert.equal(check.isMediumDuplicate, false);
  });

  it("marks email match as STRONG duplicate", () => {
    const check = checkLeadAgainstDesk(
      {
        name: "Demo Client Beta",
        passport: "DEMO-P90002",
        email: "demo.client.b@example.com",
      },
      desk({
        lastName: "Beta",
        firstName: "Demo",
        caseNumber: "DEMO-P90003",
        email: "demo.client.b@example.com",
      }),
    );

    assert.equal(check.isStrongDuplicate, true);
    assert.ok(check.strongReasons.includes("desk_email"));
  });

  it("marks name-only match as MEDIUM duplicate", () => {
    const check = checkLeadAgainstDesk(
      {
        name: "Иванов Иван Иванович",
        passport: "DEMO-P90004",
        email: "new@example.com",
      },
      desk({
        lastName: "Иванов",
        firstName: "Иван",
        caseNumber: "DEMO-P90005",
        email: "other@example.com",
      }),
    );

    assert.equal(check.isStrongDuplicate, false);
    assert.equal(check.isMediumDuplicate, true);
    assert.ok(check.mediumReasons.includes("desk_name"));
  });

  it("returns no match for unrelated client", () => {
    const check = checkLeadAgainstDesk(
      {
        name: "Demo Client Delta",
        passport: "DEMO-P90006",
        email: "demo.client.d@example.com",
      },
      desk({
        lastName: "Unrelated",
        firstName: "Client",
        caseNumber: "DEMO-P90007",
        email: "petrov@example.com",
      }),
    );

    assert.equal(check.isStrongDuplicate, false);
    assert.equal(check.isMediumDuplicate, false);
  });
});

describe("deskFullNameMatches", () => {
  it("matches surname and first name regardless of patronymic", () => {
    assert.equal(
      deskFullNameMatches(
        "Сидоров Пётр Петрович",
        desk({ lastName: "Сидоров", firstName: "Пётр" }),
      ),
      true,
    );
  });
});
