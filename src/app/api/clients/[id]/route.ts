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
    const str = (key: string): string | undefined =>
      typeof body[key] === "string" ? (body[key] as string) : undefined;
    const client = await updateClient(
      id,
      {
        name: str("name"),
        email: str("email"),
        phone: str("phone"),
        country: str("country"),
        citizenship: str("citizenship"),
        direction: str("direction"),
        status: str("status"),
        pipelineStage: str("pipelineStage"),
        manager: str("manager"),
        assignedUserId: str("assignedUserId"),
        serviceType: str("serviceType"),
        passportNumber: str("passportNumber"),
        notesSummary: str("notesSummary"),
        submittedAt: str("submittedAt"),
        expectedApprovalAt: str("expectedApprovalAt"),
        referentName: str("referentName"),
        bookingAddress: str("bookingAddress"),
        bookingRange: str("bookingRange"),
        approvalAt: str("approvalAt"),
        residenceCardIssuedAt: str("residenceCardIssuedAt"),
        appPassword: str("appPassword"),
        partnerName: str("partnerName"),
        contract: str("contract"),
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
