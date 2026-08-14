import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type {
  QuestionnaireAnswers,
  QuestionnaireRecord,
  QuestionnaireSchema,
  TemplateVersionRecord,
} from "./questionnaire-types";
import type { QuestionnaireStore } from "./questionnaire-service";
import {
  GENERAL_CLIENT_ONBOARDING_SCHEMA,
  GENERAL_CLIENT_ONBOARDING_TEMPLATE_KEY,
} from "./questionnaire-demo-template";
import { hashQuestionnaireSchema } from "./questionnaire-schema";

const DATA_DIR = path.join(process.cwd(), ".data");
const TEMPLATES_FILE = path.join(DATA_DIR, "questionnaire-templates.json");
const VERSIONS_FILE = path.join(DATA_DIR, "questionnaire-template-versions.json");
const QUESTIONNAIRES_FILE = path.join(DATA_DIR, "client-questionnaires.json");

type LocalTemplatesStore = {
  templates: Array<{
    id: string;
    templateKey: string;
    name: string;
    description: string | null;
    status: string;
    createdAt: string;
    updatedAt: string;
  }>;
};

type LocalVersionsStore = {
  versions: TemplateVersionRecord[];
};

type LocalQuestionnairesStore = {
  questionnaires: QuestionnaireRecord[];
};

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJson<T>(file: string, data: T): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(file, JSON.stringify(data, null, 2), "utf8");
}

async function ensureDemoSeed(): Promise<void> {
  const templates = await readJson<LocalTemplatesStore>(TEMPLATES_FILE, {
    templates: [],
  });
  const versions = await readJson<LocalVersionsStore>(VERSIONS_FILE, {
    versions: [],
  });

  const existing = templates.templates.find(
    (t) => t.templateKey === GENERAL_CLIENT_ONBOARDING_TEMPLATE_KEY,
  );
  const templateId = existing?.id ?? randomUUID();

  if (!existing) {
    const now = new Date().toISOString();
    templates.templates.push({
      id: templateId,
      templateKey: GENERAL_CLIENT_ONBOARDING_TEMPLATE_KEY,
      name: "General client onboarding",
      description: "Demo onboarding questionnaire",
      status: "published",
      createdAt: now,
      updatedAt: now,
    });
    await writeJson(TEMPLATES_FILE, templates);
  }

  const hasV1 = versions.versions.some(
    (v) => v.templateId === templateId && v.version === 1,
  );
  const schema = GENERAL_CLIENT_ONBOARDING_SCHEMA;
  const schemaHash = hashQuestionnaireSchema(schema);
  if (!hasV1) {
    const now = new Date().toISOString();
    versions.versions.push({
      id: randomUUID(),
      templateId,
      version: 1,
      schema,
      schemaHash,
      status: "published",
      publishedAt: now,
      createdAt: now,
    });
    await writeJson(VERSIONS_FILE, versions);
  } else {
    // Keep local published v1 aligned with the in-code demo schema.
    let changed = false;
    versions.versions = versions.versions.map((version) => {
      if (version.templateId !== templateId || version.version !== 1) {
        return version;
      }
      if (version.schemaHash === schemaHash) return version;
      changed = true;
      return {
        ...version,
        schema,
        schemaHash,
        status: "published",
      };
    });
    if (changed) await writeJson(VERSIONS_FILE, versions);
  }
}

