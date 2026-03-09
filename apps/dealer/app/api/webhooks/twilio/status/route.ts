import { NextRequest } from "next/server";
import {
  handleTwilioStatusCallback,
  verifyTwilioSignature,
  type TwilioStatusPayload,
} from "@/modules/integrations/service/webhooks";

export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/twilio/status — Twilio message status callback.
 * Validates X-Twilio-Signature; updates message delivery status by MessageSid.
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

  const MessageSid = (params.MessageSid ?? "").trim();
  const MessageStatus = (params.MessageStatus ?? "").trim();
  if (!MessageSid || !MessageStatus) {
    return new Response(null, { status: 200 });
  }

  const payload: TwilioStatusPayload = { MessageSid, MessageStatus };
  await handleTwilioStatusCallback(payload);
  return new Response(null, { status: 200 });
}
