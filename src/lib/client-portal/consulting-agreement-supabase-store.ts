import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppLocale } from "@/i18n/config";
import type { ConsultingAgreementParty } from "./consulting-agreement-fields";
import type { ConsultingAgreementRecord } from "./consulting-agreement-local-store";

type Row = {
  id: string;
  questionnaire_id: string;
  case_id: string | null;
  portal_user_id: string;
  locale: string;
  agreement_number: string;
  agreement_date: string;
  party: ConsultingAgreementParty;
  client_accepted_at: string | null;
  employee_accepted_at: string | null;
  employee_user_id: string | null;
  created_at: string;
  updated_at: string;
};

function fromRow(row: Row): ConsultingAgreementRecord {
  return {
    id: row.id,
    questionnaireId: row.questionnaire_id,
    caseId: row.case_id,
    portalUserId: row.portal_user_id,
    locale: row.locale === "ru" ? "ru" : "en",
    agreementNumber: row.agreement_number,
    agreementDateIso: row.agreement_date,
    party: row.party,
    clientAcceptedAt: row.client_accepted_at,
    employeeAcceptedAt: row.employee_accepted_at,
    employeeUserId: row.employee_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createSupabaseConsultingAgreementStore(client: SupabaseClient) {
  return {
    async getByQuestionnaireId(questionnaireId: string) {
      const { data, error } = await client
        .from("client_consulting_agreements")
        .select("*")
        .eq("questionnaire_id", questionnaireId)
        .maybeSingle();
      if (error) throw error;
      return data ? fromRow(data as Row) : null;
    },
    async getByPortalUserId(portalUserId: string) {
      const { data, error } = await client
        .from("client_consulting_agreements")
        .select("*")
        .eq("portal_user_id", portalUserId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data ? fromRow(data as Row) : null;
    },
    async getByCaseId(caseId: string) {
      const { data, error } = await client
        .from("client_consulting_agreements")
        .select("*")
        .eq("case_id", caseId)
        .maybeSingle();
      if (error) throw error;
      return data ? fromRow(data as Row) : null;
    },
    async upsert(input: {
      questionnaireId: string;
      caseId: string | null;
      portalUserId: string;
      locale: AppLocale;
      agreementNumber: string;
      agreementDateIso: string;
      party: ConsultingAgreementParty;
      clientAcceptedAt: string | null;
      employeeAcceptedAt?: string | null;
      employeeUserId?: string | null;
    }) {
      const now = new Date().toISOString();
      const { data, error } = await client
        .from("client_consulting_agreements")
        .upsert(
          {
            questionnaire_id: input.questionnaireId,
            case_id: input.caseId,
            portal_user_id: input.portalUserId,
            locale: input.locale,
            agreement_number: input.agreementNumber,
            agreement_date: input.agreementDateIso,
            party: input.party,
            client_accepted_at: input.clientAcceptedAt,
            employee_accepted_at: input.employeeAcceptedAt ?? null,
            employee_user_id: input.employeeUserId ?? null,
            updated_at: now,
          },
          { onConflict: "questionnaire_id" },
        )
        .select("*")
        .single();
      if (error) throw error;
      return fromRow(data as Row);
    },
    async acceptByEmployee(input: {
      caseId: string;
      employeeUserId: string;
      accepted: boolean;
    }) {
      const now = new Date().toISOString();
      const { data, error } = await client
        .from("client_consulting_agreements")
        .update({
          employee_accepted_at: input.accepted ? now : null,
          employee_user_id: input.accepted ? input.employeeUserId : null,
          updated_at: now,
        })
        .eq("case_id", input.caseId)
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data ? fromRow(data as Row) : null;
    },
  };
}
