"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { AppLocale } from "@/i18n/config";
import type {
  DriveKbItem,
  DriveKbListing,
} from "@/lib/google-drive/kb-drive";
import type {
  KbArticleDetail,
  KbArticleListItem,
  KbListingResponse,
} from "@/lib/knowledge-base/types";
import { buildKbListQuery } from "@/lib/knowledge-base/kb-locale";
import { Card } from "@/components/ui/Card";
import { KbArticleMarkdown } from "./KbArticleMarkdown";
import { KbAttachmentsPanel } from "./KbAttachmentsPanel";
import { KbTablesPanel } from "./KbTablesPanel";

import styles from "./KnowledgeBaseView.module.css";

type ApiResponse = KbListingResponse & Partial<Omit<DriveKbListing, "source">>;

function isArticleListing(data: ApiResponse): boolean {
  return (
    data.source === "demo" ||
    data.source === "embedded" ||
    data.source === "postgresql"
  );
}

function isDriveListing(data: ApiResponse): boolean {
  return data.source === "google_drive";
}

function buildQueryString(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export function KnowledgeBaseView() {
  const t = useTranslations("knowledgeBase");
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const searchParams = useSearchParams();

  const [listing, setListing] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState(searchParams.get("q") ?? "");
  const [searchError, setSearchError] = useState(false);
  const [currentFolderId, setCurrentFolderId] = useState<string | undefined>(
    searchParams.get("folderId") ?? undefined,
  );
  const [history, setHistory] = useState<string[]>([]);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!addMenuOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      const root = addMenuRef.current;
      if (!root) return;
      if (event.target instanceof Node && !root.contains(event.target)) {
        setAddMenuOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAddMenuOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [addMenuOpen]);

  const category = searchParams.get("category") ?? undefined;
  const tag = searchParams.get("tag") ?? undefined;
  const articleSlug = searchParams.get("article") ?? undefined;
  const query = searchParams.get("q") ?? undefined;
  const statusFilter = searchParams.get("status") ?? undefined;

  const updateRoute = useCallback(
    (next: Record<string, string | undefined>) => {
      router.replace(`/knowledge-base${buildQueryString(next)}`, {
        scroll: false,
      });
    },
    [router],
  );

  const fetchListing = useCallback(async () => {
    setLoading(true);
    setSearchError(false);
    try {
      const qs = buildKbListQuery({
        locale,
        q: query,
        category,
        tag,
        article: articleSlug,
        folderId: currentFolderId,
        status: statusFilter,
      });
      const res = await fetch(`/api/knowledge-base?${qs}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("fetch failed");
      const data = (await res.json()) as ApiResponse;
      setListing(data);
    } catch {
      setListing(null);
      setSearchError(true);
    } finally {
      setLoading(false);
    }
  }, [locale, query, category, tag, articleSlug, currentFolderId, statusFilter]);

  useEffect(() => {
    void fetchListing();
  }, [fetchListing]);

  useEffect(() => {
    setSearchInput(query ?? "");
  }, [query]);

  const selectedArticle = useMemo(() => {
    if (!listing || !isArticleListing(listing)) return null;
    return listing.selectedArticle ?? null;
  }, [listing]);

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    updateRoute({
      q: searchInput.trim() || undefined,
      category,
      tag,
      article: undefined,
    });
  };

  const handleClearSearch = () => {
    setSearchInput("");
    updateRoute({ category, tag, article: articleSlug });
  };

  const handleCopyLink = async (slug: string) => {
    const url = `${window.location.origin}/knowledge-base?article=${encodeURIComponent(slug)}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* ignore */
    }
  };

  if (listing && isDriveListing(listing) && listing.source === "google_drive") {
    return (
      <DriveBrowserView
        listing={listing as DriveKbListing}
        loading={loading}
        locale={locale}
        currentFolderId={currentFolderId}
        history={history}
        onOpenFolder={(folderId) => {
          setHistory((prev) => [...prev, listing.folderId!]);
          setCurrentFolderId(folderId);
          updateRoute({ folderId });
        }}
        onGoRoot={() => {
          setHistory([]);
          setCurrentFolderId(undefined);
          updateRoute({});
        }}
        onGoUp={() => {
          if (!listing.parentId) {
            setHistory([]);
            setCurrentFolderId(undefined);
            updateRoute({});
            return;
          }
          setHistory((prev) => prev.slice(0, -1));
          setCurrentFolderId(listing.parentId ?? undefined);
          updateRoute({ folderId: listing.parentId ?? undefined });
        }}
        t={t}
      />
    );
  }

  const demoListing = listing && isArticleListing(listing) ? listing : null;
  const articles = demoListing?.articles ?? [];
  const categories = demoListing?.categories ?? [];
  const tags = demoListing?.tags ?? [];
  const canManage = demoListing?.canManage === true;

  return (
    <div className={styles.wrap}>
      <div className={styles.demoHeader}>
        {demoListing?.demo ? (
          <span className={styles.demoBadge}>{t("demoBadge")}</span>
        ) : null}
        <span className={styles.source}>
          {t(`sources.${demoListing?.source ?? "unconfigured"}`)}
        </span>
      </div>

      {canManage ? (
        <div className={styles.ownerToolbar}>
          <div className={styles.addMaterialWrap} ref={addMenuRef}>
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={() => setAddMenuOpen((v) => !v)}
            >
              <i className="fa-solid fa-plus" aria-hidden /> {t("actions.addMaterial")}
            </button>
            {addMenuOpen ? (
              <div className={styles.addMaterialMenu} role="menu">
                <Link
                  href="/knowledge-base/new"
                  className={styles.addMaterialItem}
                  role="menuitem"
                  onClick={() => setAddMenuOpen(false)}
                >
                  <span className={styles.addMaterialIcon} aria-hidden>
                    <i className="fa-solid fa-align-left" />
                  </span>
                  <span className={styles.addMaterialCopy}>
                    <span className={styles.addMaterialLabel}>{t("addMaterial.text")}</span>
                    <span className={styles.addMaterialHint}>{t("addMaterial.textHint")}</span>
                  </span>
                </Link>
                <Link
                  href="/knowledge-base/new?focus=files&intent=pdf"
                  className={styles.addMaterialItem}
                  role="menuitem"
                  onClick={() => setAddMenuOpen(false)}
                >
                  <span className={styles.addMaterialIcon} aria-hidden>
                    <i className="fa-solid fa-file-pdf" />
                  </span>
                  <span className={styles.addMaterialCopy}>
                    <span className={styles.addMaterialLabel}>{t("addMaterial.pdf")}</span>
                    <span className={styles.addMaterialHint}>{t("addMaterial.pdfHint")}</span>
                  </span>
                </Link>
                <Link
                  href="/knowledge-base/new?focus=files&intent=image"
                  className={styles.addMaterialItem}
                  role="menuitem"
                  onClick={() => setAddMenuOpen(false)}
                >
                  <span className={styles.addMaterialIcon} aria-hidden>
                    <i className="fa-solid fa-image" />
                  </span>
                  <span className={styles.addMaterialCopy}>
                    <span className={styles.addMaterialLabel}>{t("addMaterial.image")}</span>
                    <span className={styles.addMaterialHint}>{t("addMaterial.imageHint")}</span>
                  </span>
                </Link>
                <Link
                  href="/knowledge-base/new?focus=table&intent=table"
                  className={styles.addMaterialItem}
                  role="menuitem"
                  onClick={() => setAddMenuOpen(false)}
                >
                  <span className={styles.addMaterialIcon} aria-hidden>
                    <i className="fa-solid fa-table" />
                  </span>
                  <span className={styles.addMaterialCopy}>
                    <span className={styles.addMaterialLabel}>{t("addMaterial.table")}</span>
                    <span className={styles.addMaterialHint}>{t("addMaterial.tableHint")}</span>
                  </span>
                </Link>
                <Link
                  href="/knowledge-base/new?focus=files&intent=video"
                  className={styles.addMaterialItem}
                  role="menuitem"
                  onClick={() => setAddMenuOpen(false)}
                >
                  <span className={styles.addMaterialIcon} aria-hidden>
                    <i className="fa-solid fa-film" />
                  </span>
                  <span className={styles.addMaterialCopy}>
                    <span className={styles.addMaterialLabel}>{t("addMaterial.video")}</span>
                    <span className={styles.addMaterialHint}>{t("addMaterial.videoHint")}</span>
                  </span>
                </Link>
                <Link
                  href="/knowledge-base/new?focus=files&intent=audio"
                  className={styles.addMaterialItem}
                  role="menuitem"
                  onClick={() => setAddMenuOpen(false)}
                >
                  <span className={styles.addMaterialIcon} aria-hidden>
                    <i className="fa-solid fa-microphone" />
                  </span>
                  <span className={styles.addMaterialCopy}>
                    <span className={styles.addMaterialLabel}>{t("addMaterial.audio")}</span>
                    <span className={styles.addMaterialHint}>{t("addMaterial.audioHint")}</span>
                  </span>
                </Link>
                <Link
                  href="/knowledge-base/new?focus=files&intent=link"
                  className={styles.addMaterialItem}
                  role="menuitem"
                  onClick={() => setAddMenuOpen(false)}
                >
                  <span className={styles.addMaterialIcon} aria-hidden>
                    <i className="fa-solid fa-link" />
                  </span>
                  <span className={styles.addMaterialCopy}>
                    <span className={styles.addMaterialLabel}>{t("addMaterial.link")}</span>
                    <span className={styles.addMaterialHint}>{t("addMaterial.linkHint")}</span>
                  </span>
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <form className={styles.searchRow} onSubmit={handleSearchSubmit}>
        <label className={styles.searchLabel} htmlFor="kb-search">
          {t("search.label")}
        </label>
        <div className={styles.searchFieldWrap}>
          <input
            id="kb-search"
            className={styles.searchInput}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t("search.placeholder")}
          />
          {searchInput ? (
            <button
              type="button"
              className={styles.clearBtn}
              onClick={handleClearSearch}
            >
              {t("search.clear")}
            </button>
          ) : null}
          <button type="submit" className={styles.searchBtn}>
            <i className="fa-solid fa-magnifying-glass" aria-hidden />
          </button>
        </div>
        <p className={styles.searchHint}>{t("search.hint")}</p>
      </form>

      <div className={styles.demoLayout}>
        <aside className={styles.sidebar}>
          <div className={styles.filterBlock}>
            <p className={styles.filterTitle}>{t("filters.categoryLabel")}</p>
            <button
              type="button"
              className={`${styles.filterBtn} ${!category ? styles.filterActive : ""}`}
              onClick={() =>
                updateRoute({ q: query, tag, status: statusFilter, article: undefined })
              }
            >
              {t("filters.allCategories")}
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`${styles.filterBtn} ${category === cat.id ? styles.filterActive : ""}`}
                onClick={() =>
                  updateRoute({
                    q: query,
                    category: cat.id,
                    tag: undefined,
                    status: statusFilter,
                    article: undefined,
                  })
                }
              >
                {cat.label}
                <span className={styles.filterCount}>{cat.count}</span>
              </button>
            ))}
          </div>

          <div className={styles.filterBlock}>
            <p className={styles.filterTitle}>{t("filters.tagLabel")}</p>
            <button
              type="button"
              className={`${styles.filterBtn} ${!tag ? styles.filterActive : ""}`}
              onClick={() =>
                updateRoute({ q: query, category, status: statusFilter, article: undefined })
              }
            >
              {t("filters.allTags")}
            </button>
            {tags.map((tagItem) => (
              <button
                key={tagItem.id}
                type="button"
                className={`${styles.filterBtn} ${tag === tagItem.id ? styles.filterActive : ""}`}
                onClick={() =>
                  updateRoute({
                    q: query,
                    category,
                    tag: tagItem.id,
                    status: statusFilter,
                    article: undefined,
                  })
                }
              >
                {tagItem.label}
              </button>
            ))}
          </div>

          {canManage ? (
            <div className={styles.filterBlock}>
              <p className={styles.filterTitle}>{t("editor.status.draft")}</p>
              {(
                [
                  ["published", t("editor.filters.published")],
                  ["draft", t("editor.filters.draft")],
                  ["archived", t("editor.filters.archived")],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={`${styles.filterBtn} ${statusFilter === value ? styles.filterActive : ""}`}
                  onClick={() =>
                    updateRoute({
                      q: query,
                      category,
                      tag,
                      status: statusFilter === value ? undefined : value,
                      article: undefined,
                    })
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}

          {demoListing?.uploadDisabled ? (
            <p className={styles.uploadDisabled}>{t("upload.disabled")}</p>
          ) : null}
        </aside>

        <main className={styles.mainPanel}>
          {category || selectedArticle ? (
            <nav className={styles.breadcrumb} aria-label={t("breadcrumbAria")}>
              <button
                type="button"
                className={styles.crumbBtn}
                onClick={() =>
                  updateRoute({
                    q: query,
                    category: undefined,
                    tag,
                    article: undefined,
                  })
                }
              >
                {t("breadcrumbRoot")}
              </button>
              {category ? (
                <>
                  <span className={styles.crumbSep}>/</span>
                  <button
                    type="button"
                    className={styles.crumbBtn}
                    onClick={() =>
                      updateRoute({ q: query, category, tag, article: undefined })
                    }
                  >
                    {categories.find((c) => c.id === category)?.label ?? category}
                  </button>
                </>
              ) : null}
              {selectedArticle ? (
                <>
                  <span className={styles.crumbSep}>/</span>
                  <span>{selectedArticle.title}</span>
                </>
              ) : null}
            </nav>
          ) : null}

          {loading ? (
            <p className={styles.meta}>{t("loading.list")}</p>
          ) : searchError ? (
            <p className={styles.emptyState}>{t("search.unavailable")}</p>
          ) : demoListing?.source === "unconfigured" ? (
            <p className={styles.emptyState}>
              {demoListing.errorMessage ?? t("empty.unconfigured")}
            </p>
          ) : selectedArticle ? (
            <ArticleDetailView
              article={selectedArticle}
              canManage={canManage}
              onBack={() =>
                updateRoute({ q: query, category, tag, status: statusFilter, article: undefined })
              }
              onCopyLink={handleCopyLink}
              t={t}
            />
          ) : (
            <>
              <p className={styles.meta}>
                {query
                  ? t("search.resultsCount", { count: articles.length })
                  : null}
              </p>
              {articles.length === 0 ? (
                <p className={styles.emptyState}>
                  {query ? t("search.noResults") : t("empty.selectArticle")}
                </p>
              ) : (
                <div className={styles.articleList}>
                  {articles.map((article) => (
                    <ArticleCard
                      key={article.id}
                      article={article}
                      canManage={canManage}
                      onOpen={() =>
                        updateRoute({
                          q: query,
                          category,
                          tag,
                          status: statusFilter,
                          article: article.slug,
                        })
                      }
                      onRefresh={() => void fetchListing()}
                      t={t}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function ArticleCard({
  article,
  canManage,
  onOpen,
  onRefresh,
  t,
}: {
  article: KbArticleListItem;
  canManage: boolean;
  onOpen: () => void;
  onRefresh: () => void;
  t: ReturnType<typeof useTranslations<"knowledgeBase">>;
}) {
  const router = useRouter();

  const quickPublish = async () => {
    await fetch(`/api/knowledge-base/${encodeURIComponent(article.slug)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "publish" }),
    });
    onRefresh();
  };

  const quickArchive = async () => {
    if (!window.confirm(t("confirm.archiveBody"))) return;
    await fetch(`/api/knowledge-base/${encodeURIComponent(article.slug)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "archive" }),
    });
    onRefresh();
  };

  const duplicate = async () => {
    const res = await fetch(
      `/api/knowledge-base/${encodeURIComponent(article.slug)}/duplicate`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
    );
    if (!res.ok) return;
    const data = (await res.json()) as { slug: string };
    router.push(`/knowledge-base/edit/${encodeURIComponent(data.slug)}`);
  };

  return (
    <Card className={styles.articleCard}>
      <div className={styles.articleCardHead}>
        <span className={styles.articleCategory}>{article.categoryLabel}</span>
        <span className={styles.articleDate}>
          {article.externalUrl ? (
            <span className={styles.linkBadge}>{t("link.badge")}</span>
          ) : null}{" "}
          {article.status && canManage ? (
            <span className={`${styles.statusChip} ${styles[`statusChip_${article.status}`]}`}>
              {t(`editor.status.${article.status}` as "editor.status.draft")}
            </span>
          ) : null}{" "}
          {t("article.updated", { date: article.updatedAt })}
        </span>
      </div>
      <h3 className={styles.articleTitle}>{article.title}</h3>
      <p className={styles.articleSummary}>{article.summary}</p>
      <div className={styles.tagRow}>
        {article.tagLabels.map((label) => (
          <span key={label} className={styles.tagChip}>
            {label}
          </span>
        ))}
      </div>
      <div className={styles.cardActions}>
        <button type="button" className={styles.primaryBtn} onClick={onOpen}>
          {t("actions.open")}
        </button>
        <button type="button" className={styles.linkBtn} onClick={onOpen}>
          {t("actions.preview")}
        </button>
        {canManage ? (
          <>
            <Link
              href={`/knowledge-base/edit/${encodeURIComponent(article.slug)}`}
              className={styles.linkBtn}
            >
              {t("actions.edit")}
            </Link>
            <button type="button" className={styles.linkBtn} onClick={() => void duplicate()}>
              {t("actions.duplicate")}
            </button>
            {article.status === "draft" ? (
              <button type="button" className={styles.linkBtn} onClick={() => void quickPublish()}>
                {t("actions.publish")}
              </button>
            ) : null}
            {article.status === "published" ? (
              <button type="button" className={styles.linkBtn} onClick={() => void quickArchive()}>
                {t("actions.archive")}
              </button>
            ) : null}
          </>
        ) : null}
      </div>
    </Card>
  );
}

function ArticleDetailView({
  article,
  canManage,
  onBack,
  onCopyLink,
  t,
}: {
  article: KbArticleDetail;
  canManage: boolean;
  onBack: () => void;
  onCopyLink: (slug: string) => void;
  t: ReturnType<typeof useTranslations<"knowledgeBase">>;
}) {
  return (
    <Card className={styles.articleDetail}>
      <div className={styles.detailToolbar}>
        <button type="button" className={styles.linkBtn} onClick={onBack}>
          <i className="fa-solid fa-arrow-left" aria-hidden /> {t("actions.back")}
        </button>
        <button
          type="button"
          className={styles.linkBtn}
          onClick={() => void onCopyLink(article.slug)}
        >
          {t("actions.copyLink")}
        </button>
        {canManage ? (
          <Link
            href={`/knowledge-base/edit/${encodeURIComponent(article.slug)}`}
            className={styles.linkBtn}
          >
            {t("actions.edit")}
          </Link>
        ) : null}
      </div>
      <p className={styles.detailMeta}>
        {t("article.updated", { date: article.updatedAt })} · {t("article.author")}:{" "}
        {article.authorName}
      </p>
      <h2 className={styles.detailTitle}>{article.title}</h2>
      <p className={styles.detailSummary}>{article.summary}</p>
      {article.externalUrl ? (
        <p className={styles.externalLinkRow}>
          <a
            className={styles.primaryBtn}
            href={article.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("link.open")}
          </a>
          <span className={styles.meta}>{article.externalUrl}</span>
        </p>
      ) : null}
      <div className={styles.tagRow}>
        {article.tagLabels.map((label) => (
          <span key={label} className={styles.tagChip}>
            {label}
          </span>
        ))}
      </div>
      <KbArticleMarkdown content={article.content} />
      <KbAttachmentsPanel
        slug={article.slug}
        canManage={canManage}
      />
      <KbTablesPanel slug={article.slug} canManage={canManage} articlePersisted />
    </Card>
  );
}

function DriveBrowserView({
  listing,
  loading,
  currentFolderId,
  history,
  onOpenFolder,
  onGoRoot,
  onGoUp,
  t,
}: {
  listing: DriveKbListing;
  loading: boolean;
  locale: AppLocale;
  currentFolderId?: string;
  history: string[];
  onOpenFolder: (folderId: string) => void;
  onGoRoot: () => void;
  onGoUp: () => void;
  t: ReturnType<typeof useTranslations<"knowledgeBase">>;
}) {
  const rootUrl = `https://drive.google.com/drive/folders/${listing.rootFolderId}`;

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <nav className={styles.breadcrumb} aria-label={t("breadcrumbAria")}>
          <button type="button" className={styles.crumbBtn} onClick={onGoRoot}>
            {t("breadcrumbRoot")}
          </button>
          {history.map((folderId) => (
            <span key={folderId} className={styles.crumbSep}>
              /
              <button type="button" className={styles.crumbBtn}>
                …
              </button>
            </span>
          ))}
          {listing.folderName ? (
            <>
              <span className={styles.crumbSep}>/</span>
              <span>{listing.folderName}</span>
            </>
          ) : null}
        </nav>

        <div className={styles.actions}>
          {listing.parentId !== null ? (
            <button type="button" className={styles.linkBtn} onClick={onGoUp}>
              <i className="fa-solid fa-arrow-left" aria-hidden /> {t("actions.backToCategory")}
            </button>
          ) : null}
          <a
            href={rootUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.linkBtn}
          >
            <i className="fa-solid fa-folder-open" aria-hidden />
            {t("drive.openInDrive")}
          </a>
        </div>
      </div>

      <p className={styles.meta}>
        {loading
          ? t("loading.drive")
          : t("drive.itemsCount", { count: listing.items.length })}
        <span className={styles.source}>{t("sources.google_drive")}</span>
      </p>

      <p className={styles.hint}>{t("drive.hint")}</p>

      <Card className={styles.tableCard}>
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t("drive.tableName")}</th>
                <th>{t("drive.tableType")}</th>
                <th>{t("drive.tableModified")}</th>
                <th>{t("drive.tableOpen")}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className={styles.empty}>
                    {t("loading.drive")}
                  </td>
                </tr>
              ) : listing.source === "error" ? (
                <tr>
                  <td colSpan={4} className={styles.empty}>
                    {listing.errorMessage ?? t("errors.loadFailed")}
                  </td>
                </tr>
              ) : listing.items.length === 0 ? (
                <tr>
                  <td colSpan={4} className={styles.empty}>
                    {t("empty.folderEmpty")}
                  </td>
                </tr>
              ) : (
                listing.items.map((item: DriveKbItem) => (
                  <tr key={item.id}>
                    <td>
                      <div className={styles.nameCell}>
                        <i
                          className={
                            item.isFolder
                              ? `fa-solid fa-folder ${styles.nameIcon}`
                              : `fa-solid fa-file ${styles.nameIcon}`
                          }
                          aria-hidden
                        />
                        {item.isFolder ? (
                          <button
                            type="button"
                            className={styles.nameBtn}
                            onClick={() => onOpenFolder(item.id)}
                          >
                            {item.name}
                          </button>
                        ) : (
                          <a
                            href={item.webViewLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.fileLink}
                          >
                            {item.name}
                          </a>
                        )}
                      </div>
                    </td>
                    <td>{item.sizeLabel}</td>
                    <td>{item.modifiedTime}</td>
                    <td>
                      <a
                        href={item.webViewLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.openLink}
                      >
                        {t("actions.open")}
                        <i
                          className="fa-solid fa-arrow-up-right-from-square"
                          aria-hidden
                        />
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
