import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { listIntakeCases } from "@/lib/client-portal/case-service";
import { getRequestLocale, translateApiMessage } from "@/i18n/api-messages";
import { CaseStoreConfigurationError } from "@/lib/client-portal/case-store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getSession();
  const locale = await getRequestLocale();
  if (!session) {
    return NextResponse.json(
      { error: translateApiMessage(locale, "unauthorized") },
      { status: 401 },
    );
  }
  if (session.role !== "owner" && session.role !== "manager") {
    return NextResponse.json(
      { error: translateApiMessage(locale, "forbidden") },
      { status: 403 },
    );
  }

  try {
    const url = new URL(request.url);
    const search = url.searchParams.get("search") ?? undefined;
    const page = Number(url.searchParams.get("page") ?? "1");
    const pageSize = Number(url.searchParams.get("pageSize") ?? "25");
    const result = await listIntakeCases({
      search,
      page: Number.isFinite(page) ? page : 1,
      pageSize: Number.isFinite(pageSize) ? pageSize : 25,
    });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof CaseStoreConfigurationError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 503 });
    }
    throw error;
  }
}
