/**
 * Inbound webhook handlers for Twilio (SMS) and SendGrid (email).
 * Verify provider signature; resolve customer by phone/email; create timeline activity.
 * Tenant is always derived from customer lookup, never from request.
 */
import * as customersDb from "@/modules/customers/db/customers";
import * as activityService from "@/modules/customers/service/activity";
import * as inboxMessageService from "@/modules/crm-inbox/service/messages";

const CONTENT_PREVIEW_MAX = 80;
const SMS_BODY_MAX = 1600;

export type InboundSmsPayload = {
  From: string;
  To: string;
  Body: string;
  MessageSid: string;
};

export type TwilioStatusPayload = {
  MessageSid: string;
  MessageStatus: string;
};

/** Normalize phone to digits for lookup. */
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "").trim();
}

/**
 * Verify Twilio request signature. Uses twilio.validateRequest.
 * url must be the full webhook URL Twilio used; params all POST/GET params.
 */
export async function verifyTwilioSignature(
  authToken: string,
  signature: string,
  url: string,
  params: Record<string, string>
): Promise<boolean> {
  if (!authToken || !signature) return false;
  const twilio = await import("twilio");
  return twilio.default.validateRequest(authToken, signature, url, params);
}

/**
 * Handle inbound SMS from Twilio. Resolve customer by primary phone; create sms_sent activity (inbound).
 * Returns true if handled, false if no customer match (caller may return 200 anyway).
 */
export async function handleInboundSms(payload: InboundSmsPayload): Promise<boolean> {
  const phone = normalizePhone(payload.From);
  const body = (payload.Body ?? "").trim().slice(0, SMS_BODY_MAX);
  if (!phone || !body) return false;

  const customer = await customersDb.getCustomerIdAndDealershipByPrimaryPhone(phone);
  if (!customer) return false;

  const contentPreview = body.slice(0, CONTENT_PREVIEW_MAX);
  await inboxMessageService.recordCanonicalMessage({
    dealershipId: customer.dealershipId,
    customerId: customer.customerId,
    channel: "SMS",
    provider: "twilio",
    providerMessageId: payload.MessageSid ?? null,
    providerThreadId: phone,
    direction: "INBOUND",
    phone,
    textBody: body,
    bodyPreview: contentPreview,
  });
  await activityService.logInboundMessage(
    customer.dealershipId,
    customer.customerId,
    "sms_sent",
    {
      contentPreview,
      channel: "sms",
      providerMessageId: payload.MessageSid ?? null,
      provider: "twilio",
    }
  );
  return true;
}

/**
 * Handle Twilio message status callback. Find activity by MessageSid; update delivery status.
 */
export async function handleTwilioStatusCallback(
  payload: TwilioStatusPayload
): Promise<boolean> {
  const sid = payload.MessageSid?.trim();
  const status = payload.MessageStatus?.trim();
  if (!sid || !status) return false;

  const updated = await activityService.updateMessageDeliveryStatus(sid, status);
  if (updated) {
    await inboxMessageService.appendProviderStatusEventByRawStatus(
      updated.dealershipId,
      "twilio",
      sid,
      status
    );
  }
  return updated != null;
}

export type InboundEmailPayload = {
  from: string;
  to: string;
  subject?: string;
  text?: string;
  html?: string;
};

/** Extract email from "Name <email>" or plain email. */
function extractEmail(from: string): string {
  const match = from.match(/<([^>]+)>/);
  return (match ? match[1] : from).trim().toLowerCase();
}

/**
 * Handle inbound email from SendGrid Inbound Parse. Resolve customer by sender (from) primary email; create email_sent activity (inbound).
 * Returns true if handled, false if no customer match.
 */
export async function handleInboundEmail(payload: InboundEmailPayload): Promise<boolean> {
  const email = extractEmail(payload.from ?? "");
  if (!email) return false;

  const customer = await customersDb.getCustomerIdAndDealershipByPrimaryEmail(email);
  if (!customer) return false;

  const body = payload.text ?? payload.html ?? "";
  const contentPreview =
    (payload.subject ?? "").trim().slice(0, 40) ||
    body.replace(/\s+/g, " ").trim().slice(0, CONTENT_PREVIEW_MAX);

  await inboxMessageService.recordCanonicalMessage({
    dealershipId: customer.dealershipId,
    customerId: customer.customerId,
    channel: "EMAIL",
    provider: "sendgrid",
    providerThreadId: email,
    direction: "INBOUND",
    email,
    textBody: body,
    bodyPreview: contentPreview,
    subject: payload.subject ?? null,
  });
  await activityService.logInboundMessage(
    customer.dealershipId,
    customer.customerId,
    "email_sent",
    {
      contentPreview,
      channel: "email",
      providerMessageId: null,
      provider: "sendgrid",
    }
  );
  return true;
}
