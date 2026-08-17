import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { pickChainTip } from "./event-chain.ts";
import { createMemorySignStore } from "./local-store.ts";
import {
  cancelAgreementVersion,
  clientSignAgreement,
  createReplacementAgreementVersion,
  publishClientAgreement,
  providerSignAgreement,
  readAuthorizedPdf,
  requestClientOtp,
  getSignViewForCase,
  type SignDeps,
} from "./service.ts";
import type { ClientSession } from "../types.ts";
import type { SessionUser } from "@/lib/auth/types";

const session: ClientSession = {
  id: "portal-1",
  authUserId: "auth-client-1",
  email: "client@example.com",
  firstName: "Ivan",
  preferredLocale: "en",
  invitationId: "inv-1",
  mfaReenrollRequired: false,
};

const owner: SessionUser = {
  id: "owner-1",
  email: "owner@example.com",
  name: "Olivia Owner",
  role: "owner",
  authUserId: "auth-owner-1",
};

const answers = {
  first_name: "Ivan",
  last_name: "Ivanov",
  patronymic: "Ivanovich",
  passport_number: "AB123456",
  passport_issue_date: "2020-01-15",
  address: "Zagreb, Ilica 1",
  city: "Zagreb",
  consulting_agreement_acknowledgement: true,
};

function deps(store = createMemorySignStore(), now = new Date("2026-08-17T10:00:00.000Z")) {
  const sent: string[] = [];
  const signDeps: SignDeps = {
    store,
    now: () => now,
    randomOtp: () => "583214",
    sendMail: async ({ code }: { code: string }) => {
      sent.push(code);
      return { ok: true as const, id: "mail-1" };
    },
    buildSourcePdf: async () => Buffer.from("source-pdf-bytes"),
    buildFinalPdf: async () => Buffer.from("final-pdf-bytes"),
    writePdf: async (_path: string, data: Buffer) => {
      storePdf.set(_path, data);
    },
    readPdf: async (path: string) => storePdf.get(path) ?? null,
  };
  return {
    store,
    deps: signDeps,
    sent,
  };
}

const storePdf = new Map<string, Buffer>();
const originalNodeEnv = process.env.NODE_ENV;
const originalMfaFlag = process.env.SPIORA_MFA_EMPLOYEE;

afterEach(() => {
  storePdf.clear();
  delete (globalThis as { __SPIORA_SIGN_STORE?: unknown }).__SPIORA_SIGN_STORE;
  process.env.NODE_ENV = originalNodeEnv;
  if (originalMfaFlag === undefined) delete process.env.SPIORA_MFA_EMPLOYEE;
  else process.env.SPIORA_MFA_EMPLOYEE = originalMfaFlag;
});

describe("SPIORA Sign event chain", () => {
  it("picks the true tip when timestamps match and ids sort the other way", () => {
    const first = {
      id: "z-later-uuid",
      eventHash: "hash-1",
      previousEventHash: "0".repeat(64),
      occurredAt: "2026-08-17T10:00:00.000Z",
    };
    const second = {
      id: "a-earlier-uuid",
      eventHash: "hash-2",
      previousEventHash: "hash-1",
      occurredAt: "2026-08-17T10:00:00.000Z",
    };
    assert.equal(pickChainTip([first, second])?.eventHash, "hash-2");
  });
});

