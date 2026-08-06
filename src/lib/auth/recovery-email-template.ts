/**
 * Recommended Supabase Auth Recovery email template for Phase A.
 *
 * resetPasswordForEmail(email, {
 *   redirectTo: `${canonicalOrigin}/auth/confirm/employee` // or .../client
 * })
 *
 * {{ .RedirectTo }} is the absolute URL WITHOUT a query string.
 * Append token params with a single `?` — do not nest another `?`.
 *
 * Correct:
 *   {{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery
 *   → https://app.example/auth/confirm/employee?token_hash=...&type=recovery
 *
 * Incorrect (duplicates / breaks if RedirectTo already has ?):
 *   {{ .RedirectTo }}?next=...&token_hash=...
 *   {{ .SiteURL }}/auth/confirm?token_hash=...&next={{ .RedirectTo }}
 *
 * Add both confirm URLs to Supabase Redirect URLs allowlist.
 */
export const SPIORA_RECOVERY_EMAIL_TEMPLATE_HTML = `<h2>Reset your password</h2>
<p>We received a request to reset your Spiora password.</p>
<p><a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery">Reset password</a></p>
<p>If you did not request this, you can ignore this email.</p>`;

export function assertRecoveryRedirectToHasNoQuery(redirectTo: string): boolean {
  try {
    const url = new URL(redirectTo);
    return url.search === "" && url.hash === "";
  } catch {
    return false;
  }
}

export function buildRecoveryEmailHref(
  redirectTo: string,
  tokenHash: string,
): string | null {
  if (!assertRecoveryRedirectToHasNoQuery(redirectTo)) return null;
  const url = new URL(redirectTo);
  url.searchParams.set("token_hash", tokenHash);
  url.searchParams.set("type", "recovery");
  return url.toString();
}
