import "server-only";

import { randomUUID } from "node:crypto";
import type { SessionUser } from "@/lib/auth/types";
import { isEmployeeMfaEnabled } from "@/lib/auth/mfa-config";
import { getEmployeeMfaStatus } from "@/lib/auth/mfa-service";
import { isAal2 } from "@/lib/auth/mfa-aal";
import { sbGetUserProfileById } from "@/lib/supabase/user-profiles-repo";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  CONSULTING_AGREEMENT_VERSION,
  buildConsultingAgreementPreview,
  extractConsultingAgreementParty,
  normalizeConsultingAgreementParty,
  type ConsultingAgreementView,
} from "../consulting-agreement-fields";
import type { QuestionnaireAnswers } from "../questionnaire-types";
import type { AppLocale } from "@/i18n/config";
import type { ClientSession } from "../types";
import type {
  ConsultingAgreementSignView,
  FrozenAgreementSnapshot,
  SignActorType,
  SignEventType,
} from "../sign-types";
import { getSignConfig } from "./config";
import { SignError } from "./errors";
import { GENESIS_EVENT_HASH, canonicalize, hashSignEvent, sha256Hex } from "./hashes";
import { generateOtpDigits, hashOtp, isOtpExpired, verifyOtpHash } from "./otp";
import { sendSignOtpEmail } from "./email";
import { createLocalSignStore, newId } from "./local-store";
import { buildFinalAgreementPdf, buildSourceAgreementPdf } from "./pdf";
import {
  CONTRACTS_SIGN_AS_PROVIDER,
  canSignConsultingAgreementAsProvider,
  providerTitleForRole,
} from "./permissions";
import type {
  SignContractRecord,
  SignEventRecord,
  SignRequestRecord,
  SignVersionRecord,
} from "./records";
import {
  clientHasSigned,
  isSignableByClient,
  isSignableByProvider,
} from "./status";
import type { SignStore } from "./store";
import {
  readSignPdfBytes,
  signPdfStoragePath,
  writeSignPdfBytes,
} from "./storage";
import { createSupabaseSignStore } from "./supabase-store";
import { createDisplayAgreementNumber, createSignTransactionId } from "./transaction-id";

export type SignAuditMeta = {
  ipAddress: string | null;
  userAgent: string | null;
};

export type SignDeps = {
  store?: SignStore;
  now?: () => Date;
  randomOtp?: () => string;
  sendMail?: typeof sendSignOtpEmail;
  buildSourcePdf?: typeof buildSourceAgreementPdf;
  buildFinalPdf?: typeof buildFinalAgreementPdf;
  writePdf?: typeof writeSignPdfBytes;
  readPdf?: typeof readSignPdfBytes;
};

function storeOf(deps?: SignDeps): SignStore {
  if (deps?.store) return deps.store;
  const testStore = (globalThis as { __SPIORA_SIGN_STORE?: SignStore })
    .__SPIORA_SIGN_STORE;
  if (testStore) return testStore;
  if (isSupabaseConfigured()) {
    return createSupabaseSignStore(getSupabaseAdmin());
  }
  return createLocalSignStore();
}

function nowIso(deps?: SignDeps): string {
  return (deps?.now ?? (() => new Date()))().toISOString();
}

function isMissingTable(error: unknown): boolean {
  return error instanceof Error && error.message === "SIGN_TABLE_MISSING";
}

async function insertVersionSafe(
  store: SignStore,
  row: SignVersionRecord,
): Promise<SignVersionRecord> {
  try {
    return await store.insertVersion(row);
  } catch (error) {
    if (error instanceof Error && error.message === "VERSION_NUMBER_CONFLICT") {
      throw new SignError("CONTRACT_WRONG_STATUS");
    }
    throw error;
  }
}

async function readStoredPdfOrThrow(
  readPdf: typeof readSignPdfBytes,
  path: string,
): Promise<Buffer> {
  const stored = await readPdf(path);
  if (!stored || stored.length === 0) {
    throw new SignError("DOCUMENT_HASH_MISMATCH", 409);
  }
  return stored;
}

async function writePdfOnce(
  writePdf: typeof writeSignPdfBytes,
  path: string,
  bytes: Buffer,
): Promise<void> {
  try {
    await writePdf(path, bytes);
  } catch (error) {
    if (error instanceof Error && error.message === "SIGN_PDF_EXISTS_HASH_MISMATCH") {
      throw new SignError("DOCUMENT_HASH_MISMATCH", 409);
    }
    throw error;
  }
}

async function safeStore<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (isMissingTable(error)) return fallback;
    throw error;
  }
}

function fingerprintOf(snapshot: FrozenAgreementSnapshot): string {
  return sha256Hex(canonicalize(snapshot));
}

function isReadonlyStatus(status: SignVersionRecord["status"]): boolean {
  return (
    status === "completed" ||
    status === "cancelled" ||
    status === "superseded"
  );
}

function otpCooldownSeconds(sentAt: string, now: Date, windowSec: number): number {
  const elapsed = (now.getTime() - new Date(sentAt).getTime()) / 1000;
  return Math.max(0, Math.ceil(windowSec - elapsed));
}

async function appendEvent(
  store: SignStore,
  input: {
    version: SignVersionRecord;
    eventType: SignEventType;
    actorUserId: string | null;
    actorType: SignActorType;
    documentHash?: string | null;
    metadata?: Record<string, unknown>;
    ipAddress?: string | null;
    userAgent?: string | null;
    occurredAt: string;
  },
): Promise<SignEventRecord> {
  const metadata = input.metadata ?? {};
  let lastError: unknown;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const occurredAt = attempt === 0 ? input.occurredAt : new Date().toISOString();
    const previous = await store.lastEvent(input.version.id);
    const previousEventHash = previous?.eventHash ?? GENESIS_EVENT_HASH;
    const eventHash = hashSignEvent({
      transactionId: input.version.transactionId,
      eventType: input.eventType,
      actorUserId: input.actorUserId,
      actorType: input.actorType,
      documentHash: input.documentHash ?? null,
      occurredAt,
      metadata,
      previousEventHash,
    });
    try {
      return await store.insertEvent({
        id: newId(),
        contractVersionId: input.version.id,
        transactionId: input.version.transactionId,
        eventType: input.eventType,
        actorUserId: input.actorUserId,
        actorType: input.actorType,
        documentHash: input.documentHash ?? null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        metadata,
        occurredAt,
        previousEventHash,
        eventHash,
      });
    } catch (error) {
      lastError = error;
      if (!(error instanceof Error) || error.message !== "EVENT_CHAIN_CONFLICT") {
        throw error;
      }
      await new Promise((resolve) => {
        setTimeout(resolve, 20 * (attempt + 1));
      });
    }
  }
  throw lastError instanceof Error ? lastError : new Error("EVENT_CHAIN_CONFLICT");
}

