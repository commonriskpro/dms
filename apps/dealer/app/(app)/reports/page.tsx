import { ModuleGuard } from "@/components/module-guard/ModuleGuard";
import { ReportsPage } from "@/modules/reports/ui/ReportsPage";

export default function ReportsRoutePage() {
  return (
    <ModuleGuard moduleKey="reports" moduleName="Reports">
      <ReportsPage />
    </ModuleGuard>
  );
}
