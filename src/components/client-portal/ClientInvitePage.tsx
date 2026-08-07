"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { Logo } from "@/components/ui/Logo";
import { normalizeName, toGivenName } from "@/lib/client-portal/display-name";
import { withClientPortalEntrySplash } from "@/lib/client-portal/entry-splash";
import {
  createSupabaseBrowserClient,
  isSupabaseBrowserConfigured,
} from "@/lib/supabase/browser";
import styles from "./ClientInvitePage.module.css";

type Preview =
  | {
      status: "valid";
      maskedEmail: string;
      firstName?: string | null;
      preferredLocale: string;
      expiresAt: string;
      serviceType: string | null;
    }
  | { status: "expired" }
  | { status: "revoked" }
  | { status: "accepted" }
  | { status: "invalid" };

type Props = { token: string };

/** Query fallback only — ignore corrupted messenger encodings like «Ивамот�%B». */
function firstNameFromQuery(): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("firstName") ?? params.get("name");
  if (!raw) return "";
  if (raw.includes("\uFFFD") || /%(?:$|[^0-9A-Fa-f]|[0-9A-Fa-f](?:$|[^0-9A-Fa-f]))/.test(raw)) {
    return "";
  }
  return toGivenName(raw) ?? "";
}

export function ClientInvitePage({ token }: Props) {
  const t = useTranslations("clientPortal.invite");
  const locale = useLocale();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/client/invite/${encodeURIComponent(token)}`,
        { cache: "no-store" },
      );
      const data = (await res.json()) as {
        preview?: Preview;
        error?: { code: string };
      };
      if (!res.ok || !data.preview) {
        setPreview({ status: "invalid" });
      } else {
        setPreview(data.preview);
        if (data.preview.status === "valid") {
          const fromServer = toGivenName(data.preview.firstName);
          const fromQuery = firstNameFromQuery();
          setFirstName(fromServer || fromQuery || "");
        }
      }
    } catch {
      setPreview({ status: "invalid" });
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function ensureFirstNameMetadata(name: string) {
    if (!name) return;
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.updateUser({ data: { first_name: name } });
  }

  async function acceptAfterAuth(nameForMeta?: string) {
    const cleaned = normalizeName(nameForMeta ?? firstName);
    if (cleaned) {
      try {
        await ensureFirstNameMetadata(cleaned);
      } catch {
        // non-fatal — greeting may fall back to questionnaire later
      }
    }

    const res = await fetch(
      `/api/client/invite/${encodeURIComponent(token)}/accept`,
      { method: "POST" },
    );
    const data = (await res.json()) as {
      redirectTo?: string;
      error?: { code: string; message: string };
    };
    if (!res.ok) {
      if (data.error?.code === "EMAIL_MISMATCH") {
        setError(t("errors.emailMismatch"));
      } else if (data.error?.code === "INVITATION_EXPIRED") {
        setError(t("errors.expired"));
      } else if (data.error?.code === "INVITATION_REVOKED") {
        setError(t("errors.revoked"));
      } else if (data.error?.code === "INVITATION_ACCEPTED") {
        setError(t("errors.accepted"));
      } else if (data.error?.code === "PORTAL_USER_EXISTS") {
        setError(t("errors.portalUserExists"));
      } else {
        setError(data.error?.message || t("errors.acceptFailed"));
      }
      return;
    }
    window.location.href = withClientPortalEntrySplash(
      data.redirectTo || "/client",
    );
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!isSupabaseBrowserConfigured()) {
      setError(t("errors.authUnavailable"));
      return;
    }

    const cleanedName = normalizeName(firstName);
    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: signErr } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });
      if (signErr) {
        setError(t("errors.authFailed"));
        return;
      }
      await acceptAfterAuth(cleanedName ?? undefined);
    } catch {
      setError(t("errors.acceptFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function onAcceptExisting() {
    setBusy(true);
    setError(null);
    try {
      await acceptAfterAuth();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.page} lang={locale}>
      <div className={styles.card}>
        <div className={styles.top}>
          <Logo size="md" />
          <LanguageSwitcher />
        </div>

        {loading ? <p className={styles.muted}>{t("loading")}</p> : null}

        {!loading && preview?.status === "valid" ? (
          <>
            <h1 className={styles.title}>{t("validTitle")}</h1>
            <p className={styles.line}>
              {t("emailLabel")}: <strong>{preview.maskedEmail}</strong>
            </p>
            <p className={styles.line}>
              {t("expiresLabel")}:{" "}
              {new Date(preview.expiresAt).toLocaleString(locale)}
            </p>
            <p className={styles.hint}>{t("passwordFromInvite")}</p>

            <form className={styles.form} onSubmit={(e) => void onSubmit(e)}>
              <label className={styles.label}>
                {t("firstNameField")}
                <input
                  type="text"
                  autoComplete="given-name"
                  maxLength={80}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className={styles.input}
                />
              </label>
              <label className={styles.label}>
                {t("emailField")}
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={styles.input}
                />
              </label>
              <label className={styles.label}>
                {t("passwordField")}
                <span className={styles.passwordField}>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={8}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={styles.input}
                  />
                  <button
                    type="button"
                    className={styles.passwordToggle}
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={
                      showPassword ? t("hidePassword") : t("showPassword")
                    }
                    aria-pressed={showPassword}
                    disabled={busy}
                  >
                    {showPassword ? (
                      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                        <path
                          fill="currentColor"
                          d="M12 5c-7 0-10 7-10 7s3 7 10 7 10-7 10-7-3-7-10-7zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"
                        />
                        <path
                          fill="currentColor"
                          d="M3.3 3.3 20.7 20.7l-1.4 1.4L1.9 4.7z"
                        />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                        <path
                          fill="currentColor"
                          d="M12 5c-7 0-10 7-10 7s3 7 10 7 10-7 10-7-3-7-10-7zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"
                        />
                      </svg>
                    )}
                  </button>
                </span>
              </label>
              <p className={styles.hint}>{t("emailMustMatch")}</p>
              {error ? <p className={styles.error}>{error}</p> : null}
              <button type="submit" className={styles.primary} disabled={busy}>
                {busy ? t("working") : t("accept")}
              </button>
            </form>

            <button
              type="button"
              className={styles.secondary}
              disabled={busy}
              onClick={() => void onAcceptExisting()}
            >
              {t("alreadySignedIn")}
            </button>
          </>
        ) : null}

        {!loading && preview?.status === "expired" ? (
          <>
            <h1 className={styles.title}>{t("expiredTitle")}</h1>
            <p className={styles.muted}>{t("expiredBody")}</p>
          </>
        ) : null}

        {!loading && preview?.status === "revoked" ? (
          <>
            <h1 className={styles.title}>{t("revokedTitle")}</h1>
            <p className={styles.muted}>{t("revokedBody")}</p>
          </>
        ) : null}

        {!loading && preview?.status === "accepted" ? (
          <>
            <h1 className={styles.title}>{t("acceptedTitle")}</h1>
            <p className={styles.muted}>{t("acceptedBody")}</p>
            <a className={styles.primaryLink} href="/client/login">
              {t("goLogin")}
            </a>
          </>
        ) : null}

        {!loading && preview?.status === "invalid" ? (
          <>
            <h1 className={styles.title}>{t("invalidTitle")}</h1>
            <p className={styles.muted}>{t("invalidBody")}</p>
          </>
        ) : null}
      </div>
    </div>
  );
}
