import { SalespersonPerformanceReportPage } from "@/modules/reporting-core/ui/SalespersonPerformanceReportPage";
import { PageShell } from "@/components/ui/page-shell";

export const dynamic = "force-dynamic";

export default function ReportsSalespeoplePage() {
  return (
    <PageShell>
      <SalespersonPerformanceReportPage />
    </PageShell>
  );
}
