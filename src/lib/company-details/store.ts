import type { SessionUser } from "@/lib/auth/types";
import type {
  CompanyDetailsRecord,
  CompanyDetailsUpdateInput,
} from "./types";

export interface CompanyDetailsStore {
  get(): Promise<CompanyDetailsRecord>;
  update(
    actor: SessionUser,
    input: CompanyDetailsUpdateInput,
  ): Promise<CompanyDetailsRecord>;
  resetForTests?(): Promise<void>;
}
