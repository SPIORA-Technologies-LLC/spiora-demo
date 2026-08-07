import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { DemoCredentials } from "@/components/auth/DemoCredentials";
import { LoginForm } from "@/components/auth/LoginForm";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { Logo } from "@/components/ui/Logo";
import { getProductDescription } from "@/config/branding";
import type { BrandingLocale } from "@/config/branding";
import { getSession } from "@/lib/auth/session";
import { getClientSession } from "@/lib/client-portal/session";
import styles from "./login.module.css";

type LoginPageProps = {
  searchParams: Promise<{ next?: string; error?: string; mfa_reenroll?: string }>;
};

const pageFallback = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "1.5rem",
  background: "linear-gradient(168deg, #000000 0%, #0a0a0a 42%, #111111 100%)",
  color: "#ffffff",
  fontFamily: "Inter, system-ui, sans-serif",
} as const;

const cardFallback = {
  width: "100%",
  maxWidth: "440px",
  padding: "2rem",
  background: "#1a1a1a",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  borderRadius: "24px",
  boxShadow: "0 16px 40px rgba(0, 0, 0, 0.28)",
  textAlign: "center" as const,
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await getSession();
  if (session) {
    redirect("/dashboard");
  }

  const clientSession = await getClientSession();
  if (clientSession) {
    redirect("/client");
  }

  const locale = (await getLocale()) as BrandingLocale;
  const params = await searchParams;
  const nextPath =
    params.next && params.next.startsWith("/") ? params.next : undefined;
  const authError =
    params.error === "google_access_denied" ||
    params.error === "unsupported_callback"
      ? params.error
      : null;
  const mfaReenroll = params.mfa_reenroll === "1";

  return (
    <div className={styles.page} style={pageFallback}>
      <div className={styles.card} style={cardFallback}>
        <div className={styles.localeRow}>
          <LanguageSwitcher />
        </div>
        <div className={styles.logoWrap}>
          <Logo priority size="lg" />
        </div>
        <p className={styles.positioning}>{getProductDescription(locale)}</p>
        <LoginForm
          nextPath={nextPath}
          authError={authError}
          mfaReenroll={mfaReenroll}
        />
        {process.env.NODE_ENV !== "production" ? <DemoCredentials /> : null}
      </div>
    </div>
  );
}
