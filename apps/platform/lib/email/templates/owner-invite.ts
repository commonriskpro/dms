/**
 * Owner invite email content. No tracking pixels. HTML + plain text fallback.
 */

export type OwnerInviteEmailParams = {
  dealershipName: string;
  acceptUrl: string;
  supportEmail?: string;
};

export function getOwnerInviteEmailContent(params: OwnerInviteEmailParams): { html: string; text: string } {
  const { dealershipName, acceptUrl, supportEmail } = params;
  const supportLine = supportEmail
    ? `Questions? Contact support at ${supportEmail}.`
    : "Questions? Contact your platform administrator.";

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Invite to manage ${escapeHtml(dealershipName)}</title></head>
<body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #1a1a1a; max-width: 560px;">
  <p>You've been invited to manage <strong>${escapeHtml(dealershipName)}</strong> as an owner.</p>
  <p><a href="${escapeHtml(acceptUrl)}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px;">Accept invite</a></p>
  <p style="font-size: 0.875rem; color: #666;">This link is single-use. If you don't have an account, you'll be able to sign up after clicking.</p>
  <p style="font-size: 0.875rem; color: #666;">${escapeHtml(supportLine)}</p>
</body>
</html>`;

  const text = [
    `You've been invited to manage ${dealershipName} as an owner.`,
    "",
    `Accept invite: ${acceptUrl}`,
    "",
    "This link is single-use. If you don't have an account, you'll be able to sign up after clicking.",
    "",
    supportLine,
  ].join("\n");

  return { html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
