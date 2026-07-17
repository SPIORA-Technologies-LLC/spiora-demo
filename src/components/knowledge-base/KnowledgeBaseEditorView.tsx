"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AppLocale } from "@/i18n/config";
import {
  translateKnowledgeBaseCategory,
  translateKnowledgeBaseTag,
} from "@/i18n/knowledge-base-messages";
import { KbArticleMarkdown } from "@/components/knowledge-base/KbArticleMarkdown";
import { Card } from "@/components/ui/Card";
import type {
  KbArticleStatus,
  KbCategoryId,
  KbEditorArticle,
} from "@/lib/knowledge-base/types";
import { slugifyKbTitle } from "@/lib/knowledge-base/kb-slug";
import type { KbAiDraftResult } from "@/lib/knowledge-base/kb-ai-draft";

import styles from "./KnowledgeBaseView.module.css";

const CATEGORIES: KbCategoryId[] = [
  "company-policies",
  "client-workflow",
  "document-management",
  "team-onboarding",
  "ai-automation",
];

const TAG_OPTIONS = [
  "onboarding",
  "clients",
  "workflow",
  "documents",
  "templates",
  "communication",
  "compliance",
  "tasks",
  "calendar",
  "security",
  "ai",
  "reporting",
] as const;

const AUTHORS = [
  "olivia-bennett",
  "daniel-cooper",
  "emma-wilson",
  "lucas-martin",
] as const;

type LocaleBlock = { title: string; summary: string; content: string };

type EditorForm = {
  slug: string;
  categoryId: KbCategoryId;
  tagKeys: string[];
  authorKey: string;
  status: KbArticleStatus;
  en: LocaleBlock;
  ru: LocaleBlock;
};

type EditorMode = "create" | "edit";

function emptyForm(): EditorForm {
  return {
    slug: "",
    categoryId: "company-policies",
    tagKeys: [],
    authorKey: "olivia-bennett",
    status: "draft",
    en: { title: "", summary: "", content: "" },
    ru: { title: "", summary: "", content: "" },
  };
}

function fromEditorArticle(article: KbEditorArticle): EditorForm {
  return {
    slug: article.slug,
    categoryId: article.categoryId,
    tagKeys: article.tagKeys,
    authorKey: article.authorKey,
    status: article.status,
    en: article.translations.en,
    ru: article.translations.ru,
  };
}

function toPayload(form: EditorForm, status: "draft" | "published") {
  return {
    slug: form.slug,
    categoryId: form.categoryId,
    tagKeys: form.tagKeys,
    authorKey: form.authorKey,
    status,
    translations: [
      { locale: "en" as const, ...form.en },
      { locale: "ru" as const, ...form.ru },
    ],
  };
}

