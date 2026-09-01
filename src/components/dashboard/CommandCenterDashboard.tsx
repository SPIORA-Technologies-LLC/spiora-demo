"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { SessionUser } from "@/lib/auth/types";
import type { CompanyHealthMetrics } from "@/lib/dashboard/company-health";
import type { CommandCenterDailyBriefing } from "@/lib/dashboard/daily-briefing";
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

function dashboardPath(dayKey: string, todayKey: string): string {
  return dayKey === todayKey ? "/dashboard" : `/dashboard?date=${dayKey}`;
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

  useEffect(() => {
    setBriefing(initialBriefing);
    setDayKey(initialBriefing.dayKey);
    setError(null);
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
        router.replace(dashboardPath(data.dayKey, todayKey), { scroll: false });
      } catch {
        setError("fetch_failed");
      } finally {
        setLoading(false);
      }
    },
    [dayKey, loading, maxDayKey, minDayKey, router, todayKey],
  );

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
    />
  );
}
