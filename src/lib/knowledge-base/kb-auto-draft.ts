/**
 * Client-side Auto Draft orchestration for KB create flow.
 * Pure helpers — no Storage/RLS/migration changes.
 */

export type EnsureDraftSuccess = {
  ok: true;
  slug: string;
  /** True only when this call actually invoked createDraft (not coalesced/reuse). */
  created: boolean;
};

export type EnsureDraftFailure = {
  ok: false;
};

export type EnsureDraftResult = EnsureDraftSuccess | EnsureDraftFailure;

export type EnsureDraftDeps = {
  /** Article already persisted (edit mode or prior auto-draft). */
  articleExists: boolean;
  getSlug: () => string;
  createDraft: () => Promise<string>;
  getInFlight: () => Promise<string> | null;
  setInFlight: (promise: Promise<string> | null) => void;
};

/**
 * Ensures a draft article exists exactly once for a create session.
 * Concurrent callers share the same in-flight create.
 */
export async function ensureKbDraft(
  deps: EnsureDraftDeps,
): Promise<EnsureDraftResult> {
  if (deps.articleExists) {
    const slug = deps.getSlug().trim();
    if (!slug) return { ok: false };
    return { ok: true, slug, created: false };
  }

  const inFlight = deps.getInFlight();
  if (inFlight) {
    try {
      const slug = await inFlight;
      return { ok: true, slug, created: false };
    } catch {
      return { ok: false };
    }
  }

  const createPromise = deps.createDraft();
  deps.setInFlight(createPromise);
  try {
    const slug = await createPromise;
    if (!slug.trim()) return { ok: false };
    return { ok: true, slug, created: true };
  } catch (err) {
    if (err instanceof Error && err.message === "slug_taken") throw err;
    return { ok: false };
  } finally {
    deps.setInFlight(null);
  }
}

/** Placeholder titles so draft-friendly API accepts empty editor fields. */
export function titlesForAutoDraft(enTitle: string, ruTitle: string): {
  en: string;
  ru: string;
} {
  const en = enTitle.trim() || "Untitled material";
  const ru = ruTitle.trim() || enTitle.trim() || "Материал без названия";
  return { en, ru };
}

/**
 * Upload should only prepare a draft when the user actually selected files.
 * Cancelled file-picker → empty list → no ensure.
 */
export function shouldEnsureDraftForUpload(fileCount: number): boolean {
  return fileCount > 0;
}
