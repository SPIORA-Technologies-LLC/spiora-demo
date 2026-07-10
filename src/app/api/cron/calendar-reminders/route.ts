import { NextResponse } from "next/server";
import { verifyCalendarCronRequest } from "@/lib/calendar/cron-auth";
import { runCalendarReminderCron } from "@/lib/calendar/reminders-cron";
import { isCronIntegrationEnabled } from "@/lib/demo/integration-policy";

export async function GET(request: Request) {
  if (!isCronIntegrationEnabled()) {
    return NextResponse.json(
      { error: "Cron disabled in Spiora demo mode" },
      { status: 503 },
    );
  }

  if (!verifyCalendarCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runCalendarReminderCron();
    return NextResponse.json(result);
  } catch (error) {
    console.error("[calendar-reminders-cron] failed", error);
    return NextResponse.json(
      { error: "Calendar reminder cron failed" },
      { status: 500 },
    );
  }
}
