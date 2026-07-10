import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { addClientNote, getClientDetail } from "@/lib/google-sheets/service";
import { getRequestLocale, translateApiMessage } from "@/i18n/api-messages";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) {
    const locale = await getRequestLocale();
    return NextResponse.json(
      { error: translateApiMessage(locale, "unauthorized") },
      { status: 401 },
    );
  }

  const { id } = await context.params;
  const body = (await request.json()) as { text?: string };
  const text = body.text?.trim();

  if (!text) {
    const locale = await getRequestLocale();
    return NextResponse.json(
      { error: translateApiMessage(locale, "textRequired") },
      { status: 400 },
    );
  }

  const detail = await getClientDetail(id);
  if (!detail) {
    const locale = await getRequestLocale();
    return NextResponse.json(
      { error: translateApiMessage(locale, "notFound") },
      { status: 404 },
    );
  }

  const ok = await addClientNote(id, session.name, text);
  if (!ok) {
    const locale = await getRequestLocale();
    return NextResponse.json(
      { error: translateApiMessage(locale, "noteSaveFailed") },
      { status: 500 },
    );
  }

  const updated = await getClientDetail(id);
  return NextResponse.json({ notes: updated?.notes ?? [] });
}
