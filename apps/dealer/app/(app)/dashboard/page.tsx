import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";
import { getSessionContextOrNull } from "@/lib/api/handler";
import { getDashboardV3Data } from "@/modules/dashboard/service/getDashboardV3Data";
import { getSavedLayout } from "@/modules/dashboard/service/dashboard-layout-persistence";
import { mergeDashboardLayout, toSerializableLayout } from "@/modules/dashboard/service/merge-dashboard-layout";
import {
  getCachedEffectiveLayout,
  setCachedEffectiveLayout,
} from "@/modules/dashboard/service/dashboard-layout-cache";
import { DashboardExecutiveClient } from "@/components/dashboard-v3/DashboardExecutiveClient";
import { DashboardSwitchWrapper } from "@/components/dashboard-v3/DashboardSwitchWrapper";
import { dashboardPageBg } from "@/lib/ui/tokens";
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  noStore();

  const session = await getSessionContextOrNull();
  if (!session) {
    redirect("/login");
  }

  const canAccess = session.permissions.includes("dashboard.read");
  if (!canAccess) {
    return (
      <DashboardSwitchWrapper>
        <div className="rounded-xl border border-[var(--border)]/60 bg-[var(--panel)] p-6">
          <p className="text-[var(--text-soft)]">
            You don&apos;t have access to the dashboard.
          </p>
        </div>
      </DashboardSwitchWrapper>
    );
  }

  if (!session.activeDealershipId) {
    return (
      <DashboardSwitchWrapper>
        <div className="rounded-xl border border-[var(--border)]/60 bg-[var(--panel)] p-6">
          <p className="text-[var(--text-soft)]">
            Select a dealership to continue.
          </p>
        </div>
      </DashboardSwitchWrapper>
    );
  }

  const dealershipId = session.activeDealershipId;
  const userId = session.userId;
  const permissions = session.permissions;

  const [initialData, layout] = await Promise.all([
    getDashboardV3Data(dealershipId, userId, permissions),
    (async () => {
      const cached = getCachedEffectiveLayout(dealershipId, userId);
      if (cached != null && cached.length > 0) return cached;
      const savedLayoutRaw = await getSavedLayout({ dealershipId, userId });
      const effectiveLayout = mergeDashboardLayout({ permissions, savedLayoutRaw });
      const result = toSerializableLayout(effectiveLayout);
      setCachedEffectiveLayout(dealershipId, userId, result);
      return result;
    })(),
  ]);

  return (
    <DashboardSwitchWrapper>
      <div className={dashboardPageBg}>
        <DashboardExecutiveClient
          initialData={initialData}
          permissions={session.permissions}
          userId={session.userId}
          activeDealershipId={session.activeDealershipId}
          layout={layout}
        />
      </div>
    </DashboardSwitchWrapper>
  );
}
