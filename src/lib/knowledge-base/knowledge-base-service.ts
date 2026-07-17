import "server-only";

import type { AppLocale } from "@/i18n/config";
import { translateKnowledgeBaseMessage } from "@/i18n/knowledge-base-messages";
import type { SessionUser } from "@/lib/auth/types";
import { isKbUploadDisabled } from "@/lib/knowledge-base/demo-guard";
import {
  isKnowledgeBaseEmbeddedFallbackEnabled,
  isKnowledgeBasePostgresEnabled,
  shouldPreferEmbeddedKnowledgeBase,
} from "@/lib/knowledge-base/config";
import {
  getEmbeddedKnowledgeBaseTextForAi,
  listEmbeddedKnowledgeBase,
} from "@/lib/knowledge-base/embedded-store";
import type {
  KbListingResponse,
  KbSearchParams,
} from "@/lib/knowledge-base/types";
import {
  sbCountKnowledgeBaseArticles,
  sbGetKnowledgeBaseTextForAi,
  sbListKnowledgeBase,
} from "@/lib/supabase/knowledge-base-repo";

function emptyPostgresListing(
  locale: AppLocale,
  params: KbSearchParams,
): KbListingResponse {
  return {
    demo: true,
    source: "postgresql",
    uploadDisabled: isKbUploadDisabled(),
    readOnly: false,
    categories: [],
    tags: [],
    articles: [],
    searchQuery: params.q,
    categoryFilter: params.category as KbListingResponse["categoryFilter"],
    tagFilter: params.tag,
    errorMessage: translateKnowledgeBaseMessage(locale, "empty.unconfigured"),
    requestedLocale: locale,
    resolvedLocale: locale,
    fallbackUsed: false,
  };
}

function withListingFlags(
  listing: KbListingResponse,
  session: SessionUser | null,
): KbListingResponse {
  const canManage =
    session?.role === "owner" && isKnowledgeBasePostgresEnabled();
  const fromPostgres = listing.source === "postgresql";
  return {
    ...listing,
    canManage,
    uploadDisabled: isKbUploadDisabled(),
    readOnly: fromPostgres ? !canManage : listing.readOnly,
  };
}

export async function listKnowledgeBase(
  locale: AppLocale,
  params: KbSearchParams,
  session: SessionUser | null,
): Promise<KbListingResponse> {
  if (isKnowledgeBasePostgresEnabled()) {
    try {
      const count = await sbCountKnowledgeBaseArticles();
      if (count > 0) {
        const listing = await sbListKnowledgeBase(locale, params, {
          includeDrafts: session?.role === "owner",
        });
        return withListingFlags(listing, session);
      }

      if (isKnowledgeBaseEmbeddedFallbackEnabled()) {
        return withListingFlags(listEmbeddedKnowledgeBase(locale, params), session);
      }

      return withListingFlags(emptyPostgresListing(locale, params), session);
    } catch (error) {
      console.error("[knowledge-base] postgres listing failed", error);
      if (isKnowledgeBaseEmbeddedFallbackEnabled()) {
        return withListingFlags(listEmbeddedKnowledgeBase(locale, params), session);
      }
      return {
        ...withListingFlags(emptyPostgresListing(locale, params), session),
        source: "error",
        errorMessage: translateKnowledgeBaseMessage(locale, "errors.loadFailed"),
      };
    }
  }

  if (shouldPreferEmbeddedKnowledgeBase()) {
    return withListingFlags(listEmbeddedKnowledgeBase(locale, params), session);
  }

  return withListingFlags(listEmbeddedKnowledgeBase(locale, params), session);
}

export async function getKnowledgeBaseTextForAi(
  locale: AppLocale,
  userQuery: string,
): Promise<string> {
  if (isKnowledgeBasePostgresEnabled()) {
    try {
      const count = await sbCountKnowledgeBaseArticles();
      if (count > 0) {
        return sbGetKnowledgeBaseTextForAi(locale, userQuery);
      }
    } catch (error) {
      console.error("[knowledge-base] postgres AI context failed", error);
    }
  }

  if (
    isKnowledgeBaseEmbeddedFallbackEnabled() ||
    shouldPreferEmbeddedKnowledgeBase()
  ) {
    return getEmbeddedKnowledgeBaseTextForAi(locale, userQuery);
  }

  return translateKnowledgeBaseMessage(locale, "empty.unconfigured");
}

export function shouldUseDemoKnowledgeBase(): boolean {
  return (
    shouldPreferEmbeddedKnowledgeBase() ||
    (isKnowledgeBasePostgresEnabled() && isKnowledgeBaseEmbeddedFallbackEnabled())
  );
}