async function verifySourceHash(
  version: SignVersionRecord,
  deps?: SignDeps,
): Promise<string> {
  if (!version.sourcePdfPath || !version.sourcePdfHash) {
    throw new SignError("DOCUMENT_HASH_MISMATCH", 409);
  }
  const readPdf = deps?.readPdf ?? readSignPdfBytes;
  const bytes = await readPdf(version.sourcePdfPath);
  if (!bytes) throw new SignError("DOCUMENT_HASH_MISMATCH", 409);
  const actual = sha256Hex(bytes);
  if (actual !== version.sourcePdfHash) {
    throw new SignError("DOCUMENT_HASH_MISMATCH", 409);
  }
  return actual;
}

async function toSignView(
  store: SignStore,
  contract: SignContractRecord,
  version: SignVersionRecord,
  opts?: { canProviderSign?: boolean; now?: Date; includeHistory?: boolean },
): Promise<ConsultingAgreementSignView> {
  const requests = await store.listRequests(version.id);
  const clientReq = requests.find((row) => row.signerType === "client");
  const providerReq = requests.find((row) => row.signerType === "provider");
  const config = getSignConfig();
  const now = opts?.now ?? new Date();
  let cooldown = 0;
  if (clientReq) {
    const active = await store.getActiveOtp(clientReq.id);
    if (active) {
      cooldown = otpCooldownSeconds(active.sentAt, now, config.otpResendSeconds);
    }
  }
  return {
    contractId: contract.id,
    versionId: version.id,
    versionNumber: version.versionNumber,
    transactionId: version.transactionId,
    agreementNumber: contract.agreementNumber,
    status: version.status,
    locale: version.locale,
    sourcePdfHash: version.sourcePdfHash,
    finalPdfHash: version.finalPdfHash,
    clientSignerName: clientReq?.signerName || version.snapshot.party.fullName || null,
    clientSignedAt: clientReq?.signedAt ?? null,
    providerAuthority: providerReq?.signerAuthority || null,
    providerSignedAt: providerReq?.signedAt ?? null,
    providerSignerName: providerReq?.signerName || null,
    providerSignerTitle: providerReq?.signerTitle || providerReq?.signerRole || null,
    otpCooldownSeconds: cooldown,
    canClientSign: isSignableByClient(version.status),
    canProviderSign: Boolean(opts?.canProviderSign) && isSignableByProvider(version.status),
    hasSourcePdf: Boolean(version.sourcePdfPath),
    hasFinalPdf: Boolean(version.finalPdfPath),
    history: opts?.includeHistory
      ? (await store.listVersions(contract.id)).map((item) => ({
          versionId: item.id,
          versionNumber: item.versionNumber,
          status: item.status,
          createdAt: item.createdAt,
          hasSourcePdf: Boolean(item.sourcePdfPath),
          hasFinalPdf: Boolean(item.finalPdfPath),
        }))
      : undefined,
  };
}

export function viewWithSign(
  base: ConsultingAgreementView,
  sign: ConsultingAgreementSignView | null,
): ConsultingAgreementView & { sign: ConsultingAgreementSignView | null } {
  if (!sign) return { ...base, sign: null };
  return {
    ...base,
    agreementNumber: sign.agreementNumber || base.agreementNumber,
    clientAccepted: clientHasSigned(sign.status) || base.clientAccepted,
    clientAcceptedAt: sign.clientSignedAt ?? base.clientAcceptedAt,
    employeeAccepted:
      sign.status === "provider_signed" ||
      sign.status === "completed" ||
      base.employeeAccepted,
    employeeAcceptedAt: sign.providerSignedAt ?? base.employeeAcceptedAt,
    sign,
  };
}

async function promoteActiveVersion(
  store: SignStore,
  contractId: string,
  version: SignVersionRecord,
): Promise<void> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const contract = await store.getContractById(contractId);
    if (!contract) return;
    if (contract.activeVersionId === version.id) return;
    if (contract.activeVersionId) {
      const current = await store.getVersionById(contract.activeVersionId);
      if (current && current.versionNumber > version.versionNumber) return;
    }
    const updated = await store.updateContract(
      contractId,
      { activeVersionId: version.id },
      contract.activeVersionId,
    );
    if (updated) return;
  }
}

async function loadActive(
  store: SignStore,
  contract: SignContractRecord,
): Promise<SignVersionRecord | null> {
  if (contract.activeVersionId) {
    const version = await store.getVersionById(contract.activeVersionId);
    if (version) return version;
  }
  const versions = await store.listVersions(contract.id);
  return versions[0] ?? null;
}

function assertClientActiveVersion(
  contract: SignContractRecord,
  version: SignVersionRecord,
): void {
  if (!contract.activeVersionId || contract.activeVersionId !== version.id) {
    throw new SignError("CONTRACT_WRONG_STATUS");
  }
}

async function getProviderSnapshot(
  session: SessionUser,
  locale: AppLocale,
): Promise<{ title: string; authority: string; name: string; email: string }> {
  const fallbackTitle = providerTitleForRole(session.role, locale);
  let title = fallbackTitle;
  if (isSupabaseConfigured()) {
    try {
      const profile = await sbGetUserProfileById(session.id);
      if (profile?.signingTitle?.trim()) {
        title = profile.signingTitle.trim();
      }
    } catch {
      // Keep fallback.
    }
  }
  return {
    title,
    authority: CONTRACTS_SIGN_AS_PROVIDER,
    name: session.name,
    email: session.email,
  };
}

async function supersedeVersion(
  store: SignStore,
  version: SignVersionRecord,
  occurredAt: string,
  meta: {
    actorUserId: string | null;
    actorType: SignActorType;
    ipAddress?: string | null;
    userAgent?: string | null;
    supersededByVersionId?: string;
    supersededByVersionNumber?: number;
  },
): Promise<void> {
  if (version.status === "superseded") return;
  if (version.status === "cancelled") return;
  if (version.status === "completed") return;
  const next = await store.updateVersion(
    version.id,
    { status: "superseded", lockedAt: version.lockedAt ?? occurredAt },
    version.status,
  );
  if (!next) {
    throw new SignError("CONTRACT_WRONG_STATUS");
  }
  const requests = await store.listRequests(version.id);
  for (const request of requests) {
    await store.consumeOtpsForRequest(request.id, occurredAt);
  }
  await appendEvent(store, {
    version: next,
    eventType: "version_superseded",
    actorUserId: meta.actorUserId,
    actorType: meta.actorType,
    occurredAt,
    ipAddress: meta.ipAddress ?? null,
    userAgent: meta.userAgent ?? null,
    metadata: {
      supersededByVersionId: meta.supersededByVersionId ?? null,
      supersededByVersionNumber: meta.supersededByVersionNumber ?? null,
    },
  });
}

