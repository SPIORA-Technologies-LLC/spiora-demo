"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { SessionUser } from "@/lib/auth/types";
import type { CompanyHealthMetrics } from "@/lib/dashboard/company-health";
import type {
  BriefingActivityItem,
  CommandCenterDailyBriefing,
} from "@/lib/dashboard/daily-briefing";
import { FirstImpressionView } from "./FirstImpressionView";

type CommandCenterDashboardProps = {
  user: SessionUser;
  health: CompanyHealthMetrics;
  initialBriefing: CommandCenterDailyBriefing;
  minDayKey: string;
  maxDayKey: string;
};

type DailyBriefingResponse = {
  dayKey: string;
  briefing: CommandCenterDailyBriefing;
};

type ActivityPageResponse = {
  dayKey: string;
  items: BriefingActivityItem[];
  total: number;
  nextCursor: string | null;
};

function dashboardPath(dayKey: string, todayKey: string): string {
  return dayKey === todayKey ? "/dashboard" : `/dashboard?date=${dayKey}`;
}

function syncActivityFromBriefing(briefing: CommandCenterDailyBriefing) {
  return {
    items: briefing.activity,
    nextCursor: briefing.activityNextCursor,
    total: briefing.activityTotal,
  };
}

export function CommandCenterDashboard({
  user,
  health,
  initialBriefing,
  minDayKey,
  maxDayKey,
}: CommandCenterDashboardProps) {
  const router = useRouter();
  const todayKey = maxDayKey;
  const [briefing, setBriefing] = useState(initialBriefing);
  const [dayKey, setDayKey] = useState(initialBriefing.dayKey);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initialActivity = syncActivityFromBriefing(initialBriefing);
  const [activityItems, setActivityItems] = useState(initialActivity.items);
  const [activityNextCursor, setActivityNextCursor] = useState(
    initialActivity.nextCursor,
  );
  const [activityTotal, setActivityTotal] = useState(initialActivity.total);
  const [activityLoadingMore, setActivityLoadingMore] = useState(false);

  useEffect(() => {
    setBriefing(initialBriefing);
    setDayKey(initialBriefing.dayKey);
    setError(null);
    const activity = syncActivityFromBriefing(initialBriefing);
    setActivityItems(activity.items);
    setActivityNextCursor(activity.nextCursor);
    setActivityTotal(activity.total);
  }, [initialBriefing]);

  const selectDay = useCallback(
    async (nextDayKey: string) => {
      if (loading || nextDayKey === dayKey) return;
      if (nextDayKey < minDayKey || nextDayKey > maxDayKey) return;

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/command-center/daily?date=${encodeURIComponent(nextDayKey)}`,
        );
        if (!response.ok) {
          throw new Error("fetch_failed");
        }
        const data = (await response.json()) as DailyBriefingResponse;
        setBriefing(data.briefing);
        setDayKey(data.dayKey);
        const activity = syncActivityFromBriefing(data.briefing);
        setActivityItems(activity.items);
        setActivityNextCursor(activity.nextCursor);
        setActivityTotal(activity.total);
        router.replace(dashboardPath(data.dayKey, todayKey), { scroll: false });
      } catch {
        setError("fetch_failed");
      } finally {
        setLoading(false);
      }
    },
    [dayKey, loading, maxDayKey, minDayKey, router, todayKey],
  );

  const loadMoreActivity = useCallback(async () => {
    if (!activityNextCursor || activityLoadingMore || loading) return;

    setActivityLoadingMore(true);
    try {
      const params = new URLSearchParams({
        date: dayKey,
        cursor: activityNextCursor,
        limit: "20",
      });
      const response = await fetch(
        `/api/command-center/activity?${params.toString()}`,
      );
      if (!response.ok) {
        throw new Error("fetch_failed");
      }
      const data = (await response.json()) as ActivityPageResponse;
      setActivityItems((prev) => {
        const seen = new Set(prev.map((item) => item.id));
        const appended = data.items.filter((item) => !seen.has(item.id));
        return [...prev, ...appended];
      });
      setActivityNextCursor(data.nextCursor);
      setActivityTotal(data.total);
    } catch {
      setError("fetch_failed");
    } finally {
      setActivityLoadingMore(false);
    }
  }, [activityLoadingMore, activityNextCursor, dayKey, loading]);

  return (
    <FirstImpressionView
      user={user}
      health={health}
      briefing={briefing}
      dayKey={dayKey}
      todayKey={todayKey}
      minDayKey={minDayKey}
      maxDayKey={maxDayKey}
      loading={loading}
      error={error}
      onSelectDay={selectDay}
      activityItems={activityItems}
      activityTotal={activityTotal}
      activityNextCursor={activityNextCursor}
      activityLoadingMore={activityLoadingMore}
      onLoadMoreActivity={loadMoreActivity}
    />
  );
}
