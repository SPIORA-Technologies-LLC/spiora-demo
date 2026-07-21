"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { Logo } from "@/components/ui/Logo";
import {
  createSupabaseBrowserClient,
  isSupabaseBrowserConfigured,
} from "@/lib/supabase/browser";
import styles from "./ClientInvitePage.module.css";

type Preview =
  | {
      status: "valid";
      maskedEmail: string;
      preferredLocale: string;
      expiresAt: string;
      serviceType: string | null;
    }
  | { status: "expired" }
  | { status: "revoked" }
  | { status: "accepted" }
  | { status: "invalid" };

type Props = { token: string };

export function ClientInvitePage({ token }: Props) {
  const t = useTranslations("clientPortal.invite");
  const locale = useLocale();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"login" | "register">("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [demoSkipEmailConfirm, setDemoSkipEmailConfirm] = useState(false);

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

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/client/auth/config", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { skipEmailConfirmation?: boolean };
        setDemoSkipEmailConfirm(Boolean(data.skipEmailConfirmation));
      } catch {
        setDemoSkipEmailConfirm(false);
      }
    })();
  }, []);

  async function acceptAfterAuth() {
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
      } else {
        setError(data.error?.message || t("errors.acceptFailed"));
      }
      return;
    }
    window.location.href = data.redirectTo || "/client";
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setInfo(null);
    if (!isSupabaseBrowserConfigured()) {
      setError(t("errors.authUnavailable"));
      return;
    }
    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      if (mode === "register") {
        if (demoSkipEmailConfirm) {
          const demoRes = await fetch("/api/client/auth/demo-register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: email.trim(), password }),
          });
          if (!demoRes.ok) {
            setError(t("errors.authFailed"));
            return;
          }
          const { error: signErr } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });
          if (signErr) {
            setError(t("errors.authFailed"));
            return;
          }
        } else {
          const { data, error: signErr } = await supabase.auth.signUp({
            email: email.trim(),
            password,
          });
          if (signErr) {
            setError(t("errors.authFailed"));
            return;
          }
          if (data.user && !data.session) {
            setInfo(t("confirmEmail"));
            return;
          }
        }
      } else {
        const { error: signErr } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signErr) {
          setError(t("errors.authFailed"));
          return;
        }
      }
      await acceptAfterAuth();
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

            <div className={styles.modeRow}>
              <button
                type="button"
                className={mode === "register" ? styles.modeActive : styles.mode}
                onClick={() => setMode("register")}
              >
                {t("register")}
              </button>
              <button
                type="button"
                className={mode === "login" ? styles.modeActive : styles.mode}
                onClick={() => setMode("login")}
              >
                {t("signIn")}
              </button>
            </div>

            <form className={styles.form} onSubmit={(e) => void onSubmit(e)}>
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
                <input
                  type="password"
                  required
                  minLength={8}
                  autoComplete={
                    mode === "register" ? "new-password" : "current-password"
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={styles.input}
                />
              </label>
              <p className={styles.hint}>{t("emailMustMatch")}</p>
              {demoSkipEmailConfirm ? (
                <p className={styles.info}>{t("demoSkipEmailConfirm")}</p>
              ) : null}
              {error ? <p className={styles.error}>{error}</p> : null}
              {info ? <p className={styles.info}>{info}</p> : null}
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