export async function getSignForPortalUser(
  portalUserId: string,
  deps?: SignDeps,
): Promise<{
  contract: SignContractRecord;
  version: SignVersionRecord;
} | null> {
  const store = storeOf(deps);
  return safeStore(async () => {
    const contract = await store.getContractByPortalUserId(portalUserId);
    if (!contract) return null;
    const version = await loadActive(store, contract);
    if (!version) return null;
    return { contract, version };
  }, null);
}

export async function getSignViewForCase(
  caseId: string,
  opts?: {
    canProviderSign?: boolean;
    deps?: SignDeps;
    questionnaireId?: string | null;
  },
): Promise<ConsultingAgreementSignView | null> {
  const found = await getSignForCase(caseId, opts?.deps, opts?.questionnaireId);
  if (!found) return null;
  const store = storeOf(opts?.deps);
  return toSignView(store, found.contract, found.version, {
    canProviderSign: opts?.canProviderSign,
    includeHistory: true,
  });
}

export async function getSignForCase(
  caseId: string,
  deps?: SignDeps,
  questionnaireId?: string | null,
): Promise<{
  contract: SignContractRecord;
  version: SignVersionRecord;
} | null> {
  const store = storeOf(deps);
  return safeStore(async () => {
    let contract = await store.getContractByCaseId(caseId);
    if (!contract && questionnaireId) {
      contract = await store.getContractByQuestionnaireId(questionnaireId);
      if (contract && contract.caseId !== caseId) {
        await store.updateContract(contract.id, { caseId });
        contract = { ...contract, caseId };
      }
    }
    if (!contract) return null;
    const version = await loadActive(store, contract);
    if (!version) return null;
    return { contract, version };
  }, null);
}

export async function getSignVersionForCase(
  caseId: string,
  versionId?: string | null,
  deps?: SignDeps,
  questionnaireId?: string | null,
): Promise<{
  contract: SignContractRecord;
  version: SignVersionRecord;
} | null> {
  const found = await getSignForCase(caseId, deps, questionnaireId);
  if (!found) return null;
  if (!versionId || versionId === found.version.id) return found;
  const store = storeOf(deps);
  const version = await store.getVersionById(versionId);
  if (!version || version.contractId !== found.contract.id) return null;
  return { contract: found.contract, version };
}

export async function getSignForQuestionnaire(
  questionnaireId: string,
  deps?: SignDeps,
): Promise<{
  contract: SignContractRecord;
  version: SignVersionRecord;
} | null> {
  const store = storeOf(deps);
  return safeStore(async () => {
    const contract = await store.getContractByQuestionnaireId(questionnaireId);
    if (!contract) return null;
    const version = await loadActive(store, contract);
    if (!version) return null;
    return { contract, version };
  }, null);
}

export async function assertQuestionnaireSigned(
  questionnaireId: string,
  deps?: SignDeps,
): Promise<void> {
  const found = await getSignForQuestionnaire(questionnaireId, deps);
  if (!found || !clientHasSigned(found.version.status)) {
    throw new SignError("AGREEMENT_NOT_SIGNED");
  }
}

export async function attachCaseToSignContract(
  questionnaireId: string,
  caseId: string,
  deps?: SignDeps,
): Promise<void> {
  const store = storeOf(deps);
  await safeStore(async () => {
    const contract = await store.getContractByQuestionnaireId(questionnaireId);
    if (!contract) return null;
    await store.updateContract(contract.id, { caseId });
    return null;
  }, null);
}

