import {
  previewInvitationByToken,
} from "@/lib/client-portal/invitations";
import { clientApiError, clientApiOk } from "@/lib/client-portal/api-errors";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ token: string }> };

/**
 * Public invite preview. Token is hashed server-side; never query by raw token in SQL logs intentionally.
 * Invalid / unknown tokens share the same neutral response shape.
 */
export async function GET(_request: Request, ctx: Ctx) {
  const { token: raw } = await ctx.params;
  let token = raw;
  try {
    token = decodeURIComponent(raw);
  } catch {
    return clientApiError("INVITATION_INVALID", 404);
  }

  try {
    const preview = await previewInvitationByToken(token);
    if (preview.status === "invalid") {
      return clientApiError("INVITATION_INVALID", 404);
    }
    return clientApiOk({ preview });
  } catch {
    // Neutral failure — do not leak DB errors
    return clientApiError("INVITATION_INVALID", 404);
  }
}
