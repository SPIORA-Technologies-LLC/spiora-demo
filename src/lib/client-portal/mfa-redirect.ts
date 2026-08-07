import { withClientPortalEntrySplash } from "./entry-splash";

function isSafeClientPath(path: string): boolean {
  if (!path.startsWith("/")) return false;
  if (path.startsWith("//")) return false;
  if (path.includes("\\")) return false;
  if (path.includes("://")) return false;
  return true;
}

/** Safe client-plane destination after MFA challenge. */
export function resolveClientPostMfaPath(nextPath: string): string {
  const fallback = withClientPortalEntrySplash("/client");
  const trimmed = nextPath.trim();
  if (!trimmed) return fallback;
  if (!isSafeClientPath(trimmed)) return fallback;
  if (trimmed !== "/client" && !trimmed.startsWith("/client/")) {
    return fallback;
  }
  if (
    trimmed.startsWith("/client/mfa/") ||
    trimmed === "/client/login" ||
    trimmed.startsWith("/client/login/")
  ) {
    return fallback;
  }
  return withClientPortalEntrySplash(trimmed);
}
