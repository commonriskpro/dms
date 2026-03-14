import { DealershipPage } from "@/modules/admin-core/ui/DealershipPage";
import { ModuleGuard } from "@/components/module-guard/ModuleGuard";

export default function AdminDealershipRoute() {
  return (
    <ModuleGuard moduleKey="admin" moduleName="Admin">
      <DealershipPage />
    </ModuleGuard>
  );
}
