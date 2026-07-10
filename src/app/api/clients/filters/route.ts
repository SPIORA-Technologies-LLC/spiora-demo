import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getFilterOptions } from "@/lib/google-sheets/service";
import { getRequestLocale, translateApiMessage } from "@/i18n/api-messages";

export async function GET() {
  const session = await getSession();
  if (!session) {
    const locale = await getRequestLocale();
    return NextResponse.json(
      { error: translateApiMessage(locale, "unauthorized") },
      { status: 401 },
    );
  }

  const options = await getFilterOptions();
  return NextResponse.json(options);
}
