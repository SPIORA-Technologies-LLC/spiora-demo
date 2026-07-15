import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import {
  archiveClientNote,
  ClientNotesAccessError,
  ClientNotesStorageError,
  updateClientNote,
} from "@/lib/clients/client-notes-store";
import { ClientDataValidationError } from "@/lib/clients/client-data-validation";
import { mapNoteRecordToClientNote } from "@/lib/clients/client-data-map";
import { getRequestLocale, translateApiMessage } from "@/i18n/api-messages";

type RouteContext = { params: Promise<{ id: string; noteId: string }> };

function handleError(error: unknown, locale: Awaited<ReturnType<typeof getRequestLocale>>) {
  if (error instanceof ClientNotesAccessError) {
    return NextResponse.json(
      { error: translateApiMessage(locale, "forbidden") },
      { status: 403 },
    );
  }
  if (error instanceof ClientDataValidationError) {
    return NextResponse.json(
      { error: translateApiMessage(locale, "validationFailed") },
      { status: 400 },
    );
  }
  if (error instanceof ClientNotesStorageError) {
    const status = error.message.includes("not found") ? 404 : 503;
    return NextResponse.json(
      {
        error: translateApiMessage(
          locale,
          status === 404 ? "notFound" : "crmStorageUnavailable",
        ),
      },
      { status },
    );
  }
  return NextResponse.json(
    { error: translateApiMessage(locale, "noteSaveFailed") },
    { status: 500 },
  );
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getSession();
  const locale = await getRequestLocale();
  if (!session) {
    return NextResponse.json(
      { error: translateApiMessage(locale, "unauthorized") },
      { status: 401 },
    );
  }

  const { id, noteId } = await context.params;
  const body = (await request.json()) as { text?: string };

  try {
    const note = await updateClientNote(id, noteId, session, body.text ?? "");
    return NextResponse.json({ note: mapNoteRecordToClientNote(note) });
  } catch (error) {
    return handleError(error, locale);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await getSession();
  const locale = await getRequestLocale();
  if (!session) {
    return NextResponse.json(
      { error: translateApiMessage(locale, "unauthorized") },
      { status: 401 },
    );
  }

  const { id, noteId } = await context.params;

  try {
    await archiveClientNote(id, noteId, session);
    return NextResponse.json({ ok: true, archivedId: noteId });
  } catch (error) {
    return handleError(error, locale);
  }
}
