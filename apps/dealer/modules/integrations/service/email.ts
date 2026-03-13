/**
 * Email messaging via SendGrid. Logs sent emails to customer timeline (activity).
 */
import * as customerService from "@/modules/customers/service/customer";
import * as activityService from "@/modules/customers/service/activity";
import * as inboxMessageService from "@/modules/crm-inbox/service/messages";
import { ApiError } from "@/lib/auth";

export type SendEmailResult = { activityId: string };

/** Send email to customer via SendGrid and log to timeline. No PII in logs. */
export async function sendEmailMessage(
  dealershipId: string,
  customerId: string,
  email: string,
  subject: string,
  body: string,
  userId: string
): Promise<SendEmailResult> {
  await customerService.getCustomer(dealershipId, customerId);

  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL ?? "noreply@example.com";
  const fromName = process.env.SENDGRID_FROM_NAME ?? "Dealership";

  if (apiKey) {
    const sgMail = await import("@sendgrid/mail");
    sgMail.default.setApiKey(apiKey);
    await sgMail.default.send({
      to: email,
      from: { email: fromEmail, name: fromName },
      subject,
      text: body,
      html: body.replace(/\n/g, "<br>"),
    });
  } else {
    throw new ApiError(
      "INTERNAL",
      "Email provider not configured (SENDGRID_API_KEY)"
    );
  }

  const preview = subject.trim().length > 0 ? subject.slice(0, 80) : body.slice(0, 80);
  const activity = await activityService.logMessageSent(
    dealershipId,
    userId,
    customerId,
    "email_sent",
    {
      direction: "outbound",
      contentPreview: preview,
      channel: "email",
    }
  );

  await inboxMessageService.recordCanonicalMessage({
    dealershipId,
    customerId,
    channel: "EMAIL",
    provider: "sendgrid",
    providerThreadId: email.trim().toLowerCase(),
    direction: "OUTBOUND",
    email,
    textBody: body,
    bodyPreview: preview,
    subject,
    senderUserId: userId,
  });

  return { activityId: activity.id };
}