export async function publishClientAgreement(input: {
  session: ClientSession;
  questionnaireId: string;
  answers: QuestionnaireAnswers;
  locale: AppLocale;
  meta?: SignAuditMeta;
  deps?: SignDeps;
}): Promise<ConsultingAgreementSignView> {
  const store = storeOf(input.deps);
  const locale = input.locale === "ru" ? "ru" : "en";
  const party = extractConsultingAgreementParty(input.answers, locale, {
    portalEmail: input.session.email,
  });
  const occurredAt = nowIso(input.deps);
  const dateIso = occurredAt.slice(0, 10);
  const snapshot: FrozenAgreementSnapshot = {
    locale,
    templateVersion: CONSULTING_AGREEMENT_VERSION,
    agreementNumber: "",
    agreementDateIso: dateIso,
    party,
  };

  let contract = await store.getContractByQuestionnaireId(input.questionnaireId);
  if (contract && contract.portalUserId !== input.session.id) {
    throw new SignError("CONTRACT_ACCESS_DENIED", 403);
  }
  if (!contract) {
    const id = randomUUID();
    contract = await store.insertContract({
      id,
      questionnaireId: input.questionnaireId,
      caseId: null,
      portalUserId: input.session.id,
      agreementNumber: createDisplayAgreementNumber(
        Number(dateIso.slice(0, 4)),
        id,
      ),
      activeVersionId: null,
      createdAt: occurredAt,
      updatedAt: occurredAt,
    });
  }
  snapshot.agreementNumber = contract.agreementNumber;
  const fingerprint = fingerprintOf(snapshot);

  const current = await loadActive(store, contract);
  if (current && clientHasSigned(current.status)) {
    if (current.contentFingerprint !== fingerprint) {
      throw new SignError("CONTRACT_ALREADY_SIGNED");
    }
    return toSignView(store, contract, current, { now: new Date(occurredAt) });
  }
  if (
    current &&
    current.status === "awaiting_client_signature" &&
    current.contentFingerprint === fingerprint &&
    current.sourcePdfPath
  ) {
    return toSignView(store, contract, current, { now: new Date(occurredAt) });
  }
  if (current && current.status === "awaiting_client_signature") {
    await supersedeVersion(store, current, occurredAt, {
      actorUserId: input.session.id,
      actorType: "client",
      ipAddress: input.meta?.ipAddress ?? null,
      userAgent: input.meta?.userAgent ?? null,
    });
  }

  const versions = await store.listVersions(contract.id);
  const versionNumber = (versions[0]?.versionNumber ?? 0) + 1;
  const versionId = randomUUID();
  const version = await insertVersionSafe(store, {
    id: versionId,
    contractId: contract.id,
    versionNumber,
    transactionId: createSignTransactionId(),
    status: "draft",
    locale,
    snapshot,
    contentFingerprint: fingerprint,
    sourcePdfPath: null,
    sourcePdfHash: null,
    finalPdfPath: null,
    finalPdfHash: null,
    lockedAt: null,
    completedAt: null,
    createdAt: occurredAt,
    updatedAt: occurredAt,
  });

  const buildPdf = input.deps?.buildSourcePdf ?? buildSourceAgreementPdf;
  const writePdf = input.deps?.writePdf ?? writeSignPdfBytes;
  const readPdf = input.deps?.readPdf ?? readSignPdfBytes;
  const pdfPath = signPdfStoragePath(contract.id, version.id, "source");
  const generated = await buildPdf(snapshot);
  await writePdfOnce(writePdf, pdfPath, generated);
  const stored = await readStoredPdfOrThrow(readPdf, pdfPath);
  const sourceHash = sha256Hex(stored);

  const published = await store.updateVersion(version.id, {
    status: "awaiting_client_signature",
    sourcePdfPath: pdfPath,
    sourcePdfHash: sourceHash,
  });
  if (!published) throw new SignError("CONTRACT_WRONG_STATUS");
  await promoteActiveVersion(store, contract.id, published);

  await store.insertRequest({
    id: randomUUID(),
    contractVersionId: version.id,
    signerType: "client",
    signerUserId: input.session.id,
    signerName: party.fullName,
    signerEmail: input.session.email,
    signerRole: "client",
    signerTitle: "Client",
    signerAuthority: "verified_email_otp",
    status: "pending",
    requestedAt: occurredAt,
    signedAt: null,
    signedDocumentHash: null,
    ipAddress: null,
    userAgent: null,
  });
  await store.insertRequest({
    id: randomUUID(),
    contractVersionId: version.id,
    signerType: "provider",
    signerUserId: null,
    signerName: "",
    signerEmail: "",
    signerRole: "",
    signerTitle: "",
    signerAuthority: "",
    status: "pending",
    requestedAt: occurredAt,
    signedAt: null,
    signedDocumentHash: null,
    ipAddress: null,
    userAgent: null,
  });

  await appendEvent(store, {
    version: published,
    eventType: "version_created",
    actorUserId: input.session.id,
    actorType: "client",
    documentHash: sourceHash,
    occurredAt,
    metadata: { version: versionNumber, contractNumber: contract.agreementNumber },
    ipAddress: input.meta?.ipAddress ?? null,
    userAgent: input.meta?.userAgent ?? null,
  });
  await appendEvent(store, {
    version: published,
    eventType: "document_generated",
    actorUserId: input.session.id,
    actorType: "system",
    documentHash: sourceHash,
    occurredAt,
    metadata: { kind: "source" },
  });

  const freshContract = (await store.getContractById(contract.id)) ?? contract;
  return toSignView(store, freshContract, published, { now: new Date(occurredAt) });
}

export async function createReplacementAgreementVersion(input: {
  questionnaireId: string;
  portalUserId: string;
  portalEmail: string;
  answers: QuestionnaireAnswers;
  locale: AppLocale;
  actor: SessionUser;
  meta?: SignAuditMeta;
  deps?: SignDeps;
}): Promise<ConsultingAgreementSignView> {
  const store = storeOf(input.deps);
  const locale = input.locale === "ru" ? "ru" : "en";
  const occurredAt = nowIso(input.deps);
  const dateIso = occurredAt.slice(0, 10);
  const party = extractConsultingAgreementParty(input.answers, locale, {
    portalEmail: input.portalEmail,
  });
  const snapshot: FrozenAgreementSnapshot = {
    locale,
    templateVersion: CONSULTING_AGREEMENT_VERSION,
    agreementNumber: "",
    agreementDateIso: dateIso,
    party,
  };
  const contract = await store.getContractByQuestionnaireId(input.questionnaireId);
  if (!contract || contract.portalUserId !== input.portalUserId) {
    throw new SignError("CONTRACT_NOT_FOUND", 404);
  }
  snapshot.agreementNumber = contract.agreementNumber;
  const versions = await store.listVersions(contract.id);
  const versionNumber = (versions[0]?.versionNumber ?? 0) + 1;
  const current = await loadActive(store, contract);
  const versionId = randomUUID();
  if (current && !isReadonlyStatus(current.status)) {
    await supersedeVersion(store, current, occurredAt, {
      actorUserId: input.actor.id,
      actorType: "provider",
      ipAddress: input.meta?.ipAddress ?? null,
      userAgent: input.meta?.userAgent ?? null,
      supersededByVersionId: versionId,
      supersededByVersionNumber: versionNumber,
    });
  }
  const version = await insertVersionSafe(store, {
    id: versionId,
    contractId: contract.id,
    versionNumber,
    transactionId: createSignTransactionId(),
    status: "draft",
    locale,
    snapshot,
    contentFingerprint: fingerprintOf(snapshot),
    sourcePdfPath: null,
    sourcePdfHash: null,
    finalPdfPath: null,
    finalPdfHash: null,
    lockedAt: null,
    completedAt: null,
    createdAt: occurredAt,
    updatedAt: occurredAt,
  });
  const buildPdf = input.deps?.buildSourcePdf ?? buildSourceAgreementPdf;
  const writePdf = input.deps?.writePdf ?? writeSignPdfBytes;
  const readPdf = input.deps?.readPdf ?? readSignPdfBytes;
  const pdfPath = signPdfStoragePath(contract.id, version.id, "source");
  const generated = await buildPdf(snapshot);
  await writePdfOnce(writePdf, pdfPath, generated);
  const stored = await readStoredPdfOrThrow(readPdf, pdfPath);
  const sourceHash = sha256Hex(stored);
  const published = await store.updateVersion(version.id, {
    status: "awaiting_client_signature",
    sourcePdfPath: pdfPath,
    sourcePdfHash: sourceHash,
  });
  if (!published) throw new SignError("CONTRACT_WRONG_STATUS");
  await promoteActiveVersion(store, contract.id, published);
  await store.insertRequest({
    id: randomUUID(),
    contractVersionId: version.id,
    signerType: "client",
    signerUserId: input.portalUserId,
    signerName: party.fullName,
    signerEmail: input.portalEmail,
    signerRole: "client",
    signerTitle: "Client",
    signerAuthority: "verified_email_otp",
    status: "pending",
    requestedAt: occurredAt,
    signedAt: null,
    signedDocumentHash: null,
    ipAddress: null,
    userAgent: null,
  });
  await store.insertRequest({
    id: randomUUID(),
    contractVersionId: version.id,
    signerType: "provider",
    signerUserId: null,
    signerName: "",
    signerEmail: "",
    signerRole: "",
    signerTitle: "",
    signerAuthority: "",
    status: "pending",
    requestedAt: occurredAt,
    signedAt: null,
    signedDocumentHash: null,
    ipAddress: null,
    userAgent: null,
  });
  await appendEvent(store, {
    version: published,
    eventType: "version_created",
    actorUserId: input.actor.id,
    actorType: "provider",
    documentHash: sourceHash,
    occurredAt,
    ipAddress: input.meta?.ipAddress ?? null,
    userAgent: input.meta?.userAgent ?? null,
    metadata: {
      version: versionNumber,
      contractNumber: contract.agreementNumber,
      replacesVersionId: current?.id ?? null,
      replacesVersionNumber: current?.versionNumber ?? null,
    },
  });
  await appendEvent(store, {
    version: published,
    eventType: "document_generated",
    actorUserId: null,
    actorType: "system",
    documentHash: sourceHash,
    occurredAt,
    metadata: { kind: "source" },
  });
  const freshContract = (await store.getContractById(contract.id)) ?? contract;
  return toSignView(store, freshContract, published, { now: new Date(occurredAt) });
}

