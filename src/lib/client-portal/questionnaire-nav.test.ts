import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  countCompletedSections,
  computeLiveSectionProgress,
  getAdjacentSectionIds,
  getProgressSectionIds,
  getSectionNavState,
  isSectionComplete,
  listIncompleteRequiredFields,
  validateSectionRequiredFields,
} from "./questionnaire-nav.ts";

const progress = {
  welcome: { completed: 0, total: 0, percent: 100 },
  personal: { completed: 2, total: 2, percent: 100 },
  contact: { completed: 0, total: 3, percent: 0 },
};

describe("questionnaire-nav", () => {
  it("does not treat sections with no required fields as complete", () => {
    assert.equal(isSectionComplete(progress, "welcome"), false);
  });

  it("marks current over completed for nav state", () => {
    assert.equal(getSectionNavState("personal", "personal", progress), "current");
    assert.equal(getSectionNavState("welcome", "personal", progress), "incomplete");
    assert.equal(getSectionNavState("contact", "personal", progress), "incomplete");
    assert.equal(getSectionNavState("personal", "welcome", progress), "completed");
  });

  it("counts completed sections without using question totals", () => {
    assert.equal(
      countCompletedSections(["welcome", "personal", "contact"], progress),
      1,
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
    assert.equal(countCompletedSections(["welcome", "personal"], empty.sectionProgress), 0);

    const filled = computeLiveSectionProgress(sections, { first_name: "Ivan" });
    assert.equal(filled.sectionProgress.personal?.percent, 100);
    assert.equal(countCompletedSections(["welcome", "personal"], filled.sectionProgress), 1);
  });

  it("excludes display-only intros from progress section ids", () => {
    const sections = [
      {
        id: "welcome",
        questions: [{ id: "h", type: "information" }],
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
      {
        id: "family",
        questions: [
          {
            id: "notes",
            type: "textarea",
            label: { en: "Notes", ru: "Заметки" },
          },
        ],
      },
    ];
    assert.deepEqual(getProgressSectionIds(sections), ["personal", "family"]);
  });

  it("excludes derived and read-only fields from progress", () => {
    const sections = [
      {
        id: "contact",
        title: { en: "Contact", ru: "Контакты" },
        questions: [
          {
            id: "email",
            type: "email",
            required: true,
            readOnly: true,
            derivedFrom: "portal_email",
            label: { en: "Email", ru: "Email" },
          },
          {
            id: "phone",
            type: "phone",
            required: true,
            label: { en: "Phone", ru: "Телефон" },
          },
        ],
      },
    ];
    const progress = computeLiveSectionProgress(sections, { phone: "+123" });
    assert.equal(progress.percent, 100);
    assert.equal(progress.sectionProgress.contact?.total, 1);
    assert.equal(progress.sectionProgress.contact?.completed, 1);
  });

  it("lists incomplete required fields for review guidance", () => {
    const sections = [
      {
        id: "contact",
        title: { en: "Contact", ru: "Контакты" },
        questions: [
          {
            id: "email",
            type: "email",
            required: true,
            readOnly: true,
            derivedFrom: "portal_email",
            label: { en: "Email", ru: "Email" },
          },
          {
            id: "phone",
            type: "phone",
            required: true,
            label: { en: "Phone", ru: "Телефон" },
          },
          {
            id: "country",
            type: "country",
            required: true,
            label: { en: "Country", ru: "Страна" },
          },
        ],
      },
    ];
    const incomplete = listIncompleteRequiredFields(sections, { phone: "+1" }, "ru");
    assert.deepEqual(incomplete, [
      {
        sectionId: "contact",
        questionId: "country",
        sectionTitle: "Контакты",
        label: "Страна",
      },
    ]);
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
