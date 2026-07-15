import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import {
  createClient,
  listClients,
  CrmAccessError,
  CrmStorageError,
} from "@/lib/clients/store";
import { ClientValidationError } from "@/lib/clients/validation";
import { getRequestLocale, translateApiMessage } from "@/i18n/api-messages";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    const locale = await getRequestLocale();
    return NextResponse.json(
      { error: translateApiMessage(locale, "unauthorized") },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const pageSize = Math.min(
    100,
    Math.max(1, Number(searchParams.get("pageSize") ?? "25")),
  );

  try {
    const result = await listClients(page, pageSize, {
      search: searchParams.get("search") ?? undefined,
      direction: searchParams.get("direction") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      manager: searchParams.get("manager") ?? undefined,
      country: searchParams.get("country") ?? undefined,
    });

    return NextResponse.json(result);
  } catch {
    const locale = await getRequestLocale();
    return NextResponse.json(
      { error: translateApiMessage(locale, "loadClientsFailed") },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  const locale = await getRequestLocale();

  if (!session) {
    return NextResponse.json(
      { error: translateApiMessage(locale, "unauthorized") },
      { status: 401 },
    );
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const client = await createClient(
      {
        name: typeof body.name === "string" ? body.name : "",
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
        externalId:
          typeof body.externalId === "string" ? body.externalId : undefined,
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
      return NextResponse.json(
        { error: translateApiMessage(locale, "crmStorageUnavailable") },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: translateApiMessage(locale, "createClientFailed") },
      { status: 500 },
    );
  }
}