export async function cancelAgreementVersion(input: {
  caseId: string;
  actor: SessionUser;
  reason?: string | null;
  meta?: SignAuditMeta;
  deps?: SignDeps;
}): Promise<ConsultingAgreementSignView> {
  const store = storeOf(input.deps);
  const found = await getSignForCase(input.caseId, input.deps);
  if (!found) throw new SignError("CONTRACT_NOT_FOUND", 404);
  if (!canSignConsultingAgreementAsProvider(input.actor)) {
    throw new SignError("PROVIDER_PERMISSION_REQUIRED", 403);
  }
  const current = found.version;
  if (current.status === "completed" || current.status === "provider_signed") {
    throw new SignError("CONTRACT_WRONG_STATUS");
  }
  if (current.status === "cancelled") {
    return toSignView(store, found.contract, current, { canProviderSign: true });
  }
  if (
    current.status !== "awaiting_client_signature" &&
    current.status !== "client_signed" &&
    current.status !== "draft"
  ) {
    throw new SignError("CONTRACT_WRONG_STATUS");
  }
  const occurredAt = nowIso(input.deps);
  const cancelled = await store.updateVersion(
    current.id,
    { status: "cancelled", lockedAt: current.lockedAt ?? occurredAt },
    current.status,
  );
  if (!cancelled) {
    throw new SignError("CONTRACT_WRONG_STATUS");
  }
  const requests = await store.listRequests(current.id);
  for (const request of requests) {
    await store.consumeOtpsForRequest(request.id, occurredAt);
  }
  await appendEvent(store, {
    version: cancelled,
    eventType: "contract_cancelled",
    actorUserId: input.actor.id,
    actorType: "provider",
    occurredAt,
    ipAddress: input.meta?.ipAddress ?? null,
    userAgent: input.meta?.userAgent ?? null,
    metadata: {
      reason:
        typeof input.reason === "string" && input.reason.trim()
          ? input.reason.trim().slice(0, 300)
          : null,
    },
  });
  return toSignView(store, found.contract, cancelled, { canProviderSign: true });
}

export async function requestClientOtp(input: {
  session: ClientSession;
  versionId: string;
  consent: boolean;
  meta?: SignAuditMeta;
  deps?: SignDeps;
}): Promise<{ otpCooldownSeconds: number }> {
  if (!input.consent) throw new SignError("CONSENT_REQUIRED");
  const store = storeOf(input.deps);
  const version = await store.getVersionById(input.versionId);
  if (!version) throw new SignError("CONTRACT_NOT_FOUND", 404);
  const contract = await store.getContractById(version.contractId);
  if (!contract || contract.portalUserId !== input.session.id) {
    throw new SignError("CONTRACT_NOT_FOUND", 404);
  }
  assertClientActiveVersion(contract, version);
  if (version.status === "cancelled") throw new SignError("CONTRACT_CANCELLED");
  if (version.status === "superseded") throw new SignError("CONTRACT_SUPERSEDED");
  if (clientHasSigned(version.status)) throw new SignError("CONTRACT_ALREADY_SIGNED");
  if (!isSignableByClient(version.status)) throw new SignError("CONTRACT_WRONG_STATUS");

  const requests = await store.listRequests(version.id);
  const clientReq = requests.find((row) => row.signerType === "client");
  if (!clientReq) throw new SignError("CONTRACT_WRONG_STATUS");

  const config = getSignConfig();
  const now = input.deps?.now ?? (() => new Date());
  const nowDate = now();
  const active = await store.getActiveOtp(clientReq.id);
  if (active) {
    const wait = otpCooldownSeconds(active.sentAt, nowDate, config.otpResendSeconds);
    if (wait > 0) throw new SignError("OTP_RATE_LIMITED", 429);
  }
  const hourAgo = new Date(nowDate.getTime() - 60 * 60 * 1000).toISOString();
  const recent = (await store.listOtps(clientReq.id)).filter(
    (row) => row.sentAt >= hourAgo,
  );
  if (recent.length >= config.otpHourlyLimit) {
    throw new SignError("OTP_RATE_LIMITED", 429);
  }

  if (active && !active.consumedAt) {
    await store.updateOtp(active.id, { consumedAt: nowDate.toISOString() });
  }

  const code = (input.deps?.randomOtp ?? generateOtpDigits)();
  const codeHash = await hashOtp(code);
  const sentAt = nowDate.toISOString();
  const expiresAt = new Date(
    nowDate.getTime() + config.otpTtlSeconds * 1000,
  ).toISOString();
  const otpId = randomUUID();
  await store.insertOtp({
    id: otpId,
    signatureRequestId: clientReq.id,
    codeHash,
    expiresAt,
    attemptsCount: 0,
    maxAttempts: config.otpMaxAttempts,
    sentAt,
    verifiedAt: null,
    consumedAt: null,
  });

  await appendEvent(store, {
    version,
    eventType: "otp_requested",
    actorUserId: input.session.id,
    actorType: "client",
    occurredAt: sentAt,
    metadata: { channel: "email", contractNumber: contract.agreementNumber },
    ipAddress: input.meta?.ipAddress ?? null,
    userAgent: input.meta?.userAgent ?? null,
  });

  const mailer = input.deps?.sendMail ?? sendSignOtpEmail;
  const mailed = await mailer({
    to: input.session.email,
    locale: version.locale,
    code,
    contractNumber: contract.agreementNumber,
    expiresInMinutes: Math.round(config.otpTtlSeconds / 60),
  });
  if (!mailed.ok) {
    await store.updateOtp(otpId, { consumedAt: nowDate.toISOString() });
    await appendEvent(store, {
      version,
      eventType: "otp_send_failed",
      actorUserId: input.session.id,
      actorType: "system",
      occurredAt: sentAt,
      metadata: { channel: "email" },
    });
    throw new SignError(
      mailed.code === "EMAIL_NOT_CONFIGURED" ? "EMAIL_NOT_CONFIGURED" : "EMAIL_SEND_FAILED",
      mailed.code === "EMAIL_NOT_CONFIGURED" ? 503 : 400,
    );
  }
  await appendEvent(store, {
    version,
    eventType: "otp_sent",
    actorUserId: input.session.id,
    actorType: "system",
    occurredAt: sentAt,
    metadata: { channel: "email" },
  });
  return { otpCooldownSeconds: config.otpResendSeconds };
}

