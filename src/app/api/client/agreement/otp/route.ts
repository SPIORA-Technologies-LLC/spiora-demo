import { clientApiError, clientApiOk } from "@/lib/client-portal/api-errors";
import { requestClientOtp } from "@/lib/client-portal/sign/service";
import { requireClient, signErrorResponse } from "@/lib/client-portal/sign/http";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireClient(request);
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as {
    versionId?: unknown;
    consent?: unknown;
  } | null;
  if (!body || typeof body.versionId !== "string") {
    return clientApiError("INVALID_BODY", 400);
  }

  try {
    const result = await requestClientOtp({
      session: auth.session,
      versionId: body.versionId,
      consent: body.consent === true,
      meta: auth.meta,
    });
    return clientApiOk(result);
  } catch (error) {
    return signErrorResponse(error);
  }
}
