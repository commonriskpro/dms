import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";
import { getSessionContextOrNull } from "@/lib/api/handler";
import { getDashboardV3Data } from "@/modules/dashboard/service/getDashboardV3Data";
import { DashboardV3Client } from "@/components/dashboard-v3/DashboardV3Client";
import { DashboardSwitchWrapper } from "@/components/dashboard-v3/DashboardSwitchWrapper";
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  noStore();

  const session = await getSessionContextOrNull();
  if (!session) {
    redirect("/login");
  }

  const canAccess =
    session.permissions.includes("customers.read") || session.permissions.includes("crm.read");
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

  const initialData = await getDashboardV3Data(
    session.activeDealershipId,
    session.userId,
    session.permissions
  );

  return (
    <DashboardSwitchWrapper>
      <div className="min-h-full bg-[var(--muted)]/30">
        <DashboardV3Client initialData={initialData} permissions={session.permissions} />
      </div>
    </DashboardSwitchWrapper>
  );
}
