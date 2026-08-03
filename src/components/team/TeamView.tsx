"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { OnlineIndicator } from "@/components/presence/OnlineIndicator";
import type { AppLocale } from "@/i18n/config";
import { translateRole } from "@/i18n/roles";
import { translateTeamMemberName } from "@/i18n/team-members";
import type { SessionUser } from "@/lib/auth/types";
import { PRESENCE_POLL_INTERVAL_MS } from "@/lib/presence/constants";
import type {
  ActivityDayStat,
  ActivityMonthStat,
  ActivityPeriod,
  MemberActivityStats,
} from "@/lib/presence/daily-activity-logic";
import {
  buildActivityCalendarCells,
  clampActivityAnchor,
  getActivityDayKey,
  shiftActivityPeriodAnchor,
} from "@/lib/presence/daily-activity-logic";
import type { TeamMember } from "@/lib/team/types";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Toast, type ToastMessage } from "@/components/tasks/Toast";
import styles from "./TeamView.module.css";

type TeamViewProps = {
  user: SessionUser;
};

const ACTIVITY_PERIODS: ActivityPeriod[] = ["day", "week", "month", "year"];

const WEEKDAY_LABELS: Record<AppLocale, string[]> = {
  ru: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"],
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
};

function formatClock(iso: string | null | undefined, locale: AppLocale): string {
  if (!iso) return "—";
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return "—";
  return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Moscow",
  }).format(new Date(ts));
}

function formatOnlineDuration(
  onlineMs: number,
  t: ReturnType<typeof useTranslations<"team">>,
): string {
  const totalMinutes = Math.max(0, Math.floor(onlineMs / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) {
    return t("minutesShort", { minutes });
  }
  return t("hoursShort", { hours, minutes });
}

function formatOnlineDurationCompact(
  onlineMs: number,
  t: ReturnType<typeof useTranslations<"team">>,
): string {
  if (onlineMs <= 0) return "—";
  return formatOnlineDuration(onlineMs, t);
}

function formatActivityDay(dayKey: string, locale: AppLocale): string {
  const ts = Date.parse(`${dayKey}T12:00:00+03:00`);
  if (Number.isNaN(ts)) return dayKey;
  return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Europe/Moscow",
  }).format(new Date(ts));
}

function formatActivityMonthTitle(dayKey: string, locale: AppLocale): string {
  const ts = Date.parse(`${dayKey}T12:00:00+03:00`);
  if (Number.isNaN(ts)) return dayKey;
  return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "Europe/Moscow",
  }).format(new Date(ts));
}

function formatActivityMonthShort(monthKey: string, locale: AppLocale): string {
  const ts = Date.parse(`${monthKey}-15T12:00:00+03:00`);
  if (Number.isNaN(ts)) return monthKey;
  return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-GB", {
    month: "short",
    timeZone: "Europe/Moscow",
  }).format(new Date(ts));
}

function formatActivityYearTitle(anchor: string): string {
  return anchor.slice(0, 4);
}

function formatActivityWeekTitle(
  days: ActivityDayStat[],
  locale: AppLocale,
): string {
  if (days.length === 0) return "";
  const first = days[0]!.date;
  const last = days[days.length - 1]!.date;
  const fmt = new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "Europe/Moscow",
  });
  return `${fmt.format(new Date(`${first}T12:00:00+03:00`))} – ${fmt.format(new Date(`${last}T12:00:00+03:00`))}`;
}

function dayNumber(dayKey: string): string {
  return dayKey.slice(-2).replace(/^0/, "");
}

function activityHeatClass(onlineMs: number): string {
  if (onlineMs <= 0) return "";
  const hours = onlineMs / 3_600_000;
  if (hours >= 4) return styles.calCellHot;
  if (hours >= 1) return styles.calCellWarm;
  return styles.calCellMild;
}

