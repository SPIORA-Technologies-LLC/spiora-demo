import { isSafeHttpUrl } from "@/lib/knowledge-base/table-limits";

export const MAX_KB_LINKS_PER_ARTICLE = 20;
export const MAX_KB_LINK_LABEL_CHARS = 200;
export const MAX_KB_LINK_URL_CHARS = 2000;

export function normalizeKbLinkUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > MAX_KB_LINK_URL_CHARS) return null;
  if (!isSafeHttpUrl(trimmed)) return null;
  return trimmed;
}

export function normalizeKbLinkLabel(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_KB_LINK_LABEL_CHARS);
}
