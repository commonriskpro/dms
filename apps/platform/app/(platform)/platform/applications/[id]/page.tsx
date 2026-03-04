import { cookies } from "next/headers";
import { ApplicationDetailClient } from "./ApplicationDetailClient";
import type { OnboardingStatusData } from "./OnboardingStatusPanel";

export const dynamic = "force-dynamic";

function getBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_PLATFORM_ORIGIN ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3001"
  );
}

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cookieStore = await cookies();
  const base = getBaseUrl();
  let initialOnboardingStatus: OnboardingStatusData | null = null;

  try {
    const res = await fetch(
      `${base}/api/platform/applications/${id}/onboarding-status`,
      {
        cache: "no-store",
        headers: { Cookie: cookieStore.toString() },
      }
    );
    if (res.ok) {
      const json = await res.json();
      const raw = json?.data;
      if (raw && typeof raw === "object") {
        const { contactEmailMasked, contactEmailHash, ...safe } = raw;
        initialOnboardingStatus = safe as OnboardingStatusData;
      }
    }
  } catch {
    // leave null; client still shows details
  }

  return (
    <ApplicationDetailClient
      appId={id}
      initialOnboardingStatus={initialOnboardingStatus}
    />
  );
}
