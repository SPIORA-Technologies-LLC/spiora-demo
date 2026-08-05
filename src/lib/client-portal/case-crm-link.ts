import "server-only";

import type { SessionUser } from "@/lib/auth/types";
import { canViewFinance } from "@/lib/finance/permissions";
import { canCreateClient } from "@/lib/clients/permissions";
import { isCrmPostgresPrimary } from "@/lib/clients/config";
import { getCaseStore } from "./case-store-selection";
import * as sbClients from "@/lib/supabase/clients-repo";

export class CaseCrmLinkError extends Error {
  readonly code:
    | "CASE_NOT_FOUND"
    | "FINANCE_ACCESS_DENIED"
    | "CRM_UNAVAILABLE"
    | "CRM_CREATE_FORBIDDEN"
    | "CRM_LINK_FAILED";

  constructor(
    code: CaseCrmLinkError["code"],
    message: string,
  ) {
    super(message);
    this.name = "CaseCrmLinkError";
    this.code = code;
  }
}

export type EnsureCrmClientResult = {
  externalId: string;
  clientUuid: string;
  created: boolean;
  linked: boolean;
};

function buildDisplayName(
  firstName: string | null,
  lastName: string | null,
  email: string | null,
): string {
  const name = [firstName?.trim(), lastName?.trim()].filter(Boolean).join(" ");
  if (name) return name;
  if (email?.trim()) return email.trim();
  return "Intake client";
}

type LinkActor = {
  id: string | null;
  name: string;
  role: "employee" | "system";
};

/**
 * Create/link CRM client for an intake case (no permission checks).
 * Used on questionnaire submit and by the staff Finance tab.
 * Rows are tagged source=client_intake and excluded from «База клиентов».
 */
async function linkCrmClientForCaseCore(
  caseId: string,
  actor: LinkActor,
): Promise<EnsureCrmClientResult> {
  if (!isCrmPostgresPrimary()) {
    throw new CaseCrmLinkError(
      "CRM_UNAVAILABLE",
      "CRM PostgreSQL is required to link intake cases to Finance",
    );
  }

  const store = await getCaseStore();
  const record = await store.getById(caseId);
  if (!record) {
    throw new CaseCrmLinkError("CASE_NOT_FOUND", "Case not found");
  }

  if (record.crmClientId) {
    const existing = await sbClients.sbGetClientByUuid(record.crmClientId);
    if (!existing) {
      throw new CaseCrmLinkError(
        "CRM_LINK_FAILED",
        "Linked CRM client is missing",
      );
    }
    return {
      externalId: existing.id,
      clientUuid: record.crmClientId,
      created: false,
      linked: false,
    };
  }

  // Prefer matching an existing CRM row by email to avoid duplicates.
  const email = record.email?.trim() || "";
  if (email) {
    const byEmail = await sbClients.sbFindClientByEmail(email);
    if (byEmail) {
      const uuid = await sbClients.sbGetClientUuidByExternalId(byEmail.id);
      if (!uuid) {
        throw new CaseCrmLinkError(
          "CRM_LINK_FAILED",
          "Could not resolve CRM client uuid",
        );
      }
      try {
        await store.linkCrmClient(caseId, uuid);
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === "CASE_CRM_ALREADY_LINKED"
        ) {
          const again = await store.getById(caseId);
          if (again?.crmClientId) {
            const linked = await sbClients.sbGetClientByUuid(again.crmClientId);
            if (linked) {
              return {
                externalId: linked.id,
                clientUuid: again.crmClientId,
                created: false,
                linked: false,
              };
            }
          }
        }
        throw new CaseCrmLinkError(
          "CRM_LINK_FAILED",
          "Failed to link existing CRM client",
        );
      }
      return {
        externalId: byEmail.id,
        clientUuid: uuid,
        created: false,
        linked: true,
      };
    }
  }

  const externalId = await sbClients.sbNextDemoExternalId();
  const direction = record.serviceType?.trim() || "";
  const payload = sbClients.buildInsertFromCreateInput(
    {
      name: buildDisplayName(record.firstName, record.lastName, record.email),
      email: email || undefined,
      phone: record.phone?.trim() || undefined,
      direction: direction || undefined,
      serviceType: direction || undefined,
      manager: record.assignedName ?? actor.name,
      assignedUserId: record.assignedTo ?? actor.id,
      status: "New",
      pipelineStage: "Intake",
      notesSummary: `Linked from client intake case ${caseId}`,
    },
    externalId,
  );
  payload.source = "client_intake";
  payload.is_demo = false;

  const created = await sbClients.sbInsertClient(payload);
  const uuid = await sbClients.sbGetClientUuidByExternalId(created.id);
  if (!uuid) {
    throw new CaseCrmLinkError(
      "CRM_LINK_FAILED",
      "Created CRM client but uuid lookup failed",
    );
  }

  try {
    const { sbEnsureEmptyFinanceProfile } = await import(
      "@/lib/finance/supabase-finance-repo"
    );
    await sbEnsureEmptyFinanceProfile(uuid, actor.id);
  } catch {
    // non-fatal — Finance still lists the CRM client without a profile
  }

  try {
    await store.linkCrmClient(caseId, uuid);
  } catch (error) {
    // Another request may have linked first — prefer that link if present.
    const again = await store.getById(caseId);
    if (again?.crmClientId) {
      const linked = await sbClients.sbGetClientByUuid(again.crmClientId);
      if (linked) {
        return {
          externalId: linked.id,
          clientUuid: again.crmClientId,
          created: false,
          linked: false,
        };
      }
    }
    throw new CaseCrmLinkError(
      "CRM_LINK_FAILED",
      error instanceof Error ? error.message : "Failed to link CRM client",
    );
  }

  await store.appendActivity({
    caseId,
    eventType: "crm_client_linked",
    actorUserId: actor.id,
    actorRole: actor.role,
    payload: { crmClientId: uuid, externalId: created.id },
  });

  return {
    externalId: created.id,
    clientUuid: uuid,
    created: true,
    linked: true,
  };
}

