/**
 * SMS messaging via Twilio. Logs sent messages to customer timeline (activity).
 */
import * as customerService from "@/modules/customers/service/customer";
import * as activityService from "@/modules/customers/service/activity";
import * as inboxMessageService from "@/modules/crm-inbox/service/messages";
import { ApiError } from "@/lib/auth";

export type SendSmsResult = { activityId: string };

/** Send SMS to customer phone via Twilio and log to timeline. No PII in logs. */
export async function sendSmsMessage(
  dealershipId: string,
  customerId: string,
  phone: string,
  message: string,
  userId: string
): Promise<SendSmsResult> {
  await customerService.getCustomer(dealershipId, customerId);

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  let twilioSid: string | null = null;
  if (accountSid && authToken && fromNumber) {
    const twilio = await import("twilio");
    const client = twilio.default(accountSid, authToken);
    const sent = await client.messages.create({
      body: message,
      from: fromNumber,
      to: phone,
    });
    twilioSid = sent.sid;
  } else {
    throw new ApiError(
      "INTERNAL",
      "SMS provider not configured (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER)"
    );
  }

  const activity = await activityService.logMessageSent(
    dealershipId,
    userId,
    customerId,
    "sms_sent",
    {
      direction: "outbound",
      contentPreview: message.slice(0, 80),
      channel: "sms",
      providerMessageId: twilioSid,
      provider: "twilio",
      deliveryStatus: "sent",
    }
  );

  await inboxMessageService.recordCanonicalMessage({
    dealershipId,
    customerId,
    channel: "SMS",
    provider: "twilio",
    providerMessageId: twilioSid,
    direction: "OUTBOUND",
    phone,
    textBody: message,
    bodyPreview: message,
    senderUserId: userId,
  });

  return { activityId: activity.id };
}
