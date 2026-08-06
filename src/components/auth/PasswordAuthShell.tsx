import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { Logo } from "@/components/ui/Logo";
import clientStyles from "@/components/client-portal/ClientInvitePage.module.css";
import loginStyles from "@/app/login/login.module.css";

type PasswordAuthShellProps = {
  audience: "employee" | "client";
  children: React.ReactNode;
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

export function PasswordAuthShell({
  audience,
  children,
}: PasswordAuthShellProps) {
  if (audience === "client") {
    return (
      <div className={clientStyles.page}>
        <div className={clientStyles.card}>
          <div className={clientStyles.top}>
            <Logo size="md" />
            <LanguageSwitcher />
          </div>
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className={loginStyles.page} style={pageFallback}>
      <div className={loginStyles.card} style={cardFallback}>
        <div className={loginStyles.localeRow}>
          <LanguageSwitcher />
        </div>
        <div className={loginStyles.logoWrap}>
          <Logo priority size="lg" />
        </div>
        {children}
      </div>
    </div>
  );
}
