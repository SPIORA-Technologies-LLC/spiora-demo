import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getClientDetail } from "@/lib/google-sheets/service";
import { getRequestLocale, translateApiMessage } from "@/i18n/api-messages";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) {
    const locale = await getRequestLocale();
    return NextResponse.json(
      { error: translateApiMessage(locale, "unauthorized") },
      { status: 401 },
    );
  }

  const { id } = await context.params;

  try {
    const detail = await getClientDetail(id);

    if (!detail) {
      const locale = await getRequestLocale();
      return NextResponse.json(
        { error: translateApiMessage(locale, "notFound") },
        { status: 404 },
      );
    }

    return NextResponse.json(detail);
  } catch {
    const locale = await getRequestLocale();
    return NextResponse.json(
      { error: translateApiMessage(locale, "loadClientFailed") },
      { status: 500 },
    );
  }
}
