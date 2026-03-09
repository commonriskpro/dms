import { InventoryRoiReportPage } from "@/modules/reporting-core/ui/InventoryRoiReportPage";
import { PageShell } from "@/components/ui/page-shell";

export const dynamic = "force-dynamic";

export default function ReportsInventoryRoiPage() {
  return (
    <PageShell>
      <InventoryRoiReportPage />
    </PageShell>
  );
}
