import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";
import { getSessionContextOrNull } from "@/lib/api/handler";
import { getCommandCenterData } from "@/modules/crm-pipeline-automation/service/command-center";
import * as taskService from "@/modules/customers/service/task";
import { SalesHubClient, type SalesRepSummary } from "@/components/sales/SalesHubClient";
import { ModuleGuard } from "@/components/module-guard/ModuleGuard";

export const dynamic = "force-dynamic";

const SALES_REP_PERMISSIONS = ["crm.read", "deals.read", "customers.read"] as const;

function canAccessSales(permissions: string[]): boolean {
  return SALES_REP_PERMISSIONS.some((p) => permissions.includes(p));
}

export default async function SalesPage() {
  noStore();

  const session = await getSessionContextOrNull();
  if (!session) {
    redirect("/login");
  }

  if (!session.activeDealershipId) {
    redirect("/get-started");
  }

  if (!canAccessSales(session.permissions)) {
    redirect("/dashboard");
  }

  const dealershipId = session.activeDealershipId;
  const userId = session.userId;
  const permissions = session.permissions;
  const canCrm = permissions.includes("crm.read");
  const canCustomers = permissions.includes("customers.read");

  const emptyKpis = {
    openOpportunities: 0,
    dueNow: 0,
    waitingConversations: 0,
    overdueTasks: 0,
    callbacksDueToday: 0,
    inboundWaiting: 0,
  };

  let commandCenter: Awaited<ReturnType<typeof getCommandCenterData>> | null = null;
  let myTasks: Awaited<ReturnType<typeof taskService.listMyTasks>> = [];

  if (canCrm || canCustomers) {
    const [cc, tasks] = await Promise.all([
      canCrm ? getCommandCenterData(dealershipId, userId, { scope: "mine" }) : null,
      (canCustomers || canCrm) && userId
        ? taskService.listMyTasks(dealershipId, userId, 20)
        : Promise.resolve([]),
    ]);
    commandCenter = cc;
    myTasks = tasks;
  }

  const kpis = commandCenter
    ? {
        openOpportunities: commandCenter.kpis.openOpportunities,
        dueNow: commandCenter.kpis.dueNow,
        waitingConversations: commandCenter.kpis.waitingConversations,
        overdueTasks: commandCenter.pressure.overdueTasks,
        callbacksDueToday: commandCenter.pressure.callbacksDueToday,
        inboundWaiting: commandCenter.pressure.inboundWaiting,
      }
    : emptyKpis;

  const mapSectionItem = (item: { id: string; title: string; detail: string; href: string; whenLabel?: string | null; severity?: "info" | "warning" | "danger" }) => ({
    id: item.id,
    title: item.title,
    detail: item.detail,
    href: item.href,
    whenLabel: item.whenLabel ?? undefined,
    severity: item.severity,
  });

  const dueNowItems = commandCenter?.sections.dueNow.slice(0, 10).map(mapSectionItem) ?? [];
  const staleProspects = commandCenter?.sections.staleProspects?.slice(0, 10).map(mapSectionItem);
  const pipelineBlockers = commandCenter?.sections.pipelineBlockers?.slice(0, 5).map(mapSectionItem);
  const sequenceExceptions = commandCenter?.sections.sequenceExceptions?.slice(0, 5).map(mapSectionItem);

  const myTasksSlice = myTasks.slice(0, 10).map((t) => ({
    id: t.id,
    title: t.title,
    customerId: t.customerId,
    customerName: t.customerName,
  }));

  const summary: SalesRepSummary = {
    kpis,
    myTasksCount: myTasks.length,
    dueNowItems,
    myTasksSlice,
    ...(staleProspects?.length ? { staleProspects } : {}),
    ...(pipelineBlockers?.length ? { pipelineBlockers } : {}),
    ...(sequenceExceptions?.length ? { sequenceExceptions } : {}),
  };

  return (
    <ModuleGuard moduleKey="crm" moduleName="Sales">
      <SalesHubClient summary={summary} permissions={permissions} />
    </ModuleGuard>
  );
}
