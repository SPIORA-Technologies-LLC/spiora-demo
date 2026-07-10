import { NextResponse } from "next/server";
import { WebhookReceiver } from "livekit-server-sdk";
import { handleLiveKitEgressWebhook } from "@/lib/calendar/meeting-recording-handler";
import { getLiveKitEnv } from "@/lib/calendar/meeting-token";
import { areWebhooksIntegrationEnabled } from "@/lib/demo/integration-policy";

export async function POST(request: Request) {
  if (!areWebhooksIntegrationEnabled()) {
    return NextResponse.json(
      { error: "Webhooks disabled in Spiora demo mode" },
      { status: 503 },
    );
  }

  const env = getLiveKitEnv();
  if (!env) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const body = await request.text();
  const authHeader = request.headers.get("authorization") ?? "";

  const receiver = new WebhookReceiver(env.apiKey, env.apiSecret);

  let event;
  try {
    event = await receiver.receive(body, authHeader);
  } catch {
    return NextResponse.json({ error: "Invalid webhook" }, { status: 401 });
  }

  if (!event.egressInfo?.egressId) {
    return NextResponse.json({ ok: true });
  }

  const egress = event.egressInfo;
  await handleLiveKitEgressWebhook(
    egress.egressId,
    egress.status,
    egress.error,
    (egress.fileResults ?? []).map((file) => ({
      filename: file.filename,
      size: file.size,
      duration: file.duration,
    })),
  );

  return NextResponse.json({ ok: true });
}
