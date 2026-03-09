import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getActiveDealershipId } from "@/lib/tenant";
import { handleApiError, jsonResponse } from "@/lib/api/handler";
import * as onboardingService from "@/modules/onboarding/service/onboarding";

const TAIL_LENGTH = 6;

function tail(id: string): string {
  return id.slice(-TAIL_LENGTH);
}

function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  return (email[0] ?? "") + "***@" + email.slice(at + 1);
}

type NextAction = "CHECK_EMAIL_FOR_INVITE" | "SELECT_DEALERSHIP" | "NONE";

function computeNextAction(
  membershipsCount: number,
  hasActiveDealership: boolean,
  pendingInvitesCount: number
): NextAction {
  if (membershipsCount === 0 && pendingInvitesCount > 0) return "CHECK_EMAIL_FOR_INVITE";
  if (membershipsCount > 0 && !hasActiveDealership) return "SELECT_DEALERSHIP";
  return "NONE";
}

/**
 * GET /api/auth/onboarding-status — Current user's onboarding state (memberships, active dealership, pending invites).
 * No tokens or PII beyond masked email. Used by get-started and support flows.
 */
export async function GET() {
  try {
    const user = await requireUser();

    const [memberships, activeDealershipId, pendingCount] = await Promise.all([
      prisma.membership.findMany({
        where: { userId: user.userId, disabledAt: null },
        select: { id: true },
      }),
      getActiveDealershipId(user.userId),
      user.email
        ? prisma.dealershipInvite.count({
            where: {
              email: user.email.toLowerCase().trim(),
              status: "PENDING",
              OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
            },
          })
        : 0,
    ]);

    const membershipsCount = memberships.length;
    const hasActiveDealership = activeDealershipId != null;
    const nextAction = computeNextAction(membershipsCount, hasActiveDealership, pendingCount);

    let onboardingComplete: boolean | undefined;
    let onboardingCurrentStep: number | undefined;
    if (hasActiveDealership && activeDealershipId) {
      const state = await onboardingService.getOrCreateState(activeDealershipId);
      onboardingComplete = state.isComplete;
      onboardingCurrentStep = state.currentStep;
    }

    const data = {
      userIdTail: tail(user.userId),
      emailMasked: user.email ? maskEmail(user.email) : undefined,
      membershipsCount,
      hasActiveDealership,
      activeDealershipIdTail: activeDealershipId ? tail(activeDealershipId) : undefined,
      pendingInvitesCount: pendingCount,
      nextAction,
      ...(onboardingComplete !== undefined && {
        onboardingComplete,
        onboardingCurrentStep,
      }),
    };

    return jsonResponse({ data });
  } catch (e) {
    return handleApiError(e);
  }
}