export async function createLocalQuestionnaireStore(): Promise<QuestionnaireStore> {
  await ensureDemoSeed();

  return {
    async getPublishedVersionByTemplateKey(templateKey) {
      const templates = await readJson<LocalTemplatesStore>(TEMPLATES_FILE, {
        templates: [],
      });
      const tmpl = templates.templates.find(
        (t) => t.templateKey === templateKey && t.status === "published",
      );
      if (!tmpl) return null;
      const versions = await readJson<LocalVersionsStore>(VERSIONS_FILE, {
        versions: [],
      });
      const published = versions.versions
        .filter((v) => v.templateId === tmpl.id && v.status === "published")
        .sort((a, b) => b.version - a.version);
      return published[0] ?? null;
    },

    async getPublishedVersionById(id) {
      const versions = await readJson<LocalVersionsStore>(VERSIONS_FILE, {
        versions: [],
      });
      return versions.versions.find((v) => v.id === id && v.status === "published") ?? null;
    },

    async getByInvitationId(invitationId) {
      const store = await readJson<LocalQuestionnairesStore>(QUESTIONNAIRES_FILE, {
        questionnaires: [],
      });
      return (
        store.questionnaires.find(
          (q) => q.invitationId === invitationId && !q.archivedAt,
        ) ?? null
      );
    },

    async getById(id) {
      const store = await readJson<LocalQuestionnairesStore>(QUESTIONNAIRES_FILE, {
        questionnaires: [],
      });
      return store.questionnaires.find((q) => q.id === id) ?? null;
    },

    async createDraft(input) {
      const store = await readJson<LocalQuestionnairesStore>(QUESTIONNAIRES_FILE, {
        questionnaires: [],
      });
      const existing = store.questionnaires.find(
        (q) => q.invitationId === input.invitationId && !q.archivedAt,
      );
      if (existing) return existing;

      const now = new Date().toISOString();
      const record: QuestionnaireRecord = {
        id: randomUUID(),
        clientPortalUserId: input.clientPortalUserId,
        invitationId: input.invitationId,
        templateVersionId: input.templateVersionId,
        status: "draft",
        answers: input.answers,
        revision: 1,
        startedAt: input.startedAt,
        lastSavedAt: input.startedAt,
        reviewedAt: null,
        submittedAt: null,
        createdAt: now,
        updatedAt: now,
        archivedAt: null,
      };
      store.questionnaires.push(record);
      await writeJson(QUESTIONNAIRES_FILE, store);
      return record;
    },

    async updateDraft(input) {
      const store = await readJson<LocalQuestionnairesStore>(QUESTIONNAIRES_FILE, {
        questionnaires: [],
      });
      const idx = store.questionnaires.findIndex((q) => q.id === input.id);
      if (idx < 0) {
        return { ok: false, code: "QUESTIONNAIRE_REVISION_CONFLICT" };
      }
      const current = store.questionnaires[idx];
      if (current.revision !== input.baseRevision || current.status !== "draft") {
        return { ok: false, code: "QUESTIONNAIRE_REVISION_CONFLICT" };
      }
      const updated: QuestionnaireRecord = {
        ...current,
        answers: input.answers,
        revision: input.baseRevision + 1,
        lastSavedAt: input.lastSavedAt,
        updatedAt: input.lastSavedAt,
      };
      store.questionnaires[idx] = updated;
      await writeJson(QUESTIONNAIRES_FILE, store);
      return { ok: true, record: updated };
    },

    async setStatus(input) {
      const store = await readJson<LocalQuestionnairesStore>(QUESTIONNAIRES_FILE, {
        questionnaires: [],
      });
      const idx = store.questionnaires.findIndex((q) => q.id === input.id);
      if (idx < 0) {
        return { ok: false, code: "QUESTIONNAIRE_REVISION_CONFLICT" };
      }
      const current = store.questionnaires[idx];
      if (current.revision !== input.baseRevision) {
        return { ok: false, code: "QUESTIONNAIRE_REVISION_CONFLICT" };
      }
      const now = new Date().toISOString();
      const updated: QuestionnaireRecord = {
        ...current,
        status: input.status,
        revision: input.baseRevision + 1,
        reviewedAt:
          input.reviewedAt !== undefined ? input.reviewedAt : current.reviewedAt,
        submittedAt:
          input.submittedAt !== undefined
            ? input.submittedAt
            : current.submittedAt,
        updatedAt: now,
      };
      store.questionnaires[idx] = updated;
      await writeJson(QUESTIONNAIRES_FILE, store);
      return { ok: true, record: updated };
    },
  };
}
