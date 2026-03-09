import { NextRequest } from "next/server";
import {
  handleInboundSms,
  verifyTwilioSignature,
  type InboundSmsPayload,
} from "@/modules/integrations/service/webhooks";

export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/twilio — Twilio inbound SMS webhook.
 * Validates X-Twilio-Signature; resolves customer by primary phone; creates timeline activity.
 * Returns 200 on success or when no customer match (Twilio expects 2xx).
 */
export async function POST(request: NextRequest) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const signature =
    request.headers.get("x-twilio-signature") ??
    request.headers.get("X-Twilio-Signature") ??
    "";

  let params: Record<string, string>;
  try {
    const body = await request.text();
    params = Object.fromEntries(new URLSearchParams(body)) as Record<string, string>;
  } catch {
    return new Response(null, { status: 400 });
  }

  const url = request.url;
  const valid =
    authToken &&
    (await verifyTwilioSignature(authToken, signature, url, params));
  if (!valid) {
    return new Response(null, { status: 401 });
  }

  const From = params.From ?? "";
  const Body = params.Body ?? "";
  const MessageSid = params.MessageSid ?? "";
  if (!From.trim() || !Body.trim()) {
    return new Response(null, { status: 200 });
  }

  const payload: InboundSmsPayload = { From, To: params.To ?? "", Body, MessageSid };
  await handleInboundSms(payload);
  return new Response(null, { status: 200 });
}
