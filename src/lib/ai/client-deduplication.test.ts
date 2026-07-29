import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ClientContext } from "@/lib/ai/client-context";
import {
  areClientsDuplicates,
  deduplicateToResolved,
  groupDuplicateClients,
} from "@/lib/ai/client-deduplication";

function ctx(
  partial: Partial<ClientContext> & Pick<ClientContext, "source" | "name">,
): ClientContext {
  return {
    sourceLabel: "Клиенты",
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

describe("areClientsDuplicates", () => {
  it("strong merge on matching passport across CRM rows", () => {
    const left = ctx({
      source: "clients",
      name: "Давлятова Лола",
      rowIndex: 1,
      debugRow: { passport: "762762123" },
    });
    const right = ctx({
      source: "clients",
      name: "Давлятова Лола Бахтиёровна",
      rowIndex: 5,
      debugRow: { "8. № заграничного паспорта": "762762123" },
    });

    const check = areClientsDuplicates(left, right);
    assert.equal(check.isDuplicate, true);
    assert.ok(check.reasons.includes("passport"));
    assert.equal(check.isPossibleDuplicate, false);
  });

  it("does not strong-merge same name with different passports", () => {
    const left = ctx({
      source: "clients",
      name: "Смола Александра",
      rowIndex: 1,
      debugRow: { passport: "111111111" },
    });
    const right = ctx({
      source: "clients",
      name: "Смола Александра Сергеевна",
      rowIndex: 2,
      debugRow: { "8. № заграничного паспорта": "222222222" },
    });

    const check = areClientsDuplicates(left, right);
    assert.equal(check.isDuplicate, false);
    assert.equal(check.isPossibleDuplicate, false);
  });

  it("marks FIO-only match as possible duplicate when passport missing", () => {
    const left = ctx({
      source: "clients",
      name: "Белкания Автандил",
      rowIndex: 1,
      debugRow: {},
    });
    const right = ctx({
      source: "clients",
      name: "Белкания Автандил Яношевич",
      rowIndex: 2,
      debugRow: {},
    });

    const check = areClientsDuplicates(left, right);
    assert.equal(check.isDuplicate, false);
    assert.equal(check.isPossibleDuplicate, true);
    assert.ok(check.possibleReasons.length > 0);
  });
});

describe("groupDuplicateClients", () => {
  it("merges passport matches and keeps FIO-only pairs separate", () => {
    const crmPassport = ctx({
      source: "clients",
      name: "Лысогорская Лейсан",
      rowIndex: 1,
      debugRow: { passport: "555555555" },
    });
    const crmPassportDup = ctx({
      source: "clients",
      name: "Лысогорская Лейсан Ильдусовна",
      rowIndex: 3,
      debugRow: { "8. № заграничного паспорта": "555555555" },
    });
    const crmFioOnly = ctx({
      source: "clients",
      name: "Белкания Автандил",
      rowIndex: 10,
      debugRow: {},
    });
    const crmFioOnlyDup = ctx({
      source: "clients",
      name: "Белкания Автандил Яношевич",
      rowIndex: 11,
      debugRow: {},
    });

    const groups = groupDuplicateClients([
      crmPassport,
      crmPassportDup,
      crmFioOnly,
      crmFioOnlyDup,
    ]);
    const mergedGroups = groups.filter((g) => g.parts.length > 1);

    assert.equal(mergedGroups.length, 1);
    assert.ok(mergedGroups[0].mergeReasons.includes("passport"));
    assert.equal(mergedGroups[0].parts.length, 2);

    const resolved = deduplicateToResolved([
      crmPassport,
      crmPassportDup,
      crmFioOnly,
      crmFioOnlyDup,
    ]);
    assert.equal(resolved.length, 3);
  });
});
