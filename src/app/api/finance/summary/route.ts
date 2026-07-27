import { NextResponse } from "next/server";
import { getRequestLocale } from "@/i18n/api-messages";
import { getSession } from "@/lib/auth/session";
import { financeErrorResponse } from "@/lib/finance/http";
import { canViewFinance } from "@/lib/finance/permissions";
import { getFinanceSummary } from "@/lib/finance/service";
import { FinanceError } from "@/lib/finance/errors";

export async function GET() {
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
    const summary = await getFinanceSummary(session);
    return NextResponse.json({ summary });
  } catch (error) {
    return financeErrorResponse(error, locale);
  }
}
