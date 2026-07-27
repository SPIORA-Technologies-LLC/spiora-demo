import { NextResponse } from "next/server";
import { getRequestLocale } from "@/i18n/api-messages";
import { getSession } from "@/lib/auth/session";
import { FinanceError } from "@/lib/finance/errors";
import { financeErrorResponse } from "@/lib/finance/http";
import { canViewFinance } from "@/lib/finance/permissions";
import { getFinanceAnalytics } from "@/lib/finance/service";

export async function GET(request: Request) {
  const session = await getSession();
  const locale = await getRequestLocale();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canViewFinance(session)) {
    return financeErrorResponse(
      new FinanceError("FINANCE_ACCESS_DENIED", "denied", 403),
      locale,
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const periodType =
      searchParams.get("periodType") === "month" ? "month" : "year";
    const year = Number(searchParams.get("year") ?? new Date().getFullYear());
    const month = searchParams.get("month")
      ? Number(searchParams.get("month"))
      : undefined;
    const direction = searchParams.get("direction") ?? undefined;

    const analytics = await getFinanceAnalytics(session, {
      periodType,
      year,
      month,
      direction,
    });
    return NextResponse.json({ analytics });
  } catch (error) {
    return financeErrorResponse(error, locale);
  }
}
