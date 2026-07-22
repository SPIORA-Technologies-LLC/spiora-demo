import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  countCompletedSections,
  computeLiveSectionProgress,
  getAdjacentSectionIds,
  getSectionNavState,
  isSectionComplete,
  validateSectionRequiredFields,
} from "./questionnaire-nav.ts";

const progress = {
  welcome: { completed: 0, total: 0, percent: 100 },
  personal: { completed: 2, total: 2, percent: 100 },
  contact: { completed: 0, total: 3, percent: 0 },
};

describe("questionnaire-nav", () => {
  it("treats sections with no required fields as complete", () => {
    assert.equal(isSectionComplete(progress, "welcome"), true);
  });

  it("marks current over completed for nav state", () => {
    assert.equal(getSectionNavState("personal", "personal", progress), "current");
    assert.equal(getSectionNavState("welcome", "personal", progress), "completed");
    assert.equal(getSectionNavState("contact", "personal", progress), "incomplete");
  });

  it("counts completed sections without using question totals", () => {
    assert.equal(
      countCompletedSections(["welcome", "personal", "contact"], progress),
      2,
    );
  });

  it("resolves adjacent sections and last-section flag", () => {
    const ids = ["welcome", "personal", "contact"];
    assert.deepEqual(getAdjacentSectionIds(ids, "welcome"), {
      previousId: null,
      nextId: "personal",
      isLast: false,
      isFirst: true,
    });
    assert.deepEqual(getAdjacentSectionIds(ids, "contact"), {
      previousId: "personal",
      nextId: null,
      isLast: true,
      isFirst: false,
    });
  });

  it("computes live section progress from required answers", () => {
    const sections = [
      {
        id: "welcome",
        questions: [{ id: "h", type: "heading" }],
      },
      {
        id: "personal",
        questions: [
          {
            id: "first_name",
            type: "text",
            required: true,
            label: { en: "First name", ru: "Имя" },
          },
        ],
      },
    ];
    const empty = computeLiveSectionProgress(sections, {});
    assert.equal(empty.sectionProgress.welcome?.percent, 100);
    assert.equal(empty.sectionProgress.personal?.percent, 0);
    assert.equal(countCompletedSections(["welcome", "personal"], empty.sectionProgress), 1);

    const filled = computeLiveSectionProgress(sections, { first_name: "Ivan" });
    assert.equal(filled.sectionProgress.personal?.percent, 100);
    assert.equal(countCompletedSections(["welcome", "personal"], filled.sectionProgress), 2);
  });

  it("validates required fields for current section only", () => {
    const section = {
      id: "personal",
      questions: [
        {
          id: "first_name",
          type: "text",
          required: true,
          label: { en: "First name", ru: "Имя" },
        },
      ],
    };
    const errors = validateSectionRequiredFields(section, {}, "ru");
    assert.equal(errors.length, 1);
    assert.equal(errors[0]?.questionId, "first_name");
    assert.equal(validateSectionRequiredFields(section, { first_name: "Ivan" }, "ru").length, 0);
  });
});
