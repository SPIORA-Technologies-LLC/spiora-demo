import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GENERAL_CLIENT_ONBOARDING_SCHEMA } from "./questionnaire-demo-template.ts";
import { hydrateDerivedAnswers } from "./questionnaire-derived.ts";
import { getCurrentQuestionnaire } from "./questionnaire-service.ts";
import { hashQuestionnaireSchema } from "./questionnaire-schema.ts";

describe("hydrateDerivedAnswers", () => {
  it("fills portal_email derived email for display and progress", () => {
    const hydrated = hydrateDerivedAnswers(
      GENERAL_CLIENT_ONBOARDING_SCHEMA,
      { phone: "+351912" },
      { portalEmail: "client@example.com" },
    );
    assert.equal(hydrated.email, "client@example.com");
    assert.equal(hydrated.phone, "+351912");
  });

  it("exposes portal email on GET even when draft answers omit it", async () => {
    const version = {
      id: "v1",
      templateId: "t1",
      version: 1,
      schema: GENERAL_CLIENT_ONBOARDING_SCHEMA,
      schemaHash: hashQuestionnaireSchema(GENERAL_CLIENT_ONBOARDING_SCHEMA),
      status: "published" as const,
      publishedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    const store = {
      async getPublishedVersionByTemplateKey() {
        return version;
      },
      async getPublishedVersionById() {
        return version;
      },
      async getByInvitationId() {
        return {
          id: "q1",
          clientPortalUserId: "portal-1",
          invitationId: "invite-1",
          templateVersionId: version.id,
          status: "draft" as const,
          answers: { first_name: "Ivan" },
          revision: 1,
          startedAt: new Date().toISOString(),
          lastSavedAt: new Date().toISOString(),
          reviewedAt: null,
          submittedAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          archivedAt: null,
        };
      },
      async getById() {
        return null;
      },
      async createDraft() {
        throw new Error("not used");
      },
      async updateDraft() {
        throw new Error("not used");
      },
      async setStatus() {
        throw new Error("not used");
      },
    };

    const result = await getCurrentQuestionnaire(
      {
        portalUserId: "portal-1",
        invitationId: "invite-1",
        portalEmail: "portal-user@example.com",
        templateKey: "general_client_onboarding",
      },
      store as any,
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.data.questionnaire.answers.email, "portal-user@example.com");
      assert.equal(result.data.questionnaire.answers.first_name, "Ivan");
    }
  });
});
