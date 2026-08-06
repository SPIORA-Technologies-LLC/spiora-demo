const SECRET_KEY_RE =
  /^(password|token|code|cookie|authorization|secret|api[_-]?key|refresh[_-]?token|access[_-]?token)$/i;

/**
 * Recursively remove secret-bearing keys from audit metadata.
 */
export function scrubAuditMetadata(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => scrubAuditMetadata(item));
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(
      value as Record<string, unknown>,
    )) {
      if (SECRET_KEY_RE.test(key)) continue;
      out[key] = scrubAuditMetadata(nested);
    }
    return out;
  }
  return value;
}

export type SecurityAuditAction =
  | "password_change_success"
  | "password_change_failure"
  | "password_reset_requested"
  | "password_reset_completed"
  | "password_reset_failed"
  | "sessions_revoked"
  | "google_oauth_started"
  | "google_oauth_success"
  | "google_oauth_denied"
  | "google_oauth_failed";

export type SecurityAuditAudience = "employee" | "client" | "unknown";

function isTruthyFlag(
  env: NodeJS.ProcessEnv,
  name: string,
): boolean {
  return env[name]?.trim().toLowerCase() === "true";
}

/** Umbrella: enables password + OAuth audit. */
export function isSecurityAuditAuthEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return isTruthyFlag(env, "SPIORA_SECURITY_AUDIT_AUTH");
}

export function isSecurityAuditPasswordEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return (
    isSecurityAuditAuthEnabled(env) ||
    isTruthyFlag(env, "SPIORA_SECURITY_AUDIT_PASSWORD")
  );
}

export function isSecurityAuditOauthEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return (
    isSecurityAuditAuthEnabled(env) ||
    isTruthyFlag(env, "SPIORA_SECURITY_AUDIT_OAUTH")
  );
}

function isGoogleOAuthAuditAction(action: SecurityAuditAction): boolean {
  return (
    action === "google_oauth_started" ||
    action === "google_oauth_success" ||
    action === "google_oauth_denied" ||
    action === "google_oauth_failed"
  );
}

export type SecurityAuditInsert = {
  action: SecurityAuditAction;
  audience: SecurityAuditAudience;
  actorUserId?: string | null;
  targetUserId?: string | null;
  truncatedClientIp?: string | null;
  ipHash?: string | null;
  emailHash?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
};

/**
 * Insert audit row when the matching audit flag is enabled (041/042 applied).
 * Returns ok:false on failure — callers must not fail user-visible auth success.
 */
export async function insertSecurityAuditEvent(
  input: SecurityAuditInsert,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const enabled = isGoogleOAuthAuditAction(input.action)
    ? isSecurityAuditOauthEnabled()
    : isSecurityAuditPasswordEnabled();
  if (!enabled) {
    return { ok: false, reason: "audit_disabled" };
  }

  try {
    const { isSupabaseConfigured } = await import("@/lib/supabase/config");
    if (!isSupabaseConfigured()) {
      return { ok: false, reason: "supabase_unconfigured" };
    }
    const { getSupabaseAdmin } = await import("@/lib/supabase/server");
    const sb = getSupabaseAdmin();
    const metadata = scrubAuditMetadata(input.metadata ?? {}) as Record<
      string,
      unknown
    >;

    const { error } = await sb.from("security_audit_events").insert({
      action: input.action,
      audience: input.audience,
      actor_user_id: input.actorUserId ?? null,
      target_user_id: input.targetUserId ?? null,
      truncated_client_ip: input.truncatedClientIp ?? null,
      ip_hash: input.ipHash ?? null,
      email_hash: input.emailHash ?? null,
      user_agent: input.userAgent ?? null,
      metadata,
    });

    if (error) {
      return { ok: false, reason: "insert_failed" };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: "insert_exception" };
  }
}

/** Controlled monitoring without secrets — never log body/cookies/Authorization. */
export function reportSecurityAuditFailure(details: {
  action: SecurityAuditAction;
  audience: SecurityAuditAudience;
  reason: string;
}): void {
  console.error(
    "[security-audit] insert failed",
    JSON.stringify({
      action: details.action,
      audience: details.audience,
      reason: details.reason,
    }),
  );
}
