import { DealerProfitReportPage } from "@/modules/reporting-core/ui/DealerProfitReportPage";
import { PageShell } from "@/components/ui/page-shell";

export const dynamic = "force-dynamic";

export default function ReportsProfitPage() {
  return (
    <PageShell>
      <DealerProfitReportPage />
    </PageShell>
  );
}
