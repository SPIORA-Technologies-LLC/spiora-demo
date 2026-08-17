import type { AppLocale } from "@/i18n/config";
import type { ConsultingAgreementParty } from "./consulting-agreement-fields";

export const SIGN_VERSION_STATUSES = [
  "draft",
  "awaiting_client_signature",
  "client_signed",
  "provider_signed",
  "completed",
  "expired",
  "cancelled",
  "superseded",
] as const;

export type SignVersionStatus = (typeof SIGN_VERSION_STATUSES)[number];

export type SignActorType = "client" | "provider" | "system" | "admin";
export type SignSignerType = "client" | "provider";
export type SignRequestStatus = "pending" | "signed" | "cancelled";

export type SignEventType =
  | "version_created"
  | "document_generated"
  | "document_viewed"
  | "consent_checked"
  | "otp_requested"
  | "otp_sent"
  | "otp_send_failed"
  | "otp_failed"
  | "otp_verified"
  | "client_signed"
  | "provider_signed"
  | "final_pdf_generated"
  | "contract_completed"
  | "pdf_downloaded"
  | "version_superseded"
  | "contract_cancelled"
  | "document_hash_mismatch";

export type ConsultingAgreementSignView = {
  contractId: string;
  versionId: string;
  versionNumber: number;
  transactionId: string;
  agreementNumber: string;
  status: SignVersionStatus;
  locale: AppLocale;
  sourcePdfHash: string | null;
  finalPdfHash: string | null;
  clientSignerName: string | null;
  clientSignedAt: string | null;
  providerAuthority: string | null;
  providerSignedAt: string | null;
  providerSignerName: string | null;
  providerSignerTitle: string | null;
  otpCooldownSeconds: number;
  canClientSign: boolean;
  canProviderSign: boolean;
  hasSourcePdf: boolean;
  hasFinalPdf: boolean;
  history?: Array<{
    versionId: string;
    versionNumber: number;
    status: SignVersionStatus;
    createdAt: string;
    hasSourcePdf: boolean;
    hasFinalPdf: boolean;
  }>;
};

export type FrozenAgreementSnapshot = {
  locale: AppLocale;
  templateVersion: string;
  agreementNumber: string;
  agreementDateIso: string;
  party: ConsultingAgreementParty;
};
