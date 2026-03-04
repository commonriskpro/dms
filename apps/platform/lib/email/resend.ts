/**
 * Server-only Resend client. Do not import in client components.
 * RESEND_API_KEY and PLATFORM_EMAIL_FROM must be set in production.
 */

import { Resend } from "resend";
import { getOwnerInviteEmailContent } from "./templates/owner-invite";

function getApiKey(): string {
  const key = process.env.RESEND_API_KEY;
  if (!key?.trim()) throw new Error("RESEND_API_KEY is not set");
  return key.trim();
}

function getFrom(): string {
  const from = process.env.PLATFORM_EMAIL_FROM;
  if (!from?.trim()) throw new Error("PLATFORM_EMAIL_FROM is not set");
  return from.trim();
}

export function createResendClient(): Resend {
  return new Resend(getApiKey());
}

export type SendOwnerInviteEmailParams = {
  toEmail: string;
  dealershipName: string;
  acceptUrl: string;
  supportEmail?: string;
};

export async function sendOwnerInviteEmail(params: SendOwnerInviteEmailParams): Promise<{ id?: string; error?: unknown }> {
  const client = createResendClient();
  const from = getFrom();
  const { html, text } = getOwnerInviteEmailContent({
    dealershipName: params.dealershipName,
    acceptUrl: params.acceptUrl,
    supportEmail: params.supportEmail,
  });
  const subject = `You've been invited to manage ${params.dealershipName}`;
  const { data, error } = await client.emails.send({
    from,
    to: [params.toEmail],
    subject,
    html,
    text,
  });
  if (error) return { error };
  return { id: data?.id };
}
