import { getCurrentUser } from "@/lib/auth";
import * as inviteDb from "@/modules/platform-admin/db/invite";
import { handleApiError, jsonResponse } from "@/lib/api/handler";

/**
 * GET /api/invite/pending-check — Returns whether the current user (by email) has a pending invite.
 * Used by get-started when user has 0 memberships to show "check your email" CTA.
 * No token or PII in response.
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user?.email) {
      return jsonResponse({ hasPendingInvite: false });
    }
    const hasPendingInvite = await inviteDb.hasPendingInviteByEmail(user.email);
    return jsonResponse({ hasPendingInvite });
  } catch (e) {
    return handleApiError(e);
  }
}
