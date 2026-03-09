import { unstable_noStore as noStore } from "next/cache";
import { cookies } from "next/headers";
import { GetStartedClient, type DealershipOption } from "./GetStartedClient";

export const dynamic = "force-dynamic";

export type OnboardingStatusFromServer = {
  membershipsCount: number;
  hasActiveDealership: boolean;
  pendingInvitesCount: number;
  nextAction: "CHECK_EMAIL_FOR_INVITE" | "SELECT_DEALERSHIP" | "NONE";
  /** Present when hasActiveDealership: whether 6-step onboarding is complete. */
  onboardingComplete?: boolean;
  /** Present when hasActiveDealership: current step 1–6 for resumable flow. */
  onboardingCurrentStep?: number;
};

function getBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    (typeof process.env.VERCEL_URL === "string"
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000")
  );
}

async function fetchOnboardingStatus(cookieHeader: string): Promise<OnboardingStatusFromServer | null> {
  try {
    const res = await fetch(`${getBaseUrl()}/api/auth/onboarding-status`, {
      cache: "no-store",
      headers: { Cookie: cookieHeader },
    });
    if (!res.ok) return null;
    const json = await res.json().catch(() => ({}));
    const data = json?.data;
    if (!data || typeof data !== "object") return null;
    return {
      membershipsCount: Number(data.membershipsCount) ?? 0,
      hasActiveDealership: Boolean(data.hasActiveDealership),
      pendingInvitesCount: Number(data.pendingInvitesCount) ?? 0,
      nextAction: data.nextAction === "CHECK_EMAIL_FOR_INVITE" || data.nextAction === "SELECT_DEALERSHIP" ? data.nextAction : "NONE",
      ...(data.onboardingComplete !== undefined && {
        onboardingComplete: Boolean(data.onboardingComplete),
        onboardingCurrentStep: typeof data.onboardingCurrentStep === "number" ? data.onboardingCurrentStep : 1,
      }),
    };
  } catch {
    return null;
  }
}

async function fetchDealerships(cookieHeader: string): Promise<DealershipOption[]> {
  try {
    const res = await fetch(`${getBaseUrl()}/api/auth/dealerships`, {
      cache: "no-store",
      headers: { Cookie: cookieHeader },
    });
    if (!res.ok) return [];
    const json = await res.json().catch(() => ({}));
    const data = json?.data?.dealerships;
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export default async function GetStartedPage() {
  noStore();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const [onboardingStatus, dealerships] = await Promise.all([
    fetchOnboardingStatus(cookieHeader),
    fetchDealerships(cookieHeader),
  ]);

  return (
    <GetStartedClient
      initialOnboardingStatus={onboardingStatus}
      initialDealerships={dealerships}
    />
  );
}
