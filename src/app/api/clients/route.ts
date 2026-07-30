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
    const str = (key: string): string | undefined =>
      typeof body[key] === "string" ? (body[key] as string) : undefined;
    const client = await createClient(
      {
        name: typeof body.name === "string" ? body.name : "",
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
        externalId: str("externalId"),
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
