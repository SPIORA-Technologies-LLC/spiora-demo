import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { SignVersionStatus } from "@/lib/client-portal/sign-types";
import { isSupabaseConfigured } from "@/lib/supabase/config";

const PENDING_STATUSES: SignVersionStatus[] = [
  "awaiting_client_signature",
  "client_signed",
];

export type PendingContractSignatureItem = {
  id: string;
  caseId: string | null;
  clientName: string;
  agreementNumber: string;
  status: "awaiting_client_signature" | "client_signed";
  href: string;
  updatedAt: string;
};

type LocalSignFile = {
  contracts: Array<{
    id: string;
    caseId: string | null;
    agreementNumber: string;
    activeVersionId: string | null;
  }>;
  versions: Array<{
    id: string;
    contractId: string;
    status: SignVersionStatus;
    updatedAt: string;
    snapshot: { party?: { fullName?: string }; agreementNumber?: string };
  }>;
};

async function listFromLocalFile(): Promise<PendingContractSignatureItem[]> {
  try {
    const raw = await readFile(
      path.join(process.cwd(), ".data", "consulting-sign.json"),
      "utf8",
    );
    const parsed = JSON.parse(raw) as LocalSignFile;
    const contracts = Array.isArray(parsed.contracts) ? parsed.contracts : [];
    const versions = Array.isArray(parsed.versions) ? parsed.versions : [];
    const items: PendingContractSignatureItem[] = [];

    for (const contract of contracts) {
      if (!contract.activeVersionId) continue;
      const version = versions.find((v) => v.id === contract.activeVersionId);
      if (!version || !PENDING_STATUSES.includes(version.status)) continue;
      if (
        version.status !== "awaiting_client_signature" &&
        version.status !== "client_signed"
      ) {
        continue;
      }
      items.push({
        id: version.id,
        caseId: contract.caseId,
        clientName:
          version.snapshot?.party?.fullName?.trim() ||
          contract.agreementNumber,
        agreementNumber:
          version.snapshot?.agreementNumber || contract.agreementNumber,
        status: version.status,
        href: contract.caseId
          ? `/clients/intake/${contract.caseId}`
          : "/clients/intake",
        updatedAt: version.updatedAt,
      });
    }

    return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

async function listFromSupabase(): Promise<PendingContractSignatureItem[]> {
  try {
    const { getSupabaseAdmin } = await import("@/lib/supabase/server");
    const client = getSupabaseAdmin();
    const { data: contracts, error: contractsError } = await client
      .from("consulting_sign_contracts")
      .select("id, case_id, agreement_number, active_version_id")
      .not("active_version_id", "is", null);

    if (contractsError || !contracts?.length) return [];

    const versionIds = contracts
      .map((row) => row.active_version_id)
      .filter((id): id is string => Boolean(id));
    if (versionIds.length === 0) return [];

    const { data: versions, error: versionsError } = await client
      .from("consulting_sign_versions")
      .select("id, status, updated_at, snapshot")
      .in("id", versionIds)
      .in("status", PENDING_STATUSES);

    if (versionsError || !versions?.length) return [];

    const versionById = new Map(
      versions.map((version) => [String(version.id), version]),
    );
    const items: PendingContractSignatureItem[] = [];

    for (const row of contracts) {
      const activeId = row.active_version_id ? String(row.active_version_id) : null;
      if (!activeId) continue;
      const versionRaw = versionById.get(activeId);
      if (!versionRaw) continue;
      if (
        versionRaw.status !== "awaiting_client_signature" &&
        versionRaw.status !== "client_signed"
      ) {
        continue;
      }
      const snapshot = versionRaw.snapshot as {
        party?: { fullName?: string };
        agreementNumber?: string;
      };
      const caseId = row.case_id ? String(row.case_id) : null;
      items.push({
        id: String(versionRaw.id),
        caseId,
        clientName:
          snapshot?.party?.fullName?.trim() || String(row.agreement_number),
        agreementNumber: String(row.agreement_number),
        status: versionRaw.status,
        href: caseId ? `/clients/intake/${caseId}` : "/clients/intake",
        updatedAt: String(versionRaw.updated_at),
      });
    }

    return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

export async function listPendingContractSignatures(): Promise<
  PendingContractSignatureItem[]
> {
  if (isSupabaseConfigured()) {
    return listFromSupabase();
  }
  return listFromLocalFile();
}
