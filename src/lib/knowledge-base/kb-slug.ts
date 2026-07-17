/** Generate URL-safe slug from a title (Latin/Cyrillic words → kebab-case). */
export function slugifyKbTitle(title: string): string {
  const normalized = title
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return (normalized.slice(0, 80) || "article").replace(/-+$/g, "");
}

export function suggestDuplicateSlug(baseSlug: string, attempt = 1): string {
  if (attempt <= 1) return `${baseSlug}-copy`;
  return `${baseSlug}-copy-${attempt}`;
}
