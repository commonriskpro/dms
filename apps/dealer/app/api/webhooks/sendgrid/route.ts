import { NextRequest } from "next/server";
import {
  handleInboundEmail,
  type InboundEmailPayload,
} from "@/modules/integrations/service/webhooks";

export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/sendgrid — SendGrid Inbound Parse webhook.
 * Parses multipart/form-data (from, to, subject, text, html); resolves customer by sender email; creates timeline activity.
 * Signature verification can be added when SendGrid signing is configured.
 */
export async function POST(request: NextRequest) {
  let from = "";
  let to = "";
  let subject = "";
  let text = "";
  let html = "";

  try {
    const formData = await request.formData();
    from = (formData.get("from") as string) ?? (formData.get("From") as string) ?? "";
    to = (formData.get("to") as string) ?? (formData.get("To") as string) ?? "";
    subject = (formData.get("subject") as string) ?? (formData.get("Subject") as string) ?? "";
    text = (formData.get("text") as string) ?? "";
    html = (formData.get("html") as string) ?? "";
  } catch {
    return new Response(null, { status: 400 });
  }

  if (!from.trim()) {
    return new Response(null, { status: 200 });
  }

  const payload: InboundEmailPayload = { from, to, subject, text, html };
  await handleInboundEmail(payload);
  return new Response(null, { status: 200 });
}
