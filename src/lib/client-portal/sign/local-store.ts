import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type {
  SignContractRecord,
  SignEventRecord,
  SignOtpRecord,
  SignRequestRecord,
  SignVersionRecord,
} from "./records";
import type { SignStore } from "./store";

type FileShape = {
  contracts: SignContractRecord[];
  versions: SignVersionRecord[];
  requests: SignRequestRecord[];
  otps: SignOtpRecord[];
  events: SignEventRecord[];
};

const EMPTY: FileShape = {
  contracts: [],
  versions: [],
  requests: [],
  otps: [],
  events: [],
};

const DATA_DIR = path.join(process.cwd(), ".data");
const FILE = path.join(DATA_DIR, "consulting-sign.json");

async function readAll(): Promise<FileShape> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    const parsed = JSON.parse(raw) as FileShape;
    return {
      contracts: Array.isArray(parsed.contracts) ? parsed.contracts : [],
      versions: Array.isArray(parsed.versions) ? parsed.versions : [],
      requests: Array.isArray(parsed.requests) ? parsed.requests : [],
      otps: Array.isArray(parsed.otps) ? parsed.otps : [],
      events: Array.isArray(parsed.events) ? parsed.events : [],
    };
  } catch {
    return structuredClone(EMPTY);
  }
}

async function writeAll(data: FileShape): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(data, null, 2), "utf8");
}

export function createMemorySignStore(seed?: Partial<FileShape>): SignStore {
  const data: FileShape = {
    contracts: [...(seed?.contracts ?? [])],
    versions: [...(seed?.versions ?? [])],
    requests: [...(seed?.requests ?? [])],
    otps: [...(seed?.otps ?? [])],
    events: [...(seed?.events ?? [])],
  };
  return createStoreFromAccessor(
    async () => data,
    async (next) => {
      data.contracts = next.contracts;
      data.versions = next.versions;
      data.requests = next.requests;
      data.otps = next.otps;
      data.events = next.events;
    },
  );
}

function createStoreFromAccessor(
  load: () => Promise<FileShape>,
  save: (data: FileShape) => Promise<void>,
): SignStore {
  let gate: Promise<unknown> = Promise.resolve();
  function locked<T>(fn: () => Promise<T>): Promise<T> {
    const run = gate.then(fn, fn);
    gate = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  function read<T>(fn: (data: FileShape) => T): Promise<T> {
    return locked(async () => fn(await load()));
  }

  function mutate<T>(fn: (data: FileShape) => T): Promise<T> {
    return locked(async () => {
      const data = await load();
      const result = fn(data);
      await save(data);
      return result;
    });
  }

  return {
    getContractById: (id) =>
      read((data) => data.contracts.find((row) => row.id === id) ?? null),
    getContractByQuestionnaireId: (id) =>
      read(
        (data) =>
          data.contracts.find((row) => row.questionnaireId === id) ?? null,
      ),
    getContractByPortalUserId: (id) =>
      read(
        (data) =>
          [...data.contracts]
            .filter((row) => row.portalUserId === id)
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null,
      ),
    getContractByCaseId: (id) =>
      read((data) => data.contracts.find((row) => row.caseId === id) ?? null),
    insertContract: (row) =>
      mutate((data) => {
        data.contracts.push(row);
        return row;
      }),
    updateContract: (id, patch, expectedActiveVersionId) =>
      mutate((data) => {
        const index = data.contracts.findIndex((row) => row.id === id);
        if (index < 0) return null;
        if (
          expectedActiveVersionId !== undefined &&
          data.contracts[index].activeVersionId !== expectedActiveVersionId
        ) {
          return null;
        }
        data.contracts[index] = { ...data.contracts[index], ...patch };
        return data.contracts[index];
      }),
    getVersionById: (id) =>
      read((data) => data.versions.find((row) => row.id === id) ?? null),
    listVersions: (contractId) =>
      read((data) =>
        data.versions
          .filter((row) => row.contractId === contractId)
          .sort((a, b) => b.versionNumber - a.versionNumber),
      ),
    insertVersion: (row) =>
      mutate((data) => {
        const duplicate = data.versions.some(
          (item) =>
            item.contractId === row.contractId &&
            item.versionNumber === row.versionNumber,
        );
        if (duplicate) {
          throw new Error("VERSION_NUMBER_CONFLICT");
        }
        data.versions.push(row);
        return row;
      }),
    updateVersion: (id, patch, expectedStatus) =>
      mutate((data) => {
        const index = data.versions.findIndex((row) => row.id === id);
        if (index < 0) return null;
        if (expectedStatus && data.versions[index].status !== expectedStatus) {
          return null;
        }
        data.versions[index] = { ...data.versions[index], ...patch };
        return data.versions[index];
      }),
    insertRequest: (row) =>
      mutate((data) => {
        data.requests.push(row);
        return row;
      }),
    listRequests: (versionId) =>
      read((data) =>
        data.requests.filter((row) => row.contractVersionId === versionId),
      ),
    updateRequest: (id, patch) =>
      mutate((data) => {
        const index = data.requests.findIndex((row) => row.id === id);
        if (index < 0) return null;
        data.requests[index] = { ...data.requests[index], ...patch };
        return data.requests[index];
      }),
    getActiveOtp: (requestId) =>
      read(
        (data) =>
          data.otps
            .filter(
              (row) =>
                row.signatureRequestId === requestId && row.consumedAt === null,
            )
            .sort((a, b) => b.sentAt.localeCompare(a.sentAt))[0] ?? null,
      ),
    listOtps: (requestId) =>
      read((data) =>
        data.otps.filter((row) => row.signatureRequestId === requestId),
      ),
    insertOtp: (row) =>
      mutate((data) => {
        data.otps.push(row);
        return row;
      }),
    updateOtp: (id, patch, expectedAttemptsCount) =>
      mutate((data) => {
        const index = data.otps.findIndex((row) => row.id === id);
        if (index < 0) return null;
        if (
          expectedAttemptsCount !== undefined &&
          data.otps[index].attemptsCount !== expectedAttemptsCount
        ) {
          return null;
        }
        data.otps[index] = { ...data.otps[index], ...patch };
        return data.otps[index];
      }),
    consumeOtpsForRequest: (requestId, consumedAt) =>
      mutate((data) => {
        for (const row of data.otps) {
          if (row.signatureRequestId === requestId && row.consumedAt === null) {
            row.consumedAt = consumedAt;
          }
        }
      }),
    insertEvent: (row) =>
      mutate((data) => {
        const fork = data.events.some(
          (item) =>
            item.contractVersionId === row.contractVersionId &&
            item.previousEventHash === row.previousEventHash,
        );
        if (fork) {
          throw new Error("EVENT_CHAIN_CONFLICT");
        }
        data.events.push(row);
        return row;
      }),
    listEvents: (versionId) =>
      read((data) =>
        data.events
          .filter((row) => row.contractVersionId === versionId)
          .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt)),
      ),
    lastEvent: (versionId) =>
      read((data) => {
        const events = data.events
          .filter((row) => row.contractVersionId === versionId)
          .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
        return events[events.length - 1] ?? null;
      }),
  };
}

export function createLocalSignStore(): SignStore {
  return createStoreFromAccessor(readAll, writeAll);
}

export function newId(): string {
  return randomUUID();
}
