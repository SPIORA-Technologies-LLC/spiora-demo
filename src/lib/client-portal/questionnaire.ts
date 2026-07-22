import "server-only";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { sbGetInvitationById } from "@/lib/supabase/client-invitations-repo";
import { createSupabaseQuestionnaireStore } from "./questionnaire-supabase-store";
import { createLocalQuestionnaireStore } from "./questionnaire-local-store";
import { GENERAL_CLIENT_ONBOARDING_TEMPLATE_KEY } from "./questionnaire-demo-template";
import { localFindInvitationById } from "./local-store";
import type { ClientQuestionnaireContext } from "./questionnaire-service";
import {
  getCurrentQuestionnaire,
  moveQuestionnaireToReview,
  reopenQuestionnaireDraft,
  saveQuestionnaireDraft,
  validateQuestionnaireDraft,
} from "./questionnaire-service";
import { submitQuestionnaireAndCreateCase } from "./case-service";

async function getStore() {
  if (isSupabaseConfigured()) {
    return createSupabaseQuestionnaireStore(getSupabaseAdmin());
  }
  return createLocalQuestionnaireStore();
}

async function resolveInvitationTemplateKey(
  invitationId: string,
): Promise<string | null> {
  const invitation = isSupabaseConfigured()
    ? await sbGetInvitationById(invitationId)
    : await localFindInvitationById(invitationId);
  if (!invitation) return null;
  return invitation.questionnaireTemplateKey ?? GENERAL_CLIENT_ONBOARDING_TEMPLATE_KEY;
}

export async function getClientQuestionnaire(ctx: ClientQuestionnaireContext) {
  return getCurrentQuestionnaire(
    { ...ctx, templateKey: await resolveInvitationTemplateKey(ctx.invitationId) },
    await getStore(),
  );
}

export async function saveClientQuestionnaireDraft(
  ctx: ClientQuestionnaireContext,
  input: {
    baseRevision: number | null;
    operations: Array<
      | { op: "set"; questionId: string; value: unknown }
      | { op: "clear"; questionId: string }
    >;
    locale: "en" | "ru";
  },
) {
  return saveQuestionnaireDraft(
    { ...ctx, templateKey: await resolveInvitationTemplateKey(ctx.invitationId) },
    await getStore(),
    input,
  );
}

export async function validateClientQuestionnaire(
  ctx: ClientQuestionnaireContext,
  locale: "en" | "ru",
) {
  return validateQuestionnaireDraft(
    { ...ctx, templateKey: await resolveInvitationTemplateKey(ctx.invitationId) },
    await getStore(),
    locale,
  );
}

export async function moveClientQuestionnaireToReview(
  ctx: ClientQuestionnaireContext,
  locale: "en" | "ru",
) {
  return moveQuestionnaireToReview(
    { ...ctx, templateKey: await resolveInvitationTemplateKey(ctx.invitationId) },
    await getStore(),
    locale,
  );
}

export async function reopenClientQuestionnaireDraft(
  ctx: ClientQuestionnaireContext,
) {
  return reopenQuestionnaireDraft(
    { ...ctx, templateKey: await resolveInvitationTemplateKey(ctx.invitationId) },
    await getStore(),
  );
}

export async function submitClientQuestionnaire(
  ctx: ClientQuestionnaireContext,
  locale: "en" | "ru",
) {
  const invitation = isSupabaseConfigured()
    ? await sbGetInvitationById(ctx.invitationId)
    : await localFindInvitationById(ctx.invitationId);
  const assignedTo = invitation?.assignedTo ?? null;

  return submitQuestionnaireAndCreateCase(
    { ...ctx, templateKey: await resolveInvitationTemplateKey(ctx.invitationId) },
    locale,
    assignedTo,
  );
}
