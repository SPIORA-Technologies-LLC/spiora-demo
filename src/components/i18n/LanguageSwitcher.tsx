"use client";

import { Suspense, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { AppLocale } from "@/i18n/config";
import styles from "./LanguageSwitcher.module.css";

function LanguageSwitcherInner({ compact = false }: { compact?: boolean }) {
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("language");
  const [isPending, startTransition] = useTransition();

  async function switchLocale(nextLocale: AppLocale) {
    if (nextLocale === locale) return;

    await fetch("/api/locale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: nextLocale }),
    });

    const query = searchParams.toString();
    const target = query ? `${pathname}?${query}` : pathname;

    startTransition(() => {
      router.replace(target, { scroll: false });
      router.refresh();
    });
  }

  return (
    <div
      className={[styles.switcher, compact ? styles.compact : ""]
        .filter(Boolean)
        .join(" ")}
      role="group"
      aria-label={t("switcherLabel")}
    >
      {(["en", "ru"] as const).map((code) => {
        const active = locale === code;
        return (
          <button
            key={code}
            type="button"
            className={[styles.button, active ? styles.active : ""]
              .filter(Boolean)
              .join(" ")}
            aria-pressed={active}
            disabled={isPending}
            onClick={() => void switchLocale(code)}
          >
            {t(code)}
          </button>
        );
      })}
    </div>
  );
}

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  return (
    <Suspense fallback={<div className={styles.fallback}>EN | RU</div>}>
      <LanguageSwitcherInner compact={compact} />
    </Suspense>
  );
}
