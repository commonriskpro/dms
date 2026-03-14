import { WebsiteOverviewPage } from "@/modules/websites-core/ui/WebsiteOverviewPage";
import { ModuleGuard } from "@/components/module-guard/ModuleGuard";

export const metadata = { title: "Website | DealerOS" };

export default function WebsitesPage() {
  return (
    <ModuleGuard moduleKey="websites" moduleName="Websites">
      <WebsiteOverviewPage />
    </ModuleGuard>
  );
}