export async function clientSignAgreement(input: {
  session: ClientSession;
  versionId: string;
  otp: string;
  consent: boolean;
  meta?: SignAuditMeta;
  deps?: SignDeps;
}): Promise<ConsultingAgreementSignView> {
  if (!input.consent) throw new SignError("CONSENT_REQUIRED");
  const store = storeOf(input.deps);
  const version = await store.getVersionById(input.versionId);
  if (!version) throw new SignError("CONTRACT_NOT_FOUND", 404);
  const contract = await store.getContractById(version.contractId);
  if (!contract || contract.portalUserId !== input.session.id) {
    throw new SignError("CONTRACT_NOT_FOUND", 404);
  }
  assertClientActiveVersion(contract, version);
  if (version.status === "cancelled") throw new SignError("CONTRACT_CANCELLED");
  if (version.status === "superseded") throw new SignError("CONTRACT_SUPERSEDED");
  if (clientHasSigned(version.status)) {
    return toSignView(store, contract, version);
  }
  if (!isSignableByClient(version.status)) throw new SignError("CONTRACT_WRONG_STATUS");

  const requests = await store.listRequests(version.id);
  const clientReq = requests.find((row) => row.signerType === "client");
  if (!clientReq) throw new SignError("CONTRACT_WRONG_STATUS");

  let sourceHash: string;
  try {
    sourceHash = await verifySourceHash(version, input.deps);
  } catch (error) {
    if (error instanceof SignError && error.code === "DOCUMENT_HASH_MISMATCH") {
      await appendEvent(store, {
        version,
        eventType: "document_hash_mismatch",
        actorUserId: input.session.id,
        actorType: "client",
        occurredAt: nowIso(input.deps),
        metadata: { stage: "client_sign" },
        ipAddress: input.meta?.ipAddress ?? null,
        userAgent: input.meta?.userAgent ?? null,
      });
    }
    throw error;
  }

  const otpRow = await store.getActiveOtp(clientReq.id);
  if (!otpRow) throw new SignError("OTP_NOT_REQUESTED");
  const now = input.deps?.now ?? (() => new Date());
  const nowDate = now();
  if (otpRow.consumedAt) throw new SignError("OTP_INVALID");
  if (otpRow.attemptsCount >= otpRow.maxAttempts) {
    throw new SignError("OTP_TOO_MANY_ATTEMPTS");
  }
  if (isOtpExpired(otpRow.expiresAt, nowDate)) {
    const bumped = await store.updateOtp(
      otpRow.id,
      { attemptsCount: otpRow.attemptsCount + 1 },
      otpRow.attemptsCount,
    );
    if (!bumped) throw new SignError("OTP_INVALID");
    throw new SignError("OTP_EXPIRED");
  }
  const matches = await verifyOtpHash(input.otp, otpRow.codeHash);
  if (!matches) {
    const attempts = otpRow.attemptsCount + 1;
    const bumped = await store.updateOtp(
      otpRow.id,
      { attemptsCount: attempts },
      otpRow.attemptsCount,
    );
    if (!bumped) throw new SignError("OTP_INVALID");
    await appendEvent(store, {
      version,
      eventType: "otp_failed",
      actorUserId: input.session.id,
      actorType: "client",
      occurredAt: nowDate.toISOString(),
      metadata: { reason: "invalid" },
      ipAddress: input.meta?.ipAddress ?? null,
      userAgent: input.meta?.userAgent ?? null,
    });
    if (attempts >= otpRow.maxAttempts) throw new SignError("OTP_TOO_MANY_ATTEMPTS");
    throw new SignError("OTP_INVALID");
  }

  const signedAt = nowDate.toISOString();
  await store.updateOtp(otpRow.id, {
    verifiedAt: signedAt,
    consumedAt: signedAt,
  });
  const cas = await store.updateVersion(
    version.id,
    { status: "client_signed" },
    "awaiting_client_signature",
  );
  if (!cas) {
    const latest = await store.getVersionById(version.id);
    if (latest && clientHasSigned(latest.status)) {
      return toSignView(store, contract, latest);
    }
    throw new SignError("CONTRACT_WRONG_STATUS");
  }
  await store.updateRequest(clientReq.id, {
    status: "signed",
    signedAt,
    signedDocumentHash: sourceHash,
    ipAddress: input.meta?.ipAddress ?? null,
    userAgent: input.meta?.userAgent ?? null,
    signerUserId: input.session.id,
    signerEmail: input.session.email,
  });
  await appendEvent(store, {
    version: cas,
    eventType: "otp_verified",
    actorUserId: input.session.id,
    actorType: "client",
    documentHash: sourceHash,
    occurredAt: signedAt,
    metadata: { channel: "email" },
    ipAddress: input.meta?.ipAddress ?? null,
    userAgent: input.meta?.userAgent ?? null,
  });
  await appendEvent(store, {
    version: cas,
    eventType: "client_signed",
    actorUserId: input.session.id,
    actorType: "client",
    documentHash: sourceHash,
    occurredAt: signedAt,
    metadata: { contractNumber: contract.agreementNumber, version: version.versionNumber },
    ipAddress: input.meta?.ipAddress ?? null,
    userAgent: input.meta?.userAgent ?? null,
  });
  return toSignView(store, contract, cas);
}

