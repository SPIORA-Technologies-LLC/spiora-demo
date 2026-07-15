import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getSystemHealth } from "@/lib/system/system-health";
import { getRequestLocale, translateApiMessage } from "@/i18n/api-messages";

export async function GET() {
  const session = await getSession();
  const locale = await getRequestLocale();

  if (!session) {
    return NextResponse.json(
      { error: translateApiMessage(locale, "unauthorized") },
      { status: 401 },
    );
  }

  if (session.role !== "owner") {
    return NextResponse.json(
      { error: translateApiMessage(locale, "forbidden") },
      { status: 403 },
    );
  }

  const health = await getSystemHealth();
  return NextResponse.json(health);
}