export function KnowledgeBaseEditorView({
  mode,
  slug: initialSlug,
}: {
  mode: EditorMode;
  slug?: string;
}) {
  const t = useTranslations("knowledgeBase");
  const uiLocale = useLocale() as AppLocale;
  const router = useRouter();

  const [form, setForm] = useState<EditorForm>(emptyForm);
  const [slugLocked, setSlugLocked] = useState(false);
  const [slugManual, setSlugManual] = useState(false);
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewLocale, setPreviewLocale] = useState<"en" | "ru">("en");
  const [showPreview, setShowPreview] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const isPublished = form.status === "published";
  const isArchived = form.status === "archived";
  const slugEditable = !isPublished && !slugLocked;

  useEffect(() => {
    if (mode !== "edit" || !initialSlug) return;
    setLoading(true);
    void fetch(`/api/knowledge-base/${encodeURIComponent(initialSlug)}/editor`)
      .then(async (res) => {
        if (!res.ok) throw new Error("load failed");
        const data = (await res.json()) as { article: KbEditorArticle };
        setForm(fromEditorArticle(data.article));
        setSlugLocked(data.article.status === "published");
      })
      .catch(() => setError(t("errors.loadFailed")))
      .finally(() => setLoading(false));
  }, [mode, initialSlug, t]);

  const updateEnTitle = useCallback(
    (title: string) => {
      setForm((prev) => {
        const next = { ...prev, en: { ...prev.en, title } };
        if (!slugManual && mode === "create" && !slugLocked) {
          next.slug = slugifyKbTitle(title);
        }
        return next;
      });
    },
    [slugManual, mode, slugLocked],
  );

  const toggleTag = (tag: string) => {
    setForm((prev) => ({
      ...prev,
      tagKeys: prev.tagKeys.includes(tag)
        ? prev.tagKeys.filter((t) => t !== tag)
        : [...prev.tagKeys, tag],
    }));
  };

  const saveDraft = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = toPayload(form, "draft");
      const res =
        mode === "create"
          ? await fetch("/api/knowledge-base", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            })
          : await fetch(`/api/knowledge-base/${encodeURIComponent(form.slug)}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "update",
                categoryId: form.categoryId,
                tagKeys: form.tagKeys,
                authorKey: form.authorKey,
                status: "draft",
                translations: [
                  { locale: "en", ...form.en },
                  { locale: "ru", ...form.ru },
                ],
              }),
            });

      if (res.status === 409) {
        setError(t("editor.errors.slugTaken"));
        return;
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          code?: string;
          error?: string;
        } | null;
        setError(
          data?.code
            ? `${t("errors.saveFailed")} (${data.code})`
            : t("errors.saveFailed"),
        );
        return;
      }

      if (mode === "create") {
        const data = (await res.json()) as { article: { slug: string } };
        router.replace(`/knowledge-base/edit/${encodeURIComponent(data.article.slug)}`);
        return;
      }
      router.push("/knowledge-base");
    } catch {
      setError(t("errors.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const publish = async () => {
    setSaving(true);
    setError(null);
    try {
      if (mode === "create") {
        const res = await fetch("/api/knowledge-base", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(toPayload(form, "published")),
        });
        if (!res.ok) throw new Error("publish failed");
        router.push("/knowledge-base");
        return;
      }

      const res = await fetch(`/api/knowledge-base/${encodeURIComponent(form.slug)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "publish",
          categoryId: form.categoryId,
          tagKeys: form.tagKeys,
          authorKey: form.authorKey,
          translations: [
            { locale: "en", ...form.en },
            { locale: "ru", ...form.ru },
          ],
        }),
      });
      if (!res.ok) throw new Error("publish failed");
      router.push("/knowledge-base");
    } catch {
      setError(t("errors.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const archive = async () => {
    if (!window.confirm(t("confirm.archiveBody"))) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/knowledge-base/${encodeURIComponent(form.slug)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "archive" }),
      });
      if (!res.ok) throw new Error("archive failed");
      router.push("/knowledge-base?status=archived");
    } catch {
      setError(t("errors.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const runAiDraft = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/knowledge-base/ai-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: aiPrompt }),
      });
      if (!res.ok) throw new Error("ai failed");
      const data = (await res.json()) as { draft: KbAiDraftResult };
      setForm((prev) => ({
        ...prev,
        slug: mode === "create" && !slugManual ? data.draft.slug : prev.slug,
        categoryId: data.draft.categoryId,
        tagKeys: data.draft.tagKeys,
        authorKey: data.draft.authorKey,
        en: data.draft.translations.en,
        ru: data.draft.translations.ru,
        status: "draft",
      }));
      setAiOpen(false);
      setAiPrompt("");
    } catch {
      setError(t("editor.errors.aiFailed"));
    } finally {
      setAiLoading(false);
    }
  };

  const statusLabel = useMemo(() => {
    if (form.status === "published") return t("editor.status.published");
    if (form.status === "archived") return t("editor.status.archived");
    return t("editor.status.draft");
  }, [form.status, t]);

  if (loading) {
    return <p className={styles.meta}>{t("loading.article")}</p>;
  }

  return (
    <div className={styles.editorWrap}>
      <div className={styles.editorToolbar}>
        <Link href="/knowledge-base" className={styles.linkBtn}>
          <i className="fa-solid fa-arrow-left" aria-hidden /> {t("actions.back")}
        </Link>
        <span className={`${styles.statusBadge} ${styles[`status_${form.status}`]}`}>
          {statusLabel}
        </span>
        <div className={styles.editorToolbarActions}>
          <button
            type="button"
            className={styles.linkBtn}
            onClick={() => setShowPreview((v) => !v)}
          >
            {t("editor.preview")}
          </button>
          {mode === "create" ? (
            <button
              type="button"
              className={styles.linkBtn}
              onClick={() => setAiOpen(true)}
            >
              {t("editor.aiCreate")}
            </button>
          ) : null}
          {!isArchived ? (
            <>
              <button
                type="button"
                className={styles.linkBtn}
                disabled={saving}
                onClick={() => void saveDraft()}
              >
                {t("editor.saveDraft")}
              </button>
              <button
                type="button"
                className={styles.primaryBtn}
                disabled={saving}
                onClick={() => void publish()}
              >
                {t("editor.publish")}
              </button>
            </>
          ) : null}
          {mode === "edit" && form.status === "published" ? (
            <button
              type="button"
              className={styles.linkBtn}
              disabled={saving}
              onClick={() => void archive()}
            >
              {t("editor.archive")}
            </button>
          ) : null}
        </div>
      </div>

      {error ? <p className={styles.editorError}>{error}</p> : null}

      {showPreview ? (
        <Card className={styles.editorPreview}>
          <div className={styles.previewTabs}>
            <button
              type="button"
              className={previewLocale === "en" ? styles.filterActive : styles.filterBtn}
              onClick={() => setPreviewLocale("en")}
            >
              EN
            </button>
            <button
              type="button"
              className={previewLocale === "ru" ? styles.filterActive : styles.filterBtn}
              onClick={() => setPreviewLocale("ru")}
            >
              RU
            </button>
          </div>
          <h2 className={styles.detailTitle}>{form[previewLocale].title}</h2>
          <p className={styles.detailSummary}>{form[previewLocale].summary}</p>
          <KbArticleMarkdown content={form[previewLocale].content} />
        </Card>
      ) : null}

      <div className={styles.editorGrid}>
        <Card className={styles.editorPanel}>
          <h3 className={styles.editorSectionTitle}>{t("editor.sections.main")}</h3>
          <label className={styles.editorLabel}>
            {t("editor.fields.primaryTitle")}
            <input
              className={styles.editorInput}
              value={form.en.title}
              onChange={(e) => updateEnTitle(e.target.value)}
              disabled={isArchived}
            />
          </label>
          <label className={styles.editorLabel}>
            Slug
            <input
              className={styles.editorInput}
              value={form.slug}
              disabled={!slugEditable || isArchived}
              onChange={(e) => {
                setSlugManual(true);
                setForm((prev) => ({ ...prev, slug: e.target.value }));
              }}
            />
          </label>
          <label className={styles.editorLabel}>
            {t("article.category")}
            <select
              className={styles.editorSelect}
              value={form.categoryId}
              disabled={isArchived}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  categoryId: e.target.value as KbCategoryId,
                }))
              }
            >
              {CATEGORIES.map((id) => (
                <option key={id} value={id}>
                  {translateKnowledgeBaseCategory(uiLocale, id)}
                </option>
              ))}
            </select>
          </label>
          <p className={styles.editorLabel}>{t("article.tags")}</p>
          <div className={styles.tagPicker}>
            {TAG_OPTIONS.map((tag) => (
              <button
                key={tag}
                type="button"
                className={`${styles.tagChip} ${form.tagKeys.includes(tag) ? styles.tagChipActive : ""}`}
                disabled={isArchived}
                onClick={() => toggleTag(tag)}
              >
                {translateKnowledgeBaseTag(uiLocale, tag)}
              </button>
            ))}
          </div>
          <label className={styles.editorLabel}>
            {t("article.author")}
            <select
              className={styles.editorSelect}
              value={form.authorKey}
              disabled={isArchived}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, authorKey: e.target.value }))
              }
            >
              {AUTHORS.map((id) => (
                <option key={id} value={id}>
                  {t(`authors.${id}`)}
                </option>
              ))}
            </select>
          </label>
        </Card>

        {(["en", "ru"] as const).map((locale) => (
          <Card key={locale} className={styles.editorPanel}>
            <h3 className={styles.editorSectionTitle}>
              {locale === "en" ? t("editor.sections.en") : t("editor.sections.ru")}
            </h3>
            <label className={styles.editorLabel}>
              {t("editor.fields.title")}
              <input
                className={styles.editorInput}
                value={form[locale].title}
                disabled={isArchived}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    [locale]: { ...prev[locale], title: e.target.value },
                  }))
                }
              />
            </label>
            <label className={styles.editorLabel}>
              Summary
              <textarea
                className={styles.editorTextarea}
                rows={2}
                value={form[locale].summary}
                disabled={isArchived}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    [locale]: { ...prev[locale], summary: e.target.value },
                  }))
                }
              />
            </label>
            <label className={styles.editorLabel}>
              Markdown
              <textarea
                className={styles.editorTextarea}
                rows={14}
                value={form[locale].content}
                disabled={isArchived}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    [locale]: { ...prev[locale], content: e.target.value },
                  }))
                }
              />
            </label>
          </Card>
        ))}
      </div>

      {aiOpen ? (
        <div className={styles.aiModalBackdrop} role="presentation" onClick={() => setAiOpen(false)}>
          <div
            className={styles.aiModal}
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className={styles.editorSectionTitle}>{t("editor.aiCreate")}</h3>
            <p className={styles.hint}>{t("editor.aiHint")}</p>
            <textarea
              className={styles.editorTextarea}
              rows={4}
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder={t("editor.aiPlaceholder")}
            />
            <div className={styles.cardActions}>
              <button type="button" className={styles.linkBtn} onClick={() => setAiOpen(false)}>
                {t("confirm.cancel")}
              </button>
              <button
                type="button"
                className={styles.primaryBtn}
                disabled={aiLoading}
                onClick={() => void runAiDraft()}
              >
                {aiLoading ? t("editor.aiGenerating") : t("editor.aiGenerate")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