/**
 * Staff Finance tab: permission-gated ensure + link.
 */
export async function ensureCrmClientForCase(
  caseId: string,
  actor: SessionUser,
): Promise<EnsureCrmClientResult> {
  if (!canViewFinance(actor)) {
    throw new CaseCrmLinkError(
      "FINANCE_ACCESS_DENIED",
      "Finance access denied",
    );
  }

  if (!canCreateClient(actor)) {
    // Still allow if already linked or email match — check after core would create.
    // Gate create only: re-check inside by attempting email match first via core,
    // but core creates without check. So enforce create permission before core
    // when no link exists.
    const store = await getCaseStore();
    const record = await store.getById(caseId);
    if (!record) {
      throw new CaseCrmLinkError("CASE_NOT_FOUND", "Case not found");
    }
    if (!record.crmClientId) {
      const email = record.email?.trim() || "";
      const byEmail = email ? await sbClients.sbFindClientByEmail(email) : null;
      if (!byEmail) {
        throw new CaseCrmLinkError(
          "CRM_CREATE_FORBIDDEN",
          "Not allowed to create CRM client",
        );
      }
    }
  }

  return linkCrmClientForCaseCore(caseId, {
    id: actor.id,
    name: actor.name,
    role: "employee",
  });
}

/**
 * Questionnaire submit path: system ensure + link (best-effort caller).
 * Makes the client visible in Finance without opening the case Finance tab.
 */
export async function ensureCrmClientForIntakeCase(
  caseId: string,
  options?: { actorUserId?: string | null; actorName?: string | null },
): Promise<EnsureCrmClientResult | null> {
  if (!isCrmPostgresPrimary()) return null;
  try {
    return await linkCrmClientForCaseCore(caseId, {
      id: options?.actorUserId ?? null,
      name: options?.actorName?.trim() || "System",
      role: "system",
    });
  } catch {
    return null;
  }
}
