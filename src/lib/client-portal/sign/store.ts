import type {
  SignContractRecord,
  SignEventRecord,
  SignOtpRecord,
  SignRequestRecord,
  SignVersionRecord,
} from "./records";
import type { SignVersionStatus } from "../sign-types";

export type SignStore = {
  getContractById(id: string): Promise<SignContractRecord | null>;
  getContractByQuestionnaireId(id: string): Promise<SignContractRecord | null>;
  getContractByPortalUserId(id: string): Promise<SignContractRecord | null>;
  getContractByCaseId(id: string): Promise<SignContractRecord | null>;
  insertContract(row: SignContractRecord): Promise<SignContractRecord>;
  updateContract(
    id: string,
    patch: Partial<SignContractRecord>,
    expectedActiveVersionId?: string | null,
  ): Promise<SignContractRecord | null>;
  getVersionById(id: string): Promise<SignVersionRecord | null>;
  listVersions(contractId: string): Promise<SignVersionRecord[]>;
  insertVersion(row: SignVersionRecord): Promise<SignVersionRecord>;
  updateVersion(
    id: string,
    patch: Partial<SignVersionRecord>,
    expectedStatus?: SignVersionStatus,
  ): Promise<SignVersionRecord | null>;
  insertRequest(row: SignRequestRecord): Promise<SignRequestRecord>;
  listRequests(versionId: string): Promise<SignRequestRecord[]>;
  updateRequest(
    id: string,
    patch: Partial<SignRequestRecord>,
  ): Promise<SignRequestRecord | null>;
  getActiveOtp(requestId: string): Promise<SignOtpRecord | null>;
  listOtps(requestId: string): Promise<SignOtpRecord[]>;
  insertOtp(row: SignOtpRecord): Promise<SignOtpRecord>;
  updateOtp(
    id: string,
    patch: Partial<SignOtpRecord>,
    expectedAttemptsCount?: number,
  ): Promise<SignOtpRecord | null>;
  insertEvent(row: SignEventRecord): Promise<SignEventRecord>;
  listEvents(versionId: string): Promise<SignEventRecord[]>;
  lastEvent(versionId: string): Promise<SignEventRecord | null>;
  consumeOtpsForRequest(
    requestId: string,
    consumedAt: string,
  ): Promise<void>;
};
