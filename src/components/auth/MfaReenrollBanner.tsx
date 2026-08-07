"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

export function MfaReenrollBanner() {
  const t = useTranslations("authMfa");

  return (
    <div
      role="status"
      style={{
        margin: "0 0 1rem",
        padding: "0.75rem 1rem",
        borderRadius: "8px",
        border: "1px solid rgba(234, 179, 8, 0.45)",
        background: "rgba(234, 179, 8, 0.12)",
        color: "inherit",
        fontSize: "0.9375rem",
      }}
    >
      {t("banner.reenroll")}{" "}
      <Link href="/settings/mfa">{t("banner.reenrollCta")}</Link>
    </div>
  );
}
