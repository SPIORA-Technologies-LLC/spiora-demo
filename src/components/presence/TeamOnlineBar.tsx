"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { OnlineIndicator } from "@/components/presence/OnlineIndicator";
import type { AppLocale } from "@/i18n/config";
import { Card } from "@/components/ui/Card";
import { PRESENCE_POLL_INTERVAL_MS } from "@/lib/presence/constants";
import type { TeamMember } from "@/lib/team/types";
import styles from "./TeamOnlineBar.module.css";

type TeamOnlineBarProps = {
  variant?: "default" | "prominent";
};

export function TeamOnlineBar({ variant = "default" }: TeamOnlineBarProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("team.onlineBar");
  const [onlineMembers, setOnlineMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const prominent = variant === "prominent";

  const fetchOnline = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch("/api/team");
      if (!res.ok) throw new Error("fetch failed");
      const data = (await res.json()) as { members?: TeamMember[] };
      const online = (data.members ?? []).filter((member) => member.isOnline);
      online.sort((a, b) => a.name.localeCompare(b.name, locale));
      setOnlineMembers(online);
    } catch {
      setOnlineMembers([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    void fetchOnline();
    const interval = setInterval(() => {
      void fetchOnline(true);
    }, PRESENCE_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchOnline]);

  if (loading) {
    return (
      <p className={prominent ? styles.prominentHint : styles.hint}>
        {t("loading")}
      </p>
    );
  }

  if (onlineMembers.length === 0) {
    return (
      <Card className={prominent ? styles.prominentCard : styles.emptyCard}>
        <p className={prominent ? styles.prominentEmpty : styles.hint}>
          <span className={styles.offlineDot} aria-hidden />
          {t("empty")}{" "}
          <Link href="/team" className={styles.link}>
            {t("openTeam")}
          </Link>
        </p>
      </Card>
    );
  }

  const content = (
    <div className={prominent ? styles.inner : styles.innerCompact}>
      <div className={styles.header}>
        <div className={styles.headerMain}>
          <span className={styles.liveDot} aria-hidden />
          <div className={styles.headerText}>
            <span className={styles.label}>
              {prominent ? t("onlineNow") : t("online")}
            </span>
            {prominent ? (
              <span className={styles.subtitle}>{t("onlineSubtitle")}</span>
            ) : null}
          </div>
          <span className={styles.count}>{onlineMembers.length}</span>
        </div>
        <Link
          href="/team"
          className={prominent ? styles.linkButton : styles.link}
        >
          {t("viewAll")}
        </Link>
      </div>

      <div className={prominent ? styles.membersPanel : undefined}>
        {prominent ? (
          <p className={styles.membersLabel}>{t("membersOnline")}</p>
        ) : null}
        <ul className={styles.list}>
          {onlineMembers.map((member) => (
            <li key={member.id}>
              <span className={styles.chip}>
                <OnlineIndicator
                  online
                  title={t("memberOnlineTitle", { name: member.name })}
                />
                <span className={styles.chipName}>{member.name}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );

  if (prominent) {
    return <Card className={styles.prominentCard}>{content}</Card>;
  }

  return <div className={styles.wrap}>{content}</div>;
}
