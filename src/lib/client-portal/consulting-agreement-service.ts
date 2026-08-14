import "server-only";

import type { AppLocale } from "@/i18n/config";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  buildConsultingAgreementPreview,
  CONSULTING_AGREEMENT_QUESTION_ID,
  type ConsultingAgreementView,
} from "./consulting-agreement-fields";
import {
  localGetAgreementByCaseId,
  localGetAgreementByPortalUserId,
  localGetAgreementByQuestionnaireId,
  localUpsertAgreement,
  type ConsultingAgreementRecord,
} from "./consulting-agreement-local-store";
import { createSupabaseConsultingAgreementStore } from "./consulting-agreement-supabase-store";
import type { QuestionnaireAnswers } from "./questionnaire-types";

function useSupabase() {
  return isSupabaseConfigured();
}

function store() {
  return createSupabaseConsultingAgreementStore(getSupabaseAdmin());
}

function recordToView(
  record: ConsultingAgreementRecord,
  answers?: QuestionnaireAnswers,
): ConsultingAgreementView {
  const preview = buildConsultingAgreementPreview(answers ?? {}, record.locale, {
    submittedAt: `${record.agreementDateIso}T00:00:00.000Z`,
    clientAcceptedAt: record.clientAcceptedAt,
    employeeAcceptedAt: record.employeeAcceptedAt,
  });
  return {
    ...preview,
    agreementNumber: record.agreementNumber,
    agreementDateIso: record.agreementDateIso,
    party: record.party,
    clientAccepted: Boolean(record.clientAcceptedAt),
    employeeAccepted: Boolean(record.employeeAcceptedAt),
    submitted: true,
  };
}

export async function getAgreementByPortalUser(
  portalUserId: string,
): Promise<ConsultingAgreementRecord | null> {
  if (useSupabase()) return store().getByPortalUserId(portalUserId);
  return localGetAgreementByPortalUserId(portalUserId);
}

export async function getAgreementByCaseId(
  caseId: string,
): Promise<ConsultingAgreementRecord | null> {
  if (useSupabase()) return store().getByCaseId(caseId);
  return localGetAgreementByCaseId(caseId);
}

export async function getAgreementByQuestionnaireId(
  questionnaireId: string,
): Promise<ConsultingAgreementRecord | null> {
  if (useSupabase()) return store().getByQuestionnaireId(questionnaireId);
  return localGetAgreementByQuestionnaireId(questionnaireId);
}

export function viewFromRecord(
  record: ConsultingAgreementRecord,
): ConsultingAgreementView {
  return recordToView(record);
}

export async function saveAgreementFromSubmission(input: {
  questionnaireId: string;
  caseId: string;
  portalUserId: string;
  locale: AppLocale;
  answers: QuestionnaireAnswers;
  submittedAt: string;
}): Promise<ConsultingAgreementRecord> {
  const preview = buildConsultingAgreementPreview(input.answers, input.locale, {
    submittedAt: input.submittedAt,
    clientAcceptedAt:
      input.answers[CONSULTING_AGREEMENT_QUESTION_ID] === true
        ? input.submittedAt
        : null,
  });
  const payload = {
    questionnaireId: input.questionnaireId,
    caseId: input.caseId,
    portalUserId: input.portalUserId,
    locale: input.locale,
    agreementNumber: preview.agreementNumber,
    agreementDateIso: preview.agreementDateIso,
    party: preview.party,
    clientAcceptedAt: preview.clientAcceptedAt,
    employeeAcceptedAt: null as string | null,
    employeeUserId: null as string | null,
  };
  if (useSupabase()) {
    const existing = await store().getByQuestionnaireId(input.questionnaireId);
    return store().upsert({
      ...payload,
      employeeAcceptedAt: existing?.employeeAcceptedAt ?? null,
      employeeUserId: existing?.employeeUserId ?? null,
    });
  }
  return localUpsertAgreement(payload);
}

export async function acceptAgreementByEmployee(input: {
  caseId: string;
  employeeUserId: string;
  accepted: boolean;
}): Promise<ConsultingAgreementRecord | null> {
  if (useSupabase()) {
    return store().acceptByEmployee(input);
  }
  const existing = await localGetAgreementByCaseId(input.caseId);
  if (!existing) return null;
  const now = new Date().toISOString();
  return localUpsertAgreement({
    ...existing,
    employeeAcceptedAt: input.accepted ? now : null,
    employeeUserId: input.accepted ? input.employeeUserId : null,
  });
}