function canNavigatePeriod(
  period: ActivityPeriod,
  anchor: string,
  delta: number,
): boolean {
  const next = clampActivityAnchor(shiftActivityPeriodAnchor(period, anchor, delta));
  if (delta < 0) {
    return next < clampActivityAnchor(anchor);
  }
  return next > clampActivityAnchor(anchor);
}

function periodLabel(
  period: ActivityPeriod,
  t: ReturnType<typeof useTranslations<"team">>,
): string {
  if (period === "day") return t("stats.periodDay");
  if (period === "week") return t("stats.periodWeek");
  if (period === "month") return t("stats.periodMonth");
  return t("stats.periodYear");
}

export function TeamView({ user }: TeamViewProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("team");
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<TeamMember | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [addName, setAddName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addPassword, setAddPassword] = useState("");
  const [createdPassword, setCreatedPassword] = useState<string | null>(null);
  const [createdName, setCreatedName] = useState("");
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [statsTarget, setStatsTarget] = useState<TeamMember | null>(null);
  const [statsPeriod, setStatsPeriod] = useState<ActivityPeriod>("week");
  const [statsAnchor, setStatsAnchor] = useState(getActivityDayKey());
  const [stats, setStats] = useState<MemberActivityStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState(false);
  const [selectedDay, setSelectedDay] = useState<ActivityDayStat | null>(null);

  const fetchMembers = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const res = await fetch("/api/team");
      if (!res.ok) throw new Error("fetch failed");
      const data = (await res.json()) as {
        members?: TeamMember[];
        canManage?: boolean;
        canDelete?: boolean;
        onlineCount?: number;
      };
      setMembers(data.members ?? []);
      setOnlineCount(data.onlineCount ?? 0);
      setCanManage(Boolean(data.canManage ?? data.canDelete));
    } catch {
      setMembers([]);
      setOnlineCount(0);
      setCanManage(false);
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchMembers();
    const interval = setInterval(() => {
      void fetchMembers({ silent: true });
    }, PRESENCE_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchMembers]);

  const fetchMemberStats = useCallback(
    async (memberId: string, period: ActivityPeriod, anchor: string) => {
      setStatsLoading(true);
      setStatsError(false);
      try {
        const params = new URLSearchParams({
          period,
          anchor,
        });
        const res = await fetch(
          `/api/team/${encodeURIComponent(memberId)}/activity?${params}`,
        );
        if (!res.ok) throw new Error("fetch failed");
        const data = (await res.json()) as { stats?: MemberActivityStats };
        const next = data.stats ?? null;
        setStats(next);
        if (next?.anchor && next.anchor !== anchor) {
          setStatsAnchor(next.anchor);
        }
        if (next?.period === "day") {
          setSelectedDay(next.days[0] ?? null);
        } else if (next?.period === "year") {
          setSelectedDay(null);
        } else {
          const todayKey = getActivityDayKey();
          setSelectedDay(
            next?.days.find((day) => day.date === todayKey) ??
              next?.days.find((day) => day.onlineMs > 0) ??
              next?.days[0] ??
              null,
          );
        }
      } catch {
        setStats(null);
        setSelectedDay(null);
        setStatsError(true);
      } finally {
        setStatsLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!statsTarget) {
      setStats(null);
      setSelectedDay(null);
      setStatsError(false);
      return;
    }
    void fetchMemberStats(statsTarget.id, statsPeriod, statsAnchor);
  }, [statsTarget, statsPeriod, statsAnchor, fetchMemberStats]);

  const openMemberStats = (member: TeamMember) => {
    setStatsPeriod("week");
    setStatsAnchor(getActivityDayKey());
    setStatsTarget(member);
  };

  const closeMemberStats = () => {
    setStatsTarget(null);
    setStats(null);
    setSelectedDay(null);
    setStatsError(false);
  };

  const changeStatsPeriod = (period: ActivityPeriod) => {
    setStatsPeriod(period);
    setStatsAnchor(getActivityDayKey());
  };

  const shiftStatsAnchor = (delta: number) => {
    setStatsAnchor((current) =>
      clampActivityAnchor(shiftActivityPeriodAnchor(statsPeriod, current, delta)),
    );
  };

  const openMonthFromYear = (month: ActivityMonthStat) => {
    setStatsPeriod("month");
    setStatsAnchor(`${month.monthKey}-15`);
  };

  const resetAddForm = () => {
    setAddName("");
    setAddEmail("");
    setAddPassword("");
    setCreatedPassword(null);
    setCreatedName("");
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/team/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setToast({ text: data.error ?? t("toasts.deleteFailed") });
        return;
      }
      setToast({
        text: t("toasts.memberDeleted", {
          name: translateTeamMemberName(
            locale,
            deleteTarget.id,
            deleteTarget.name,
          ),
        }),
      });
      setDeleteTarget(null);
      await fetchMembers();
    } catch {
      setToast({ text: t("toasts.deleteFailed") });
    } finally {
      setDeleting(false);
    }
  };

  const submitAdd = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: addName,
          email: addEmail,
          password: addPassword,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        member?: TeamMember;
        temporaryPassword?: string;
      };
      if (!res.ok || !data.member) {
        setToast({ text: data.error ?? t("toasts.createFailed") });
        return;
      }
      setCreatedName(data.member.name);
      setCreatedPassword(addPassword);
      setToast({
        text: t("toasts.memberCreated", { name: data.member.name }),
      });
      await fetchMembers();
    } catch {
      setToast({ text: t("toasts.createFailed") });
    } finally {
      setCreating(false);
    }
  };

  const generatePassword = () => {
    const chars =
      "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#$%";
    let result = "";
    for (let i = 0; i < 12; i += 1) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
    setAddPassword(result);
  };

  const copyCreatedPassword = async () => {
    if (!createdPassword) return;
    try {
      await navigator.clipboard.writeText(createdPassword);
      setToast({ text: t("toasts.passwordCopied") });
    } catch {
      /* ignore */
    }
  };

  const headerAction = canManage ? (
    <Button
      type="button"
      onClick={() => {
        resetAddForm();
        setAddOpen(true);
      }}
    >
      {t("addManager")}
    </Button>
  ) : null;

  return (
    <div className={styles.wrap}>
      <SectionHeader
        title={t("title")}
        subtitle={
          onlineCount > 0
            ? t("subtitleOnline", { count: onlineCount })
            : t("subtitle")
        }
        action={headerAction}
      />

      {canManage ? (
        <>
          <p className={styles.hint}>{t("deleteHint")}</p>
          <p className={styles.hint}>{t("stats.hint")}</p>
        </>
      ) : null}

      {loading ? (
        <Card className={styles.empty}>{t("loading")}</Card>
      ) : members.length === 0 ? (
        <Card className={styles.empty}>{t("empty")}</Card>
      ) : (
        <ul className={styles.list}>
          {members.map((member) => {
            const isSelf =
              member.email.trim().toLowerCase() ===
              user.email.trim().toLowerCase();
            const memberName = translateTeamMemberName(
              locale,
              member.id,
              member.name,
            );
            const showDelete =
              canManage &&
              !isSelf &&
              (member.role === "manager" || member.role === "finance_manager");
            const canOpenStats =
              canManage && !isSelf && member.role !== "owner";
            const activity = member.activityToday;

            return (
              <li key={member.id}>
                <Card
                  className={`${styles.row}${canOpenStats ? ` ${styles.rowClickable}` : ""}`}
                  role={canOpenStats ? "button" : undefined}
                  tabIndex={canOpenStats ? 0 : undefined}
                  onClick={
                    canOpenStats ? () => openMemberStats(member) : undefined
                  }
                  onKeyDown={
                    canOpenStats
                      ? (event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            openMemberStats(member);
                          }
                        }
                      : undefined
                  }
                >
                  <div className={styles.main}>
                    <p className={styles.name}>
                      <span className={styles.nameRow}>
                        {memberName}
                        <OnlineIndicator online={Boolean(member.isOnline)} />
                      </span>
                      {isSelf ? (
                        <span className={styles.you}>{t("youLabel")}</span>
                      ) : null}
                    </p>
                    <p className={styles.meta}>{member.email}</p>
                    <p className={styles.stats}>
                      {t("aiRequests")}:{" "}
                      <span className={styles.statValue}>
                        {member.aiRequestsThisMonth ?? 0}
                      </span>{" "}
                      {t("perMonth")}
                    </p>
                    {activity?.hasActivity ? (
                      <p className={styles.stats}>
                        {t("onlineToday")}:{" "}
                        <span className={styles.statValue}>
                          {formatOnlineDuration(activity.onlineMs, t)}
                        </span>
                        {" · "}
                        {t("workStart")}:{" "}
                        <span className={styles.statValue}>
                          {formatClock(activity.startedAt, locale)}
                        </span>
                        {" · "}
                        {t("workEnd")}:{" "}
                        <span className={styles.statValue}>
                          {formatClock(activity.endedAt, locale)}
                        </span>
                      </p>
                    ) : (
                      <p className={styles.stats}>{t("onlineNone")}</p>
                    )}
                    <span className={styles.role}>
                      {translateRole(locale, member.role)}
                    </span>
                  </div>
                  {showDelete ? (
                    <div className={styles.actions}>
                      <Button
                        type="button"
                        variant="danger"
                        onClick={(event) => {
                          event.stopPropagation();
                          setDeleteTarget(member);
                        }}
                      >
                        {t("delete")}
                      </Button>
                    </div>
                  ) : null}
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {statsTarget ? (
        <div className={styles.overlay} role="dialog" aria-modal="true">
          <div
            className={styles.backdrop}
            onClick={closeMemberStats}
            aria-hidden
          />
          <Card className={styles.statsModal}>
            <h2 className={styles.modalTitle}>{t("stats.title")}</h2>
            <p className={styles.confirmName}>
              {translateTeamMemberName(
                locale,
                statsTarget.id,
                statsTarget.name,
              )}
            </p>
            <div className={styles.periodTabs} role="tablist">
              {ACTIVITY_PERIODS.map((period) => (
                <button
                  key={period}
                  type="button"
                  role="tab"
                  aria-selected={statsPeriod === period}
                  className={`${styles.periodTab}${statsPeriod === period ? ` ${styles.periodTabActive}` : ""}`}
                  onClick={() => changeStatsPeriod(period)}
                >
                  {periodLabel(period, t)}
                </button>
              ))}
            </div>
            {statsLoading ? (
              <p className={styles.confirmText}>{t("stats.loading")}</p>
            ) : statsError || !stats ? (
              <p className={styles.confirmText}>{t("stats.loadFailed")}</p>
            ) : (
              <>
                <div className={styles.statsNav}>
                  <button
                    type="button"
                    className={styles.navBtn}
                    onClick={() => shiftStatsAnchor(-1)}
                    disabled={!canNavigatePeriod(stats.period, stats.anchor, -1)}
                    aria-label={t("stats.prev")}
                  >
                    ‹
                  </button>
                  <p className={styles.statsRange}>
                    {stats.period === "year"
                      ? formatActivityYearTitle(stats.anchor)
                      : stats.period === "month"
                        ? formatActivityMonthTitle(
                            stats.days[0]?.date ?? stats.anchor,
                            locale,
                          )
                        : stats.period === "week"
                          ? formatActivityWeekTitle(stats.days, locale)
                          : formatActivityDay(
                              stats.days[0]?.date ?? stats.anchor,
                              locale,
                            )}
                  </p>
                  <button
                    type="button"
                    className={styles.navBtn}
                    onClick={() => shiftStatsAnchor(1)}
                    disabled={!canNavigatePeriod(stats.period, stats.anchor, 1)}
                    aria-label={t("stats.next")}
                  >
                    ›
                  </button>
                </div>
                <p className={styles.statsTotal}>
                  {t("stats.total")}:{" "}
                  <span className={styles.statValue}>
                    {formatOnlineDuration(stats.onlineMs, t)}
                  </span>
                </p>
                <p className={styles.statsRetention}>{t("stats.retentionHint")}</p>
                {stats.period === "day" ? (
                  <div className={styles.dayDetail}>
                    {stats.days[0] && stats.days[0].onlineMs > 0 ? (
                      <p className={styles.dayMeta}>
                        {t("workStart")}:{" "}
                        {formatClock(stats.days[0].startedAt, locale)}
                        {" · "}
                        {t("workEnd")}:{" "}
                        {formatClock(stats.days[0].endedAt, locale)}
                      </p>
                    ) : (
                      <p className={styles.dayMeta}>{t("stats.emptyDay")}</p>
                    )}
                  </div>
                ) : stats.period === "year" ? (
                  <div className={styles.yearGrid}>
                    {stats.months.map((month) => {
                      const heat = activityHeatClass(month.onlineMs);
                      const isFutureMonth =
                        month.monthKey > getActivityDayKey().slice(0, 7);
                      return (
                        <button
                          key={month.monthKey}
                          type="button"
                          className={[styles.yearCell, heat]
                            .filter(Boolean)
                            .join(" ")}
                          onClick={() => openMonthFromYear(month)}
                          disabled={isFutureMonth}
                          title={`${formatActivityMonthTitle(`${month.monthKey}-15`, locale)}: ${formatOnlineDuration(month.onlineMs, t)}`}
                        >
                          <span className={styles.calDayNum}>
                            {formatActivityMonthShort(month.monthKey, locale)}
                          </span>
                          <span className={styles.calDayDur}>
                            {formatOnlineDurationCompact(month.onlineMs, t)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <>
                    <div
                      className={`${styles.calGrid}${stats.period === "week" ? ` ${styles.calGridWeek}` : ""}`}
                    >
                      {WEEKDAY_LABELS[locale].map((label) => (
                        <div key={label} className={styles.calWeekday}>
                          {label}
                        </div>
                      ))}
                      {buildActivityCalendarCells(stats.days, stats.period).map(
                        (day, index) => {
                          if (!day) {
                            return (
                              <div
                                key={`empty-${index}`}
                                className={`${styles.calCell} ${styles.calCellEmpty}`}
                                aria-hidden
                              />
                            );
                          }
                          const isToday = day.date === getActivityDayKey();
                          const isSelected = selectedDay?.date === day.date;
                          const heat = activityHeatClass(day.onlineMs);
                          return (
                            <button
                              key={day.date}
                              type="button"
                              className={[
                                styles.calCell,
                                heat,
                                isToday ? styles.calCellToday : "",
                                isSelected ? styles.calCellSelected : "",
                              ]
                                .filter(Boolean)
                                .join(" ")}
                              onClick={() => setSelectedDay(day)}
                              title={`${formatActivityDay(day.date, locale)}: ${formatOnlineDuration(day.onlineMs, t)}`}
                            >
                              <span className={styles.calDayNum}>
                                {dayNumber(day.date)}
                              </span>
                              <span className={styles.calDayDur}>
                                {formatOnlineDurationCompact(day.onlineMs, t)}
                              </span>
                            </button>
                          );
                        },
                      )}
                    </div>
                    {selectedDay ? (
                      <div className={styles.dayDetail}>
                        <p className={styles.dayDate}>
                          {formatActivityDay(selectedDay.date, locale)}
                        </p>
                        <p className={styles.stats}>
                          {t("stats.total")}:{" "}
                          <span className={styles.statValue}>
                            {formatOnlineDuration(selectedDay.onlineMs, t)}
                          </span>
                        </p>
                        {selectedDay.onlineMs > 0 ? (
                          <p className={styles.dayMeta}>
                            {t("workStart")}:{" "}
                            {formatClock(selectedDay.startedAt, locale)}
                            {" · "}
                            {t("workEnd")}:{" "}
                            {formatClock(selectedDay.endedAt, locale)}
                          </p>
                        ) : (
                          <p className={styles.dayMeta}>{t("stats.emptyDay")}</p>
                        )}
                      </div>
                    ) : null}
                  </>
                )}
              </>
            )}
            <div className={styles.confirmActions}>
              <Button type="button" variant="secondary" onClick={closeMemberStats}>
                {t("stats.close")}
              </Button>
            </div>
          </Card>
        </div>
      ) : null}

      {deleteTarget ? (
        <div className={styles.overlay} role="dialog" aria-modal="true">
          <div
            className={styles.backdrop}
            onClick={() => !deleting && setDeleteTarget(null)}
            aria-hidden
          />
          <Card className={styles.modal}>
            <h2 className={styles.modalTitle}>{t("modal.title")}</h2>
            <p className={styles.confirmText}>{t("modal.body")}</p>
            <p className={styles.confirmName}>
              {translateTeamMemberName(
                locale,
                deleteTarget.id,
                deleteTarget.name,
              )}
            </p>
            <div className={styles.confirmActions}>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                {t("modal.cancel")}
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={() => void confirmDelete()}
                disabled={deleting}
              >
                {deleting ? t("modal.deleting") : t("modal.deleteBtn")}
              </Button>
            </div>
          </Card>
        </div>
      ) : null}

      {addOpen ? (
        <div className={styles.overlay} role="dialog" aria-modal="true">
          <div
            className={styles.backdrop}
            onClick={() => {
              if (!creating) {
                setAddOpen(false);
                resetAddForm();
              }
            }}
            aria-hidden
          />
          <Card className={styles.modal}>
            {createdPassword ? (
              <>
                <h2 className={styles.modalTitle}>{t("addModal.createdTitle")}</h2>
                <p className={styles.confirmText}>{t("addModal.createdBody")}</p>
                <p className={styles.confirmName}>{createdName}</p>
                <p className={styles.passwordReveal}>{createdPassword}</p>
                <div className={styles.confirmActions}>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void copyCreatedPassword()}
                  >
                    {t("addModal.copyPassword")}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      setAddOpen(false);
                      resetAddForm();
                    }}
                  >
                    {t("addModal.done")}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <h2 className={styles.modalTitle}>{t("addModal.title")}</h2>
                <p className={styles.confirmText}>{t("addModal.body")}</p>
                <label className={styles.field}>
                  <span>{t("addModal.name")}</span>
                  <input
                    className={styles.input}
                    value={addName}
                    onChange={(event) => setAddName(event.target.value)}
                    autoComplete="off"
                    disabled={creating}
                  />
                </label>
                <label className={styles.field}>
                  <span>{t("addModal.email")}</span>
                  <input
                    className={styles.input}
                    type="email"
                    value={addEmail}
                    onChange={(event) => setAddEmail(event.target.value)}
                    autoComplete="off"
                    disabled={creating}
                  />
                </label>
                <label className={styles.field}>
                  <span>{t("addModal.password")}</span>
                  <input
                    className={styles.input}
                    type="text"
                    value={addPassword}
                    onChange={(event) => setAddPassword(event.target.value)}
                    autoComplete="new-password"
                    disabled={creating}
                  />
                </label>
                <div className={styles.confirmActions}>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={generatePassword}
                    disabled={creating}
                  >
                    {t("addModal.generatePassword")}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setAddOpen(false);
                      resetAddForm();
                    }}
                    disabled={creating}
                  >
                    {t("addModal.cancel")}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => void submitAdd()}
                    disabled={creating || !addName.trim() || !addEmail.trim() || !addPassword.trim()}
                  >
                    {creating ? t("addModal.creating") : t("addModal.createBtn")}
                  </Button>
                </div>
              </>
            )}
          </Card>
        </div>
      ) : null}

      <Toast message={toast} onClose={() => setToast(null)} />
    </div>
  );
}
