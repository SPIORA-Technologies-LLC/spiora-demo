import "server-only";

import type { SessionUser } from "@/lib/auth/types";
import {
  canManageCompanyDetails,
  canViewCompanyDetails,
} from "./permissions";
import { CompanyDetailsError } from "./errors";
import { getCompanyDetailsStore } from "./store-selection";
import type {
  CompanyDetailsUpdateInput,
  CompanyDetailsView,
} from "./types";
import { validateCompanyDetailsUpdate } from "./validation";

function assertView(actor: SessionUser) {
  if (!canViewCompanyDetails(actor)) {
    throw new CompanyDetailsError(
      "COMPANY_DETAILS_ACCESS_DENIED",
      "Company details access denied",
      403,
    );
  }
}

function assertManage(actor: SessionUser) {
  if (!canManageCompanyDetails(actor)) {
    throw new CompanyDetailsError(
      "COMPANY_DETAILS_ACCESS_DENIED",
      "Company details access denied",
      403,
    );
  }
}

function toView(
  actor: SessionUser,
  record: Awaited<ReturnType<Awaited<ReturnType<typeof getCompanyDetailsStore>>["get"]>>,
): CompanyDetailsView {
  return {
    ...record,
    canManage: canManageCompanyDetails(actor),
  };
}

export async function getCompanyDetails(
  actor: SessionUser,
): Promise<CompanyDetailsView> {
  assertView(actor);
  const store = await getCompanyDetailsStore();
  const record = await store.get();
  return toView(actor, record);
}

export async function updateCompanyDetails(
  actor: SessionUser,
  input: Partial<CompanyDetailsUpdateInput>,
): Promise<CompanyDetailsView> {
  assertManage(actor);
  const validated = validateCompanyDetailsUpdate(input);
  const store = await getCompanyDetailsStore();
  const record = await store.update(actor, validated);
  return toView(actor, record);
}
