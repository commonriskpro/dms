import { DealPipelineBoard } from "@/modules/deals/ui/board/DealPipelineBoard";
import { ModuleGuard } from "@/components/module-guard/ModuleGuard";

export default function DealsRoute() {
  return (
    <ModuleGuard moduleKey="deals" moduleName="Deals">
      <DealPipelineBoard />
    </ModuleGuard>
  );
}
