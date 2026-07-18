import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ensureKbDraft,
  shouldEnsureDraftForUpload,
  titlesForAutoDraft,
} from "./kb-auto-draft.ts";

describe("KB Auto Draft", () => {
  it("upload creates Draft automatically", async () => {
    let creates = 0;
    let inFlight: Promise<string> | null = null;
    assert.equal(shouldEnsureDraftForUpload(1), true);

    const result = await ensureKbDraft({
      articleExists: false,
      getSlug: () => "",
      createDraft: async () => {
        creates += 1;
        return "new-material";
      },
      getInFlight: () => inFlight,
      setInFlight: (p) => {
        inFlight = p;
      },
    });

    assert.deepEqual(result, { ok: true, slug: "new-material", created: true });
    assert.equal(creates, 1);
  });

  it("publish path creates Draft automatically when article missing", async () => {
    let creates = 0;
    let inFlight: Promise<string> | null = null;

    const draft = await ensureKbDraft({
      articleExists: false,
      getSlug: () => "",
      createDraft: async () => {
        creates += 1;
        return "ready-to-publish";
      },
      getInFlight: () => inFlight,
      setInFlight: (p) => {
        inFlight = p;
      },
    });

    assert.equal(draft.ok, true);
    if (!draft.ok) return;
    assert.equal(draft.created, true);
    assert.equal(creates, 1);

    // Second step: publish uses existing article — no second create
    const again = await ensureKbDraft({
      articleExists: true,
      getSlug: () => draft.slug,
      createDraft: async () => {
        creates += 1;
        return "should-not-run";
      },
      getInFlight: () => null,
      setInFlight: () => {},
    });

    assert.deepEqual(again, { ok: true, slug: "ready-to-publish", created: false });
    assert.equal(creates, 1);
  });

  it("повторный upload не создаёт второй Draft (coalesce in-flight)", async () => {
    let creates = 0;
    let inFlight: Promise<string> | null = null;
    let resolveCreate!: (slug: string) => void;

    const slowCreate = () =>
      new Promise<string>((resolve) => {
        creates += 1;
        resolveCreate = resolve;
      });

    const first = ensureKbDraft({
      articleExists: false,
      getSlug: () => "",
      createDraft: slowCreate,
      getInFlight: () => inFlight,
      setInFlight: (p) => {
        inFlight = p;
      },
    });

    const second = ensureKbDraft({
      articleExists: false,
      getSlug: () => "",
      createDraft: slowCreate,
      getInFlight: () => inFlight,
      setInFlight: (p) => {
        inFlight = p;
      },
    });

    resolveCreate("shared-draft");
    const [a, b] = await Promise.all([first, second]);

    assert.deepEqual(a, { ok: true, slug: "shared-draft", created: true });
    assert.deepEqual(b, { ok: true, slug: "shared-draft", created: false });
    assert.equal(creates, 1);
  });

  it("существующая статья не пересоздаётся", async () => {
    let creates = 0;
    const result = await ensureKbDraft({
      articleExists: true,
      getSlug: () => "existing-article",
      createDraft: async () => {
        creates += 1;
        return "new";
      },
      getInFlight: () => null,
      setInFlight: () => {},
    });

    assert.deepEqual(result, {
      ok: true,
      slug: "existing-article",
      created: false,
    });
    assert.equal(creates, 0);
  });

  it("ошибка создания Draft возвращает ok:false", async () => {
    let inFlight: Promise<string> | null = null;
    const result = await ensureKbDraft({
      articleExists: false,
      getSlug: () => "",
      createDraft: async () => {
        throw new Error("Draft creation failed");
      },
      getInFlight: () => inFlight,
      setInFlight: (p) => {
        inFlight = p;
      },
    });

    assert.deepEqual(result, { ok: false });
  });

  it("отменённый upload не создаёт лишние записи", () => {
    assert.equal(shouldEnsureDraftForUpload(0), false);
  });

  it("titlesForAutoDraft fills placeholders without exposing internals", () => {
    assert.deepEqual(titlesForAutoDraft("", ""), {
      en: "Untitled material",
      ru: "Материал без названия",
    });
    assert.deepEqual(titlesForAutoDraft("Policy", ""), {
      en: "Policy",
      ru: "Policy",
    });
  });
});
