import "server-only";

import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { ConsultingAgreementParty } from "./consulting-agreement-fields";
import type { AppLocale } from "@/i18n/config";

export type ConsultingAgreementRecord = {
  id: string;
  questionnaireId: string;
  caseId: string | null;
  portalUserId: string;
  locale: AppLocale;
  agreementNumber: string;
  agreementDateIso: string;
  party: ConsultingAgreementParty;
  clientAcceptedAt: string | null;
  employeeAcceptedAt: string | null;
  employeeUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

const DATA_DIR = path.join(process.cwd(), ".data");
const FILE = path.join(DATA_DIR, "consulting-agreements.json");

async function readAll(): Promise<ConsultingAgreementRecord[]> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    const parsed = JSON.parse(raw) as ConsultingAgreementRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeAll(rows: ConsultingAgreementRecord[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(rows, null, 2), "utf8");
}

export async function localGetAgreementByQuestionnaireId(
  questionnaireId: string,
): Promise<ConsultingAgreementRecord | null> {
  const rows = await readAll();
  return rows.find((row) => row.questionnaireId === questionnaireId) ?? null;
}

export async function localGetAgreementByPortalUserId(
  portalUserId: string,
): Promise<ConsultingAgreementRecord | null> {
  const rows = await readAll();
  return rows.find((row) => row.portalUserId === portalUserId) ?? null;
}

export async function localGetAgreementByCaseId(
  caseId: string,
): Promise<ConsultingAgreementRecord | null> {
  const rows = await readAll();
  return rows.find((row) => row.caseId === caseId) ?? null;
}

export async function localUpsertAgreement(
  input: Omit<ConsultingAgreementRecord, "id" | "createdAt" | "updatedAt"> & {
    id?: string;
  },
): Promise<ConsultingAgreementRecord> {
  const rows = await readAll();
  const now = new Date().toISOString();
  const existingIndex = rows.findIndex(
    (row) => row.questionnaireId === input.questionnaireId,
  );
  if (existingIndex >= 0) {
    const existing = rows[existingIndex];
    const next: ConsultingAgreementRecord = {
      ...existing,
      ...input,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: now,
      clientAcceptedAt: input.clientAcceptedAt ?? existing.clientAcceptedAt,
      employeeAcceptedAt:
        input.employeeAcceptedAt ?? existing.employeeAcceptedAt,
      employeeUserId: input.employeeUserId ?? existing.employeeUserId,
      caseId: input.caseId ?? existing.caseId,
    };
    rows[existingIndex] = next;
    await writeAll(rows);
    return next;
  }
  const created: ConsultingAgreementRecord = {
    id: input.id ?? randomUUID(),
    questionnaireId: input.questionnaireId,
    caseId: input.caseId,
    portalUserId: input.portalUserId,
    locale: input.locale,
    agreementNumber: input.agreementNumber,
    agreementDateIso: input.agreementDateIso,
    party: input.party,
    clientAcceptedAt: input.clientAcceptedAt,
    employeeAcceptedAt: input.employeeAcceptedAt,
    employeeUserId: input.employeeUserId,
    createdAt: now,
    updatedAt: now,
  };
  rows.push(created);
  await writeAll(rows);
  return created;
}
