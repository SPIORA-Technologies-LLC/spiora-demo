import { NextResponse } from "next/server";
import { getRequestLocale } from "@/i18n/api-messages";
import { getSession } from "@/lib/auth/session";
import { buildDemoOverviewAnalytics } from "@/lib/analytics/demo-overview";
import { isDemoMode } from "@/lib/demo/demo-mode";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.role !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!isDemoMode()) {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const locale = await getRequestLocale();
  const data = buildDemoOverviewAnalytics(locale);
  return NextResponse.json(data);
}
