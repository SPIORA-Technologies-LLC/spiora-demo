import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  intakeRecordSearchHay,
  intakeTwoTokenNameOrFilter,
  matchesIntakeSearch,
  splitIntakeSearchTokens,
} from "@/lib/client-portal/case-intake-search";

describe("case-intake-search", () => {
  it("splits multi-word Russian names into tokens", () => {
    assert.deepEqual(splitIntakeSearchTokens("майя петрова"), ["майя", "петрова"]);
  });

  it("matches when all tokens appear across intake fields", () => {
    const hay = intakeRecordSearchHay({
      firstName: "Майя",
      lastName: "Petrova",
      email: "info.desk.coord@gmail.com",
    });
    assert.equal(matchesIntakeSearch(hay, ["майя", "петрова"]), false);
    const hayRu = intakeRecordSearchHay({
      firstName: "Майя",
      lastName: "Петрова",
      email: "info.desk.coord@gmail.com",
    });
    assert.equal(matchesIntakeSearch(hayRu, ["майя", "петрова"]), true);
    assert.equal(matchesIntakeSearch(hayRu, ["петрова", "майя"]), true);
  });

  it("builds two-token PostgREST name filter", () => {
    assert.match(
      intakeTwoTokenNameOrFilter("майя", "петрова"),
      /first_name\.ilike\.%майя%.*last_name\.ilike\.%петрова%/,
    );
  });
});
