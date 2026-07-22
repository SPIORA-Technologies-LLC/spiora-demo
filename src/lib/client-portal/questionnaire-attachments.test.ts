import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isAllowedQuestionnaireAttachment,
  isQuestionnaireFileAnswer,
} from "./questionnaire-attachment-formats.ts";
import { isEmptyAnswer } from "./questionnaire-empty-values.ts";
import { formatAnswerForReview } from "./questionnaire-review.ts";
import { GENERAL_CLIENT_ONBOARDING_SCHEMA } from "./questionnaire-demo-template.ts";
import { validateSchemaStructure } from "./questionnaire-schema.ts";

describe("questionnaire attachments", () => {
  it("accepts pdf and image uploads within size limit", () => {
    assert.equal(
      isAllowedQuestionnaireAttachment("passport.pdf", "application/pdf", 1024).ok,
      true,
    );
    assert.equal(
      isAllowedQuestionnaireAttachment("scan.jpg", "image/jpeg", 2048).ok,
      true,
    );
  });

  it("rejects oversized or unsupported files", () => {
    assert.deepEqual(
      isAllowedQuestionnaireAttachment("big.pdf", "application/pdf", 20 * 1024 * 1024),
      { ok: false, reason: "too_large" },
    );
    assert.deepEqual(
      isAllowedQuestionnaireAttachment("note.exe", "application/octet-stream", 100),
      { ok: false, reason: "unsupported_type" },
    );
  });

  it("treats file answer objects as empty without id/fileName", () => {
    assert.equal(isEmptyAnswer({ id: "", fileName: "a.pdf" }), true);
    assert.equal(
      isEmptyAnswer({
        id: "att-1",
        fileName: "a.pdf",
        mimeType: "application/pdf",
        sizeBytes: 10,
      }),
      false,
    );
    assert.equal(
      isQuestionnaireFileAnswer({
        id: "att-1",
        fileName: "a.pdf",
        mimeType: "application/pdf",
        sizeBytes: 10,
      }),
      true,
    );
  });

  it("formats file answers for review by file name", () => {
    const question = GENERAL_CLIENT_ONBOARDING_SCHEMA.sections
      .flatMap((section) => section.questions)
      .find((item) => item.id === "doc_passport_page");
    assert.ok(question);
    assert.equal(
      formatAnswerForReview(
        question!,
        {
          id: "att-1",
          fileName: "passport.pdf",
          mimeType: "application/pdf",
          sizeBytes: 12,
        },
        "ru",
      ),
      "passport.pdf",
    );
  });

  it("includes document_copies section with file questions", () => {
    const result = validateSchemaStructure(GENERAL_CLIENT_ONBOARDING_SCHEMA);
    assert.equal(result.ok, true);
    const section = GENERAL_CLIENT_ONBOARDING_SCHEMA.sections.find(
      (item) => item.id === "document_copies",
    );
    assert.ok(section);
    assert.ok(section?.questions.some((q) => q.type === "file" && q.id === "doc_passport_page"));
    assert.ok(section?.questions.some((q) => q.type === "file" && q.id === "doc_bank_statement"));
  });
});