describe("SPIORA Sign service", () => {
  it("publishes immutable source hash and completes client OTP sign", async () => {
    const setup = deps();
    const sign = await publishClientAgreement({
      session,
      questionnaireId: "q-1",
      answers,
      locale: "en",
      deps: setup.deps,
    });
    assert.equal(sign.status, "awaiting_client_signature");
    assert.ok(sign.sourcePdfHash);

    await requestClientOtp({
      session,
      versionId: sign.versionId,
      consent: true,
      deps: setup.deps,
    });
    assert.deepEqual(setup.sent, ["583214"]);

    const signed = await clientSignAgreement({
      session,
      versionId: sign.versionId,
      otp: "583214",
      consent: true,
      meta: { ipAddress: "127.0.0.1", userAgent: "test" },
      deps: setup.deps,
    });
    assert.equal(signed.status, "client_signed");
    assert.ok(signed.clientSignedAt);
  });

  it("rejects invalid OTP and double client sign is idempotent", async () => {
    const setup = deps();
    const sign = await publishClientAgreement({
      session,
      questionnaireId: "q-2",
      answers,
      locale: "en",
      deps: setup.deps,
    });
    await requestClientOtp({
      session,
      versionId: sign.versionId,
      consent: true,
      deps: setup.deps,
    });

    await assert.rejects(
      () =>
        clientSignAgreement({
          session,
          versionId: sign.versionId,
          otp: "000000",
          consent: true,
          deps: setup.deps,
        }),
      (error: unknown) =>
        error instanceof Error && error.message === "OTP_INVALID",
    );

    const first = await clientSignAgreement({
      session,
      versionId: sign.versionId,
      otp: "583214",
      consent: true,
      deps: setup.deps,
    });
    const second = await clientSignAgreement({
      session,
      versionId: sign.versionId,
      otp: "583214",
      consent: true,
      deps: setup.deps,
    });
    assert.equal(first.status, "client_signed");
    assert.equal(second.status, "client_signed");
  });

  it("provider sign finalizes completed version with final hash", async () => {
    const setup = deps();
    const sign = await publishClientAgreement({
      session,
      questionnaireId: "q-3",
      answers,
      locale: "en",
      deps: setup.deps,
    });
    await requestClientOtp({
      session,
      versionId: sign.versionId,
      consent: true,
      deps: setup.deps,
    });
    await clientSignAgreement({
      session,
      versionId: sign.versionId,
      otp: "583214",
      consent: true,
      deps: setup.deps,
    });

    const done = await providerSignAgreement({
      session: owner,
      versionId: sign.versionId,
      confirm: true,
      deps: setup.deps,
    });
    assert.equal(done.status, "completed");
    assert.ok(done.finalPdfHash);
    assert.ok(done.providerSignedAt);
  });

  it("rejects provider sign when stored source bytes change", async () => {
    const setup = deps();
    const sign = await publishClientAgreement({
      session,
      questionnaireId: "q-4",
      answers,
      locale: "en",
      deps: setup.deps,
    });
    await requestClientOtp({
      session,
      versionId: sign.versionId,
      consent: true,
      deps: setup.deps,
    });
    await clientSignAgreement({
      session,
      versionId: sign.versionId,
      otp: "583214",
      consent: true,
      deps: setup.deps,
    });
    const sourcePath = [...storePdf.keys()].find((key) => key.includes(sign.versionId))!;
    storePdf.set(sourcePath, Buffer.from("tampered-source"));
    await assert.rejects(
      () =>
        providerSignAgreement({
          session: owner,
          versionId: sign.versionId,
          confirm: true,
          deps: setup.deps,
        }),
      (error: unknown) =>
        error instanceof Error && error.message === "DOCUMENT_HASH_MISMATCH",
    );
  });

  it("supersedes old version, invalidates old OTP, and blocks stale PDF access", async () => {
    const setup = deps();
    const sign1 = await publishClientAgreement({
      session,
      questionnaireId: "q-5",
      answers,
      locale: "en",
      deps: setup.deps,
    });
    await requestClientOtp({
      session,
      versionId: sign1.versionId,
      consent: true,
      deps: setup.deps,
    });
    const sign2 = await createReplacementAgreementVersion({
      questionnaireId: "q-5",
      portalUserId: session.id,
      portalEmail: session.email,
      answers: { ...answers, address: "New street 2" },
      locale: "en",
      actor: owner,
      deps: setup.deps,
    });
    assert.equal(sign2.status, "awaiting_client_signature");
    await assert.rejects(
      () =>
        clientSignAgreement({
          session,
          versionId: sign1.versionId,
          otp: "583214",
          consent: true,
          deps: setup.deps,
        }),
      (error: unknown) =>
        error instanceof Error && error.message === "CONTRACT_WRONG_STATUS",
    );
    await assert.rejects(
      () =>
        readAuthorizedPdf({
          versionId: sign1.versionId,
          kind: "source",
          actor: { type: "client", portalUserId: session.id },
          deps: setup.deps,
        }),
      (error: unknown) =>
        error instanceof Error && error.message === "CONTRACT_WRONG_STATUS",
    );
  });

  it("cancelled and completed versions remain read-only", async () => {
    const setup = deps();
    const sign = await publishClientAgreement({
      session,
      questionnaireId: "q-6",
      answers,
      locale: "en",
      deps: setup.deps,
    });
    const contract = await setup.deps.store!.getContractByQuestionnaireId("q-6");
    await setup.deps.store!.updateContract(contract!.id, { caseId: "case-6" });
    const cancelledView = await cancelAgreementVersion({
      caseId: "case-6",
      actor: owner,
      deps: setup.deps,
    });
    assert.equal(cancelledView.status, "cancelled");
    await assert.rejects(
      () =>
        requestClientOtp({
          session,
          versionId: sign.versionId,
          consent: true,
          deps: setup.deps,
        }),
      (error: unknown) =>
        error instanceof Error &&
        (error.message === "CONTRACT_CANCELLED" ||
          error.message === "CONTRACT_WRONG_STATUS"),
    );
  });

  it("questionnaire submit follows the active version client_signed gate", async () => {
    const { assertQuestionnaireSigned } = await import("./service.ts");
    const awaiting = deps();
    const v1 = await publishClientAgreement({
      session,
      questionnaireId: "q-gate-1",
      answers,
      locale: "en",
      deps: awaiting.deps,
    });
    await assert.rejects(
      () => assertQuestionnaireSigned("q-gate-1", awaiting.deps),
      (error: unknown) =>
        error instanceof Error && error.message === "AGREEMENT_NOT_SIGNED",
    );

    const signedSetup = deps();
    const signed = await publishClientAgreement({
      session,
      questionnaireId: "q-gate-2",
      answers,
      locale: "en",
      deps: signedSetup.deps,
    });
    await requestClientOtp({
      session,
      versionId: signed.versionId,
      consent: true,
      deps: signedSetup.deps,
    });
    await clientSignAgreement({
      session,
      versionId: signed.versionId,
      otp: "583214",
      consent: true,
      deps: signedSetup.deps,
    });
    await assertQuestionnaireSigned("q-gate-2", signedSetup.deps);

    const replaced = deps();
    const old = await publishClientAgreement({
      session,
      questionnaireId: "q-gate-3",
      answers,
      locale: "en",
      deps: replaced.deps,
    });
    await requestClientOtp({
      session,
      versionId: old.versionId,
      consent: true,
      deps: replaced.deps,
    });
    await clientSignAgreement({
      session,
      versionId: old.versionId,
      otp: "583214",
      consent: true,
      deps: replaced.deps,
    });
    const next = await createReplacementAgreementVersion({
      questionnaireId: "q-gate-3",
      portalUserId: session.id,
      portalEmail: session.email,
      answers: { ...answers, address: "New street 9" },
      locale: "en",
      actor: owner,
      deps: replaced.deps,
    });
    await assert.rejects(
      () => assertQuestionnaireSigned("q-gate-3", replaced.deps),
      (error: unknown) =>
        error instanceof Error && error.message === "AGREEMENT_NOT_SIGNED",
    );
    await requestClientOtp({
      session,
      versionId: next.versionId,
      consent: true,
      deps: replaced.deps,
    });
    await clientSignAgreement({
      session,
      versionId: next.versionId,
      otp: "583214",
      consent: true,
      deps: replaced.deps,
    });
    await assertQuestionnaireSigned("q-gate-3", replaced.deps);

    const cancelledSetup = deps();
    const cancelledSign = await publishClientAgreement({
      session,
      questionnaireId: "q-gate-4",
      answers,
      locale: "en",
      deps: cancelledSetup.deps,
    });
    const contract = await cancelledSetup.deps.store!.getContractByQuestionnaireId(
      "q-gate-4",
    );
    await cancelledSetup.deps.store!.updateContract(contract!.id, {
      caseId: "case-gate-4",
    });
    await cancelAgreementVersion({
      caseId: "case-gate-4",
      actor: owner,
      deps: cancelledSetup.deps,
    });
    void cancelledSign;
    await assert.rejects(
      () => assertQuestionnaireSigned("q-gate-4", cancelledSetup.deps),
      (error: unknown) =>
        error instanceof Error && error.message === "AGREEMENT_NOT_SIGNED",
    );
  });

  it("client A cannot sign client B version", async () => {
    const setup = deps();
    const sign = await publishClientAgreement({
      session,
      questionnaireId: "q-iso-1",
      answers,
      locale: "en",
      deps: setup.deps,
    });
    await requestClientOtp({
      session,
      versionId: sign.versionId,
      consent: true,
      deps: setup.deps,
    });
    const other: ClientSession = {
      ...session,
      id: "portal-2",
      email: "other@example.com",
    };
    await assert.rejects(
      () =>
        clientSignAgreement({
          session: other,
          versionId: sign.versionId,
          otp: "583214",
          consent: true,
          deps: setup.deps,
        }),
      (error: unknown) =>
        error instanceof Error && error.message === "CONTRACT_NOT_FOUND",
    );
  });

  it("employee without provider permission cannot sign", async () => {
    const setup = deps();
    const sign = await publishClientAgreement({
      session,
      questionnaireId: "q-perm-1",
      answers,
      locale: "en",
      deps: setup.deps,
    });
    await requestClientOtp({
      session,
      versionId: sign.versionId,
      consent: true,
      deps: setup.deps,
    });
    await clientSignAgreement({
      session,
      versionId: sign.versionId,
      otp: "583214",
      consent: true,
      deps: setup.deps,
    });
    const finance: SessionUser = {
      id: "fin-1",
      email: "finance@example.com",
      name: "Finn Finance",
      role: "finance_manager",
      authUserId: "auth-fin-1",
    };
    await assert.rejects(
      () =>
        providerSignAgreement({
          session: finance,
          versionId: sign.versionId,
          confirm: true,
          deps: setup.deps,
        }),
      (error: unknown) =>
        error instanceof Error && error.message === "PROVIDER_PERMISSION_REQUIRED",
    );
  });

  it("mail failure consumes OTP so resend is immediate", async () => {
    const store = createMemorySignStore();
    let fail = true;
    const setup = deps(store);
    setup.deps.sendMail = async () => {
      if (fail) {
        fail = false;
        return { ok: false as const, code: "EMAIL_SEND_FAILED" as const };
      }
      return { ok: true as const, id: "mail-2" };
    };
    const sign = await publishClientAgreement({
      session,
      questionnaireId: "q-mail-1",
      answers,
      locale: "en",
      deps: setup.deps,
    });
    await assert.rejects(
      () =>
        requestClientOtp({
          session,
          versionId: sign.versionId,
          consent: true,
          deps: setup.deps,
        }),
      (error: unknown) =>
        error instanceof Error && error.message === "EMAIL_SEND_FAILED",
    );
    const retry = await requestClientOtp({
      session,
      versionId: sign.versionId,
      consent: true,
      deps: setup.deps,
    });
    assert.ok(retry.otpCooldownSeconds > 0);
  });

  it("OTP attempt CAS allows only one increment at the same expected count", async () => {
    const setup = deps();
    const sign = await publishClientAgreement({
      session,
      questionnaireId: "q-cas-1",
      answers,
      locale: "en",
      deps: setup.deps,
    });
    await requestClientOtp({
      session,
      versionId: sign.versionId,
      consent: true,
      deps: setup.deps,
    });
    const version = await setup.store.getVersionById(sign.versionId);
    const requests = await setup.store.listRequests(version!.id);
    const clientReq = requests.find((row) => row.signerType === "client")!;
    const otp = await setup.store.getActiveOtp(clientReq.id);
    const [first, second] = await Promise.all([
      setup.store.updateOtp(otp!.id, { attemptsCount: 1 }, 0),
      setup.store.updateOtp(otp!.id, { attemptsCount: 1 }, 0),
    ]);
    assert.equal([first, second].filter(Boolean).length, 1);
  });

  it("parallel new-version cannot share version_number or demote active version", async () => {
    const setup = deps();
    await publishClientAgreement({
      session,
      questionnaireId: "q-nv-1",
      answers,
      locale: "en",
      deps: setup.deps,
    });
    const results = await Promise.allSettled([
      createReplacementAgreementVersion({
        questionnaireId: "q-nv-1",
        portalUserId: session.id,
        portalEmail: session.email,
        answers: { ...answers, address: "A street" },
        locale: "en",
        actor: owner,
        deps: setup.deps,
      }),
      createReplacementAgreementVersion({
        questionnaireId: "q-nv-1",
        portalUserId: session.id,
        portalEmail: session.email,
        answers: { ...answers, address: "B street" },
        locale: "en",
        actor: owner,
        deps: setup.deps,
      }),
    ]);
    const fulfilled = results.filter((row) => row.status === "fulfilled");
    assert.ok(fulfilled.length >= 1);
    const contract = await setup.store.getContractByQuestionnaireId("q-nv-1");
    const versions = await setup.store.listVersions(contract!.id);
    const numbers = versions.map((row) => row.versionNumber);
    assert.equal(new Set(numbers).size, numbers.length);
    const active = await setup.store.getVersionById(contract!.activeVersionId!);
    const maxNumber = Math.max(...numbers);
    assert.equal(active!.versionNumber, maxNumber);
  });

  it("completed cannot be cancelled and provider retry stays completed", async () => {
    const setup = deps();
    const sign = await publishClientAgreement({
      session,
      questionnaireId: "q-fin-1",
      answers,
      locale: "en",
      deps: setup.deps,
    });
    await requestClientOtp({
      session,
      versionId: sign.versionId,
      consent: true,
      deps: setup.deps,
    });
    await clientSignAgreement({
      session,
      versionId: sign.versionId,
      otp: "583214",
      consent: true,
      deps: setup.deps,
    });
    const first = await providerSignAgreement({
      session: owner,
      versionId: sign.versionId,
      confirm: true,
      deps: setup.deps,
    });
    assert.equal(first.status, "completed");
    const retry = await providerSignAgreement({
      session: owner,
      versionId: sign.versionId,
      confirm: true,
      deps: setup.deps,
    });
    assert.equal(retry.status, "completed");
    assert.equal(retry.finalPdfHash, first.finalPdfHash);
    const contract = await setup.store.getContractByQuestionnaireId("q-fin-1");
    await setup.store.updateContract(contract!.id, { caseId: "case-fin-1" });
    await assert.rejects(
      () =>
        cancelAgreementVersion({
          caseId: "case-fin-1",
          actor: owner,
          deps: setup.deps,
        }),
      (error: unknown) =>
        error instanceof Error && error.message === "CONTRACT_WRONG_STATUS",
    );
  });

  it("RU and EN final PDFs include certificate fields and persist locale", async () => {
    const { buildFinalAgreementPdf } = await import("./pdf.ts");
    const { PDFParse } = await import("pdf-parse");
    const snapshot = {
      locale: "ru" as const,
      templateVersion: "1",
      agreementNumber: "SP-2026-0002841",
      agreementDateIso: "2026-08-17",
      party: {
        firstName: "Иван",
        lastName: "Александрович-Петровский",
        patronymic: "Иванович",
        fullName: "Александрович-Петровский Иван Иванович",
        passportNumber: "AB123456",
        passportIssueDate: "15.01.2020",
        passportIssueDateIso: "2020-01-15",
        address: "Zagreb, Ilica 1",
        city: "Zagreb",
      },
    };
    const hash = "a".repeat(64);
    const ruTx = "SP-D172F58D644D4DEE821C7A1C292DCD32";
    const ruBytes = await buildFinalAgreementPdf(snapshot, {
      agreementNumber: snapshot.agreementNumber,
      versionNumber: 2,
      transactionId: ruTx,
      clientName: snapshot.party.fullName,
      clientSignedAt: "2026-08-17T10:00:00.000Z",
      providerName: "Olivia Owner",
      providerTitle: "Директор",
      providerSignedAt: "2026-08-17T11:00:00.000Z",
      sourcePdfHash: hash,
      locale: "ru",
    });
    const ruParser = new PDFParse({ data: ruBytes });
    const ruText = (await ruParser.getText()).text ?? "";
    await ruParser.destroy?.();
    const ruCompact = ruText.replace(/\s/g, "");
    assert.match(ruText, /SPIORA SIGN/);
    assert.match(ruText, /СВЕДЕНИЯ ОБ ЭЛЕКТРОННОМ ПОДПИСАНИИ/);
    assert.match(ruText, /ПОДТВЕРЖДЕНО ЭЛЕКТРОННО/);
    assert.match(ruText, /КЛИЕНТ/);
    assert.match(ruText, /SPIORA/);
    assert.match(ruText, /Transaction ID/);
    assert.match(ruText, /SHA-256/);
    assert.match(ruText, /Александрович-Петровский/);
    assert.ok(ruText.includes(ruTx));
    assert.ok(ruCompact.includes(hash));
    assert.doesNotMatch(ruText, /Qualified Electronic Signature/i);
    assert.doesNotMatch(ruText, /Квалифицированн/);

    const enTx = "SP-E172F58D644D4DEE821C7A1C292DCD32";
    const enBytes = await buildFinalAgreementPdf(
      { ...snapshot, locale: "en" },
      {
        agreementNumber: snapshot.agreementNumber,
        versionNumber: 2,
        transactionId: enTx,
        clientName: "Ivan Ivanov",
        clientSignedAt: "2026-08-17T10:00:00.000Z",
        providerName: "Olivia Owner",
        providerTitle: "Director",
        providerSignedAt: "2026-08-17T11:00:00.000Z",
        sourcePdfHash: hash,
        locale: "en",
      },
    );
    const enParser = new PDFParse({ data: enBytes });
    const enText = (await enParser.getText()).text ?? "";
    await enParser.destroy?.();
    const enCompact = enText.replace(/\s/g, "");
    assert.match(enText, /SPIORA SIGN/);
    assert.match(enText, /ELECTRONIC SIGNING CERTIFICATE/);
    assert.match(enText, /ELECTRONICALLY CONFIRMED/);
    assert.match(enText, /CLIENT/);
    assert.match(enText, /SPIORA/);
    assert.match(enText, /Transaction ID/);
    assert.match(enText, /SHA-256/);
    assert.ok(enText.includes(enTx));
    assert.ok(enCompact.includes(hash));
    assert.doesNotMatch(enText, /Qualified Electronic Signature/i);
  });

  it("publish fails when storage write succeeds but read fails", async () => {
    const setup = deps();
    setup.deps.writePdf = async (path, data) => {
      storePdf.set(path, data);
    };
    setup.deps.readPdf = async () => null;
    await assert.rejects(
      () =>
        publishClientAgreement({
          session,
          questionnaireId: "q-read-fail",
          answers,
          locale: "en",
          deps: setup.deps,
        }),
      (error: unknown) =>
        error instanceof Error && error.message === "DOCUMENT_HASH_MISMATCH",
    );
    const contract = await setup.store.getContractByQuestionnaireId("q-read-fail");
    const versions = contract
      ? await setup.store.listVersions(contract.id)
      : [];
    assert.ok(
      versions.every((row) => row.status !== "awaiting_client_signature"),
    );
    assert.ok(versions.every((row) => row.sourcePdfHash === null));
  });

  it("finalize fails when final write succeeds but read fails", async () => {
    const setup = deps();
    setup.deps.readPdf = async (path) => {
      if (path.includes("final")) return null;
      return storePdf.get(path) ?? null;
    };
    const sign = await publishClientAgreement({
      session,
      questionnaireId: "q-final-read-fail",
      answers,
      locale: "en",
      deps: setup.deps,
    });
    await requestClientOtp({
      session,
      versionId: sign.versionId,
      consent: true,
      deps: setup.deps,
    });
    await clientSignAgreement({
      session,
      versionId: sign.versionId,
      otp: "583214",
      consent: true,
      deps: setup.deps,
    });
    await assert.rejects(
      () =>
        providerSignAgreement({
          session: owner,
          versionId: sign.versionId,
          confirm: true,
          deps: setup.deps,
        }),
      (error: unknown) =>
        error instanceof Error && error.message === "DOCUMENT_HASH_MISMATCH",
    );
    const version = await setup.store.getVersionById(sign.versionId);
    assert.ok(version);
    assert.notEqual(version.status, "completed");
    assert.equal(version.finalPdfHash, null);
  });

  it("refuses provider sign in production when employee MFA is disabled", async () => {
    const setup = deps();
    const sign = await publishClientAgreement({
      session,
      questionnaireId: "q-mfa-prod",
      answers,
      locale: "en",
      deps: setup.deps,
    });
    await requestClientOtp({
      session,
      versionId: sign.versionId,
      consent: true,
      deps: setup.deps,
    });
    await clientSignAgreement({
      session,
      versionId: sign.versionId,
      otp: "583214",
      consent: true,
      deps: setup.deps,
    });
    process.env.NODE_ENV = "production";
    delete process.env.SPIORA_MFA_EMPLOYEE;
    await assert.rejects(
      () =>
        providerSignAgreement({
          session: owner,
          versionId: sign.versionId,
          confirm: true,
          deps: setup.deps,
        }),
      (error: unknown) =>
        error instanceof Error && error.message === "PROVIDER_MFA_NOT_CONFIGURED",
    );
    const version = await setup.store.getVersionById(sign.versionId);
    assert.equal(version?.status, "client_signed");
  });

  it("serves the source PDF even when concurrent views race the audit chain", async () => {
    const setup = deps();
    const sign = await publishClientAgreement({
      session,
      questionnaireId: "q-pdf-race",
      answers,
      locale: "en",
      deps: setup.deps,
    });
    const [firstPdf, secondPdf, otp] = await Promise.all([
      readAuthorizedPdf({
        versionId: sign.versionId,
        kind: "source",
        actor: { type: "client", portalUserId: session.id },
        deps: setup.deps,
      }),
      readAuthorizedPdf({
        versionId: sign.versionId,
        kind: "source",
        actor: { type: "client", portalUserId: session.id },
        deps: setup.deps,
      }),
      requestClientOtp({
        session,
        versionId: sign.versionId,
        consent: true,
        deps: setup.deps,
      }),
    ]);
    assert.equal(firstPdf.hash, sign.sourcePdfHash);
    assert.equal(secondPdf.hash, sign.sourcePdfHash);
    assert.ok(otp.otpCooldownSeconds > 0);
  });

  it("finds a client-signed envelope by questionnaire when caseId was not attached", async () => {
    const setup = deps();
    const sign = await publishClientAgreement({
      session,
      questionnaireId: "q-attach-case",
      answers,
      locale: "en",
      deps: setup.deps,
    });
    await requestClientOtp({
      session,
      versionId: sign.versionId,
      consent: true,
      deps: setup.deps,
    });
    await clientSignAgreement({
      session,
      versionId: sign.versionId,
      otp: "583214",
      consent: true,
      deps: setup.deps,
    });
    const before = await setup.store.getContractByCaseId("case-attach");
    assert.equal(before, null);
    const view = await getSignViewForCase("case-attach", {
      canProviderSign: true,
      deps: setup.deps,
      questionnaireId: "q-attach-case",
    });
    assert.equal(view?.status, "client_signed");
    assert.equal(view?.canProviderSign, true);
    const linked = await setup.store.getContractByCaseId("case-attach");
    assert.ok(linked);
  });
});
