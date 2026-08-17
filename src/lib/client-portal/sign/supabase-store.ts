import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppLocale } from "@/i18n/config";
import type {
  SignContractRecord,
  SignEventRecord,
  SignOtpRecord,
  SignRequestRecord,
  SignVersionRecord,
} from "./records";
import type { SignStore } from "./store";
import type { FrozenAgreementSnapshot, SignVersionStatus } from "../sign-types";
import { pickChainTip } from "./event-chain";

function isMissingRelation(error: { code?: string; message?: string }) {
  const code = error.code ?? "";
  const message = (error.message ?? "").toLowerCase();
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    message.includes("could not find the table") ||
    message.includes("does not exist")
  );
}

function contractFrom(row: Record<string, unknown>): SignContractRecord {
  return {
    id: String(row.id),
    questionnaireId: String(row.questionnaire_id),
    caseId: row.case_id ? String(row.case_id) : null,
    portalUserId: String(row.portal_user_id),
    agreementNumber: String(row.agreement_number),
    activeVersionId: row.active_version_id ? String(row.active_version_id) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function versionFrom(row: Record<string, unknown>): SignVersionRecord {
  return {
    id: String(row.id),
    contractId: String(row.contract_id),
    versionNumber: Number(row.version_number),
    transactionId: String(row.transaction_id),
    status: row.status as SignVersionStatus,
    locale: row.locale === "ru" ? "ru" : "en",
    snapshot: row.snapshot as FrozenAgreementSnapshot,
    contentFingerprint: String(row.content_fingerprint),
    sourcePdfPath: row.source_pdf_path ? String(row.source_pdf_path) : null,
    sourcePdfHash: row.source_pdf_hash ? String(row.source_pdf_hash) : null,
    finalPdfPath: row.final_pdf_path ? String(row.final_pdf_path) : null,
    finalPdfHash: row.final_pdf_hash ? String(row.final_pdf_hash) : null,
    lockedAt: row.locked_at ? String(row.locked_at) : null,
    completedAt: row.completed_at ? String(row.completed_at) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function requestFrom(row: Record<string, unknown>): SignRequestRecord {
  return {
    id: String(row.id),
    contractVersionId: String(row.contract_version_id),
    signerType: row.signer_type === "provider" ? "provider" : "client",
    signerUserId: row.signer_user_id ? String(row.signer_user_id) : null,
    signerName: String(row.signer_name ?? ""),
    signerEmail: String(row.signer_email ?? ""),
    signerRole: String(row.signer_role ?? ""),
    signerTitle: String(row.signer_title ?? ""),
    signerAuthority: String(row.signer_authority ?? ""),
    status:
      row.status === "signed"
        ? "signed"
        : row.status === "cancelled"
          ? "cancelled"
          : "pending",
    requestedAt: String(row.requested_at),
    signedAt: row.signed_at ? String(row.signed_at) : null,
    signedDocumentHash: row.signed_document_hash
      ? String(row.signed_document_hash)
      : null,
    ipAddress: row.ip_address ? String(row.ip_address) : null,
    userAgent: row.user_agent ? String(row.user_agent) : null,
  };
}

function otpFrom(row: Record<string, unknown>): SignOtpRecord {
  return {
    id: String(row.id),
    signatureRequestId: String(row.signature_request_id),
    codeHash: String(row.code_hash),
    expiresAt: String(row.expires_at),
    attemptsCount: Number(row.attempts_count ?? 0),
    maxAttempts: Number(row.max_attempts ?? 5),
    sentAt: String(row.sent_at),
    verifiedAt: row.verified_at ? String(row.verified_at) : null,
    consumedAt: row.consumed_at ? String(row.consumed_at) : null,
  };
}

function eventFrom(row: Record<string, unknown>): SignEventRecord {
  return {
    id: String(row.id),
    contractVersionId: String(row.contract_version_id),
    transactionId: String(row.transaction_id),
    eventType: row.event_type as SignEventRecord["eventType"],
    actorUserId: row.actor_user_id ? String(row.actor_user_id) : null,
    actorType: row.actor_type as SignEventRecord["actorType"],
    documentHash: row.document_hash ? String(row.document_hash) : null,
    ipAddress: row.ip_address ? String(row.ip_address) : null,
    userAgent: row.user_agent ? String(row.user_agent) : null,
    metadata: (row.metadata_json as Record<string, unknown>) ?? {},
    occurredAt: String(row.occurred_at),
    previousEventHash: String(row.previous_event_hash),
    eventHash: String(row.event_hash),
  };
}

function throwUnlessMissing(error: { code?: string; message?: string } | null) {
  if (!error) return;
  if (isMissingRelation(error)) {
    const missing = new Error("SIGN_TABLE_MISSING");
    missing.name = "SignTableMissing";
    throw missing;
  }
  throw error;
}

export function createSupabaseSignStore(client: SupabaseClient): SignStore {
  return {
    async getContractById(id) {
      const { data, error } = await client
        .from("consulting_sign_contracts")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      throwUnlessMissing(error);
      return data ? contractFrom(data as Record<string, unknown>) : null;
    },
    async getContractByQuestionnaireId(id) {
      const { data, error } = await client
        .from("consulting_sign_contracts")
        .select("*")
        .eq("questionnaire_id", id)
        .maybeSingle();
      throwUnlessMissing(error);
      return data ? contractFrom(data as Record<string, unknown>) : null;
    },
    async getContractByPortalUserId(id) {
      const { data, error } = await client
        .from("consulting_sign_contracts")
        .select("*")
        .eq("portal_user_id", id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      throwUnlessMissing(error);
      return data ? contractFrom(data as Record<string, unknown>) : null;
    },
    async getContractByCaseId(id) {
      const { data, error } = await client
        .from("consulting_sign_contracts")
        .select("*")
        .eq("case_id", id)
        .maybeSingle();
      throwUnlessMissing(error);
      return data ? contractFrom(data as Record<string, unknown>) : null;
    },
    async insertContract(row) {
      const { data, error } = await client
        .from("consulting_sign_contracts")
        .insert({
          id: row.id,
          questionnaire_id: row.questionnaireId,
          case_id: row.caseId,
          portal_user_id: row.portalUserId,
          agreement_number: row.agreementNumber,
          active_version_id: row.activeVersionId,
          created_at: row.createdAt,
          updated_at: row.updatedAt,
        })
        .select("*")
        .single();
      if (error) throw error;
      return contractFrom(data as Record<string, unknown>);
    },
    async updateContract(id, patch, expectedActiveVersionId) {
      const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (patch.caseId !== undefined) payload.case_id = patch.caseId;
      if (patch.activeVersionId !== undefined) {
        payload.active_version_id = patch.activeVersionId;
      }
      if (patch.agreementNumber !== undefined) {
        payload.agreement_number = patch.agreementNumber;
      }
      let query = client.from("consulting_sign_contracts").update(payload).eq("id", id);
      if (expectedActiveVersionId === null) {
        query = query.is("active_version_id", null);
      } else if (expectedActiveVersionId !== undefined) {
        query = query.eq("active_version_id", expectedActiveVersionId);
      }
      const { data, error } = await query.select("*").maybeSingle();
      if (error) throw error;
      return data ? contractFrom(data as Record<string, unknown>) : null;
    },
    async getVersionById(id) {
      const { data, error } = await client
        .from("consulting_sign_versions")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      throwUnlessMissing(error);
      return data ? versionFrom(data as Record<string, unknown>) : null;
    },
    async listVersions(contractId) {
      const { data, error } = await client
        .from("consulting_sign_versions")
        .select("*")
        .eq("contract_id", contractId)
        .order("version_number", { ascending: false });
      throwUnlessMissing(error);
      return (data ?? []).map((row) => versionFrom(row as Record<string, unknown>));
    },
    async insertVersion(row) {
      const { data, error } = await client
        .from("consulting_sign_versions")
        .insert({
          id: row.id,
          contract_id: row.contractId,
          version_number: row.versionNumber,
          transaction_id: row.transactionId,
          status: row.status,
          locale: row.locale,
          snapshot: row.snapshot,
          content_fingerprint: row.contentFingerprint,
          source_pdf_path: row.sourcePdfPath,
          source_pdf_hash: row.sourcePdfHash,
          final_pdf_path: row.finalPdfPath,
          final_pdf_hash: row.finalPdfHash,
          locked_at: row.lockedAt,
          completed_at: row.completedAt,
          created_at: row.createdAt,
          updated_at: row.updatedAt,
        })
        .select("*")
        .single();
      if (error) {
        const code = (error as { code?: string }).code ?? "";
        if (code === "23505") throw new Error("VERSION_NUMBER_CONFLICT");
        throw error;
      }
      return versionFrom(data as Record<string, unknown>);
    },
    async updateVersion(id, patch, expectedStatus) {
      const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (patch.status !== undefined) payload.status = patch.status;
      if (patch.sourcePdfPath !== undefined) payload.source_pdf_path = patch.sourcePdfPath;
      if (patch.sourcePdfHash !== undefined) payload.source_pdf_hash = patch.sourcePdfHash;
      if (patch.finalPdfPath !== undefined) payload.final_pdf_path = patch.finalPdfPath;
      if (patch.finalPdfHash !== undefined) payload.final_pdf_hash = patch.finalPdfHash;
      if (patch.lockedAt !== undefined) payload.locked_at = patch.lockedAt;
      if (patch.completedAt !== undefined) payload.completed_at = patch.completedAt;
      let query = client.from("consulting_sign_versions").update(payload).eq("id", id);
      if (expectedStatus) query = query.eq("status", expectedStatus);
      const { data, error } = await query.select("*").maybeSingle();
      if (error) throw error;
      return data ? versionFrom(data as Record<string, unknown>) : null;
    },
    async insertRequest(row) {
      const { data, error } = await client
        .from("consulting_sign_requests")
        .insert({
          id: row.id,
          contract_version_id: row.contractVersionId,
          signer_type: row.signerType,
          signer_user_id: row.signerUserId,
          signer_name: row.signerName,
          signer_email: row.signerEmail,
          signer_role: row.signerRole,
          signer_title: row.signerTitle,
          signer_authority: row.signerAuthority,
          status: row.status,
          requested_at: row.requestedAt,
          signed_at: row.signedAt,
          signed_document_hash: row.signedDocumentHash,
          ip_address: row.ipAddress,
          user_agent: row.userAgent,
        })
        .select("*")
        .single();
      if (error) throw error;
      return requestFrom(data as Record<string, unknown>);
    },
    async listRequests(versionId) {
      const { data, error } = await client
        .from("consulting_sign_requests")
        .select("*")
        .eq("contract_version_id", versionId);
      throwUnlessMissing(error);
      return (data ?? []).map((row) => requestFrom(row as Record<string, unknown>));
    },
    async updateRequest(id, patch) {
      const payload: Record<string, unknown> = {};
      if (patch.signerUserId !== undefined) payload.signer_user_id = patch.signerUserId;
      if (patch.signerName !== undefined) payload.signer_name = patch.signerName;
      if (patch.signerEmail !== undefined) payload.signer_email = patch.signerEmail;
      if (patch.signerRole !== undefined) payload.signer_role = patch.signerRole;
      if (patch.signerTitle !== undefined) payload.signer_title = patch.signerTitle;
      if (patch.signerAuthority !== undefined) {
        payload.signer_authority = patch.signerAuthority;
      }
      if (patch.status !== undefined) payload.status = patch.status;
      if (patch.signedAt !== undefined) payload.signed_at = patch.signedAt;
      if (patch.signedDocumentHash !== undefined) {
        payload.signed_document_hash = patch.signedDocumentHash;
      }
      if (patch.ipAddress !== undefined) payload.ip_address = patch.ipAddress;
      if (patch.userAgent !== undefined) payload.user_agent = patch.userAgent;
      const { data, error } = await client
        .from("consulting_sign_requests")
        .update(payload)
        .eq("id", id)
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data ? requestFrom(data as Record<string, unknown>) : null;
    },
    async getActiveOtp(requestId) {
      const { data, error } = await client
        .from("consulting_sign_otps")
        .select("*")
        .eq("signature_request_id", requestId)
        .is("consumed_at", null)
        .order("sent_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      throwUnlessMissing(error);
      return data ? otpFrom(data as Record<string, unknown>) : null;
    },
    async listOtps(requestId) {
      const { data, error } = await client
        .from("consulting_sign_otps")
        .select("*")
        .eq("signature_request_id", requestId)
        .order("sent_at", { ascending: false });
      throwUnlessMissing(error);
      return (data ?? []).map((row) => otpFrom(row as Record<string, unknown>));
    },
    async insertOtp(row) {
      const { data, error } = await client
        .from("consulting_sign_otps")
        .insert({
          id: row.id,
          signature_request_id: row.signatureRequestId,
          code_hash: row.codeHash,
          expires_at: row.expiresAt,
          attempts_count: row.attemptsCount,
          max_attempts: row.maxAttempts,
          sent_at: row.sentAt,
          verified_at: row.verifiedAt,
          consumed_at: row.consumedAt,
        })
        .select("*")
        .single();
      if (error) throw error;
      return otpFrom(data as Record<string, unknown>);
    },
    async updateOtp(id, patch, expectedAttemptsCount) {
      const payload: Record<string, unknown> = {};
      if (patch.attemptsCount !== undefined) payload.attempts_count = patch.attemptsCount;
      if (patch.verifiedAt !== undefined) payload.verified_at = patch.verifiedAt;
      if (patch.consumedAt !== undefined) payload.consumed_at = patch.consumedAt;
      let query = client.from("consulting_sign_otps").update(payload).eq("id", id);
      if (expectedAttemptsCount !== undefined) {
        query = query.eq("attempts_count", expectedAttemptsCount);
      }
      const { data, error } = await query.select("*").maybeSingle();
      if (error) throw error;
      return data ? otpFrom(data as Record<string, unknown>) : null;
    },
    async consumeOtpsForRequest(requestId, consumedAt) {
      const { error } = await client
        .from("consulting_sign_otps")
        .update({ consumed_at: consumedAt })
        .eq("signature_request_id", requestId)
        .is("consumed_at", null);
      if (error) throw error;
    },
    async insertEvent(row) {
      const { data, error } = await client
        .from("consulting_sign_events")
        .insert({
          id: row.id,
          contract_version_id: row.contractVersionId,
          transaction_id: row.transactionId,
          event_type: row.eventType,
          actor_user_id: row.actorUserId,
          actor_type: row.actorType,
          document_hash: row.documentHash,
          ip_address: row.ipAddress,
          user_agent: row.userAgent,
          metadata_json: row.metadata,
          occurred_at: row.occurredAt,
          previous_event_hash: row.previousEventHash,
          event_hash: row.eventHash,
        })
        .select("*")
        .single();
      if (error) {
        const code = (error as { code?: string }).code ?? "";
        if (code === "23505") throw new Error("EVENT_CHAIN_CONFLICT");
        throw error;
      }
      return eventFrom(data as Record<string, unknown>);
    },
    async listEvents(versionId) {
      const { data, error } = await client
        .from("consulting_sign_events")
        .select("*")
        .eq("contract_version_id", versionId)
        .order("occurred_at", { ascending: true });
      throwUnlessMissing(error);
      return (data ?? []).map((row) => eventFrom(row as Record<string, unknown>));
    },
    async lastEvent(versionId) {
      const { data, error } = await client
        .from("consulting_sign_events")
        .select("*")
        .eq("contract_version_id", versionId)
        .order("occurred_at", { ascending: true });
      throwUnlessMissing(error);
      return pickChainTip(
        (data ?? []).map((row) => eventFrom(row as Record<string, unknown>)),
      );
    },
  };
}

export type { AppLocale };
