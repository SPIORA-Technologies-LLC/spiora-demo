import "server-only";

import type { SessionUser } from "@/lib/auth/types";
import type { CompanyDetailsUpdateInput } from "./types";
import type { CompanyDetailsStore } from "./store";
import {
  fetchCompanyDetailsRow,
  patchCompanyDetailsRow,
} from "./supabase-company-details-repo";

export function createSupabaseCompanyDetailsStore(): CompanyDetailsStore {
  return {
    async get() {
      return fetchCompanyDetailsRow();
    },

    async update(actor: SessionUser, input: CompanyDetailsUpdateInput) {
      return patchCompanyDetailsRow(actor.id, input);
    },
  };
}
