import { LendersDirectoryPage } from "@/modules/lender-integration/ui/LendersDirectoryPage";
import { ModuleGuard } from "@/components/module-guard/ModuleGuard";

export default function LendersPage() {
  return (
    <ModuleGuard moduleKey="finance" moduleName="Integrations">
      <LendersDirectoryPage />
    </ModuleGuard>
  );
}
