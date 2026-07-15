import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import {
  archiveClient,
  getClientDetail,
  updateClient,
  CrmAccessError,
  CrmStorageError,
} from "@/lib/clients/store";
import { ClientValidationError } from "@/lib/clients/validation";
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

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getSession();
  const locale = await getRequestLocale();

  if (!session) {
    return NextResponse.json(
      { error: translateApiMessage(locale, "unauthorized") },
      { status: 401 },
    );
  }

  const { id } = await context.params;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const client = await updateClient(
      id,
      {
        name: typeof body.name === "string" ? body.name : undefined,
        email: typeof body.email === "string" ? body.email : undefined,
        phone: typeof body.phone === "string" ? body.phone : undefined,
        country: typeof body.country === "string" ? body.country : undefined,
        citizenship:
          typeof body.citizenship === "string" ? body.citizenship : undefined,
        direction:
          typeof body.direction === "string" ? body.direction : undefined,
        status: typeof body.status === "string" ? body.status : undefined,
        pipelineStage:
          typeof body.pipelineStage === "string"
            ? body.pipelineStage
            : undefined,
        manager: typeof body.manager === "string" ? body.manager : undefined,
        assignedUserId:
          typeof body.assignedUserId === "string"
            ? body.assignedUserId
            : undefined,
        serviceType:
          typeof body.serviceType === "string" ? body.serviceType : undefined,
        passportNumber:
          typeof body.passportNumber === "string"
            ? body.passportNumber
            : undefined,
        notesSummary:
          typeof body.notesSummary === "string" ? body.notesSummary : undefined,
      },
      session,
    );

    return NextResponse.json({ client, source: "postgresql" as const });
  } catch (error) {
    if (error instanceof CrmAccessError) {
      return NextResponse.json(
        { error: translateApiMessage(locale, "forbidden") },
        { status: 403 },
      );
    }
    if (error instanceof ClientValidationError) {
      return NextResponse.json(
        { error: translateApiMessage(locale, "validationFailed") },
        { status: 400 },
      );
    }
    if (error instanceof CrmStorageError) {
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
      { error: translateApiMessage(locale, "updateClientFailed") },
      { status: 500 },
    );
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

  const { id } = await context.params;

  try {
    await archiveClient(id, session);
    return NextResponse.json({ ok: true, archivedId: id });
  } catch (error) {
    if (error instanceof CrmAccessError) {
      return NextResponse.json(
        { error: translateApiMessage(locale, "forbidden") },
        { status: 403 },
      );
    }
    if (error instanceof CrmStorageError) {
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
      { error: translateApiMessage(locale, "archiveClientFailed") },
      { status: 500 },
    );
  }
}
