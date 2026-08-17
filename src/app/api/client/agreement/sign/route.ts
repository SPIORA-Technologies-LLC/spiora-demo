import { clientApiError, clientApiOk } from "@/lib/client-portal/api-errors";
import { clientSignAgreement } from "@/lib/client-portal/sign/service";
import { requireClient, signErrorResponse } from "@/lib/client-portal/sign/http";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireClient(request);
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as {
    versionId?: unknown;
    otp?: unknown;
    consent?: unknown;
  } | null;
  if (
    !body ||
    typeof body.versionId !== "string" ||
    typeof body.otp !== "string"
  ) {
    return clientApiError("INVALID_BODY", 400);
  }

  try {
    const sign = await clientSignAgreement({
      session: auth.session,
      versionId: body.versionId,
      otp: body.otp,
      consent: body.consent === true,
      meta: auth.meta,
    });
    return clientApiOk({ sign });
  } catch (error) {
    return signErrorResponse(error);
  }
}