async function assertProviderMfa(user: SessionUser): Promise<void> {
  const production = process.env.NODE_ENV === "production";
  if (production && !isEmployeeMfaEnabled()) {
    throw new SignError("PROVIDER_MFA_NOT_CONFIGURED", 503);
  }
  if (!isEmployeeMfaEnabled()) return;
  if (!user.authUserId) throw new SignError("PROVIDER_MFA_REQUIRED", 403);
  const status = await getEmployeeMfaStatus({
    authUserId: user.authUserId,
    mfaReenrollRequired: user.mfaReenrollRequired,
  });
  if (status.verifiedTotpCount < 1 || status.challengeRequired || !isAal2(status.aal)) {
    throw new SignError("PROVIDER_MFA_REQUIRED", 403);
  }
}

export async function providerSignAgreement(input: {
  session: SessionUser;
  versionId: string;
  confirm: boolean;
  meta?: SignAuditMeta;
  deps?: SignDeps;
}): Promise<ConsultingAgreementSignView> {
  if (!input.confirm) throw new SignError("PROVIDER_CONFIRMATION_REQUIRED");
  if (!canSignConsultingAgreementAsProvider(input.session)) {
    throw new SignError("PROVIDER_PERMISSION_REQUIRED", 403);
  }
  if (!input.session.name.trim()) {
    throw new SignError("PROVIDER_PROFILE_INCOMPLETE");
  }
  await assertProviderMfa(input.session);

  const store = storeOf(input.deps);
  const version = await store.getVersionById(input.versionId);
  if (!version) throw new SignError("CONTRACT_NOT_FOUND", 404);
  const contract = await store.getContractById(version.contractId);
  if (!contract) throw new SignError("CONTRACT_NOT_FOUND", 404);
  if (version.status === "cancelled") throw new SignError("CONTRACT_CANCELLED");
  if (version.status === "superseded") throw new SignError("CONTRACT_SUPERSEDED");
  if (version.status === "completed") {
    return toSignView(store, contract, version, { canProviderSign: true });
  }
  if (version.status !== "provider_signed" && !isSignableByProvider(version.status)) {
    throw new SignError("CONTRACT_WRONG_STATUS");
  }

  let sourceHash: string;
  try {
    sourceHash = await verifySourceHash(version, input.deps);
  } catch (error) {
    if (error instanceof SignError && error.code === "DOCUMENT_HASH_MISMATCH") {
      await appendEvent(store, {
        version,
        eventType: "document_hash_mismatch",
        actorUserId: input.session.id,
        actorType: "provider",
        occurredAt: nowIso(input.deps),
        metadata: { stage: "provider_sign" },
        ipAddress: input.meta?.ipAddress ?? null,
        userAgent: input.meta?.userAgent ?? null,
      });
    }
    throw error;
  }

  const requests = await store.listRequests(version.id);
  const providerReq = requests.find((row) => row.signerType === "provider");
  if (!providerReq) throw new SignError("CONTRACT_WRONG_STATUS");
  const signedAt = nowIso(input.deps);
  const provider = await getProviderSnapshot(input.session, version.locale);

  let providerVersion = version;
  if (version.status === "client_signed") {
    const cas = await store.updateVersion(
      version.id,
      { status: "provider_signed" },
      "client_signed",
    );
    if (!cas) {
      const latest = await store.getVersionById(version.id);
      if (latest && (latest.status === "provider_signed" || latest.status === "completed")) {
        providerVersion = latest;
      } else {
        throw new SignError("CONTRACT_WRONG_STATUS");
      }
    } else {
      providerVersion = cas;
      await store.updateRequest(providerReq.id, {
        status: "signed",
        signedAt,
        signedDocumentHash: sourceHash,
        signerUserId: input.session.id,
        signerName: provider.name,
        signerEmail: provider.email,
        signerRole: input.session.role,
        signerTitle: provider.title,
        signerAuthority: provider.authority,
        ipAddress: input.meta?.ipAddress ?? null,
        userAgent: input.meta?.userAgent ?? null,
      });
      await appendEvent(store, {
        version: providerVersion,
        eventType: "provider_signed",
        actorUserId: input.session.id,
        actorType: "provider",
        documentHash: sourceHash,
        occurredAt: signedAt,
        metadata: {
          permission: provider.authority,
          signerRole: input.session.role,
          signerTitle: provider.title,
          contractNumber: contract.agreementNumber,
          version: version.versionNumber,
        },
        ipAddress: input.meta?.ipAddress ?? null,
        userAgent: input.meta?.userAgent ?? null,
      });
    }
  }

  try {
    await finalizeAgreement({
      store,
      contract,
      version: providerVersion,
      providerReq: {
        ...providerReq,
        signerName: provider.name,
        signerEmail: provider.email,
        signerRole: input.session.role,
        signerTitle: provider.title,
        signerAuthority: provider.authority,
        signedAt,
      },
      sourceHash,
      occurredAt: signedAt,
      deps: input.deps,
    });
  } catch (error) {
    if (error instanceof SignError) throw error;
    throw new SignError("FINALIZATION_FAILED", 409);
  }

  const completed = (await store.getVersionById(version.id)) ?? providerVersion;
  return toSignView(store, contract, completed, { canProviderSign: true });
}

