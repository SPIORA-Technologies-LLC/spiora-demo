import type { AppLocale } from "@/i18n/config";
import type { ConsultingAgreementParty } from "../consulting-agreement-fields";
import type {
  FrozenAgreementSnapshot,
  SignActorType,
  SignEventType,
  SignRequestStatus,
  SignSignerType,
  SignVersionStatus,
} from "../sign-types";

export type SignContractRecord = {
  id: string;
  questionnaireId: string;
  caseId: string | null;
  portalUserId: string;
  agreementNumber: string;
  activeVersionId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SignVersionRecord = {
  id: string;
  contractId: string;
  versionNumber: number;
  transactionId: string;
  status: SignVersionStatus;
  locale: AppLocale;
  snapshot: FrozenAgreementSnapshot;
  contentFingerprint: string;
  sourcePdfPath: string | null;
  sourcePdfHash: string | null;
  finalPdfPath: string | null;
  finalPdfHash: string | null;
  lockedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SignRequestRecord = {
  id: string;
  contractVersionId: string;
  signerType: SignSignerType;
  signerUserId: string | null;
  signerName: string;
  signerEmail: string;
  signerRole: string;
  signerTitle: string;
  signerAuthority: string;
  status: SignRequestStatus;
  requestedAt: string;
  signedAt: string | null;
  signedDocumentHash: string | null;
  ipAddress: string | null;
  userAgent: string | null;
};

export type SignOtpRecord = {
  id: string;
  signatureRequestId: string;
  codeHash: string;
  expiresAt: string;
  attemptsCount: number;
  maxAttempts: number;
  sentAt: string;
  verifiedAt: string | null;
  consumedAt: string | null;
};

export type SignEventRecord = {
  id: string;
  contractVersionId: string;
  transactionId: string;
  eventType: SignEventType;
  actorUserId: string | null;
  actorType: SignActorType;
  documentHash: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown>;
  occurredAt: string;
  previousEventHash: string;
  eventHash: string;
};

export type SignPartySnapshot = ConsultingAgreementParty;