async function finalizeAgreement(input: {
  store: SignStore;
  contract: SignContractRecord;
  version: SignVersionRecord;
  providerReq: SignRequestRecord;
  sourceHash: string;
  occurredAt: string;
  deps?: SignDeps;
}) {
  if (input.version.status === "completed") return;
  if (input.version.status !== "provider_signed") {
    throw new SignError("FINALIZATION_FAILED", 409);
  }
  const requests = await input.store.listRequests(input.version.id);
  const clientReq = requests.find((row) => row.signerType === "client");
  if (!clientReq?.signedAt) throw new SignError("FINALIZATION_FAILED", 409);
  if (!clientReq.signedDocumentHash || clientReq.signedDocumentHash !== input.sourceHash) {
    throw new SignError("DOCUMENT_HASH_MISMATCH", 409);
  }
  const providerReq =
    requests.find((row) => row.signerType === "provider" && row.signedAt) ?? input.providerReq;
  if (!providerReq.signedAt) throw new SignError("FINALIZATION_FAILED", 409);
  if (input.version.finalPdfPath && input.version.finalPdfHash) {
    const stored = await (input.deps?.readPdf ?? readSignPdfBytes)(input.version.finalPdfPath);
    if (stored && sha256Hex(stored) === input.version.finalPdfHash) {
      const done = await input.store.updateVersion(
        input.version.id,
        {
          status: "completed",
          lockedAt: input.version.lockedAt ?? input.occurredAt,
          completedAt: input.version.completedAt ?? input.occurredAt,
        },
        "provider_signed",
      );
      if (done) return;
    }
  }

  const buildFinal = input.deps?.buildFinalPdf ?? buildFinalAgreementPdf;
  const writePdf = input.deps?.writePdf ?? writeSignPdfBytes;
  const readPdf = input.deps?.readPdf ?? readSignPdfBytes;
  const finalPath = signPdfStoragePath(
    input.contract.id,
    input.version.id,
    "final",
  );
  const bytes = await buildFinal(input.version.snapshot, {
    agreementNumber: input.contract.agreementNumber,
    versionNumber: input.version.versionNumber,
    transactionId: input.version.transactionId,
    clientName: clientReq.signerName,
    clientSignedAt: clientReq.signedAt,
    providerName: providerReq.signerName,
    providerTitle: providerReq.signerTitle || providerReq.signerRole,
    providerSignedAt: providerReq.signedAt,
    sourcePdfHash: input.sourceHash,
    locale: input.version.locale,
  });
  await writePdfOnce(writePdf, finalPath, bytes);
  const stored = await readStoredPdfOrThrow(readPdf, finalPath);
  const finalHash = sha256Hex(stored);
  const completedAt = input.occurredAt;
  const done = await input.store.updateVersion(
    input.version.id,
    {
      status: "completed",
      finalPdfPath: finalPath,
      finalPdfHash: finalHash,
      lockedAt: completedAt,
      completedAt,
    },
    "provider_signed",
  );
  if (!done) {
    const latest = await input.store.getVersionById(input.version.id);
    if (latest?.status === "completed") return;
    throw new SignError("FINALIZATION_FAILED", 409);
  }
  await appendEvent(input.store, {
    version: done,
    eventType: "final_pdf_generated",
    actorUserId: null,
    actorType: "system",
    documentHash: finalHash,
    occurredAt: completedAt,
    metadata: { kind: "final" },
  });
  await appendEvent(input.store, {
    version: done,
    eventType: "contract_completed",
    actorUserId: null,
    actorType: "system",
    documentHash: finalHash,
    occurredAt: completedAt,
    metadata: { contractNumber: input.contract.agreementNumber },
  });
}

export async function readAuthorizedPdf(input: {
  versionId: string;
  kind: "source" | "final";
  actor:
    | { type: "client"; portalUserId: string }
    | { type: "employee" };
  download?: boolean;
  meta?: SignAuditMeta;
  deps?: SignDeps;
}): Promise<{ bytes: Buffer; fileName: string; hash: string }> {
  const store = storeOf(input.deps);
  const version = await store.getVersionById(input.versionId);
  if (!version) throw new SignError("CONTRACT_NOT_FOUND", 404);
  const contract = await store.getContractById(version.contractId);
  if (!contract) throw new SignError("CONTRACT_NOT_FOUND", 404);
  if (input.actor.type === "client" && contract.portalUserId !== input.actor.portalUserId) {
    throw new SignError("CONTRACT_NOT_FOUND", 404);
  }
  if (input.actor.type === "client") {
    assertClientActiveVersion(contract, version);
  }
  const path = input.kind === "final" ? version.finalPdfPath : version.sourcePdfPath;
  const expected = input.kind === "final" ? version.finalPdfHash : version.sourcePdfHash;
  if (!path || !expected) throw new SignError("CONTRACT_NOT_FOUND", 404);
  const readPdf = input.deps?.readPdf ?? readSignPdfBytes;
  const bytes = await readPdf(path);
  if (!bytes) throw new SignError("CONTRACT_NOT_FOUND", 404);
  const actual = sha256Hex(bytes);
  if (actual !== expected) throw new SignError("DOCUMENT_HASH_MISMATCH", 409);
  try {
    await appendEvent(store, {
      version,
      eventType: input.download ? "pdf_downloaded" : "document_viewed",
      actorUserId:
        input.actor.type === "client" ? input.actor.portalUserId : null,
      actorType: input.actor.type === "client" ? "client" : "provider",
      documentHash: actual,
      occurredAt: nowIso(input.deps),
      metadata: { kind: input.kind },
      ipAddress: input.meta?.ipAddress ?? null,
      userAgent: input.meta?.userAgent ?? null,
    });
  } catch (error) {
    console.error(
      "[spiora-sign] pdf audit event failed",
      error instanceof Error ? error.message : "error",
    );
  }
  const safeNumber = contract.agreementNumber.replace(/[^A-Za-z0-9-]/g, "").slice(0, 32);
  const fileName =
    input.kind === "final"
      ? `SPIORA-Agreement-${safeNumber || "contract"}-signed.pdf`
      : `SPIORA-Agreement-${safeNumber || "contract"}.pdf`;
  return { bytes, fileName, hash: actual };
}

export async function listSignAudit(
  versionId: string,
  deps?: SignDeps,
): Promise<SignEventRecord[]> {
  const store = storeOf(deps);
  return store.listEvents(versionId);
}

export async function buildClientAgreementPayload(input: {
  session: ClientSession;
  answers?: QuestionnaireAnswers;
  submittedAt?: string | null;
  lastSavedAt?: string | null;
  canProviderSign?: boolean;
  deps?: SignDeps;
}): Promise<ConsultingAgreementView & { sign: ConsultingAgreementSignView | null }> {
  const locale = input.session.preferredLocale === "ru" ? "ru" : "en";
  const found = await getSignForPortalUser(input.session.id, input.deps);
  if (found) {
    const store = storeOf(input.deps);
    const sign = await toSignView(store, found.contract, found.version, {
      canProviderSign: input.canProviderSign,
    });
    const preview = buildConsultingAgreementPreview(
      {},
      found.version.locale,
      {
        submittedAt: `${found.version.snapshot.agreementDateIso}T00:00:00.000Z`,
        clientAcceptedAt: sign.clientSignedAt,
        employeeAcceptedAt: sign.providerSignedAt,
      },
    );
    preview.party = normalizeConsultingAgreementParty(
      found.version.snapshot.party,
    );
    return viewWithSign(
      { ...preview, agreementNumber: found.contract.agreementNumber },
      sign,
    );
  }
  const preview = buildConsultingAgreementPreview(input.answers ?? {}, locale, {
    submittedAt: input.submittedAt,
    clientAcceptedAt:
      input.answers?.consulting_agreement_acknowledgement === true
        ? input.lastSavedAt ?? null
        : null,
    portalEmail: input.session.email,
  });
  return { ...preview, sign: null };
}
