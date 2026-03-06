import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { dashboardCard, radiusTokens, shadowTokens } from "@/lib/ui/tokens";

export function CrmPromoCard() {
  return (
    <Card className={dashboardCard}>
      <CardContent className="p-4 flex flex-col justify-center h-full">
        <p className="text-base font-medium text-[var(--text)]">CRM Workflows</p>
        <p className="text-xs text-[var(--text-soft)] mt-1">
          Automate follow-ups and sequences.
        </p>
        <Link href="/crm/automations" className="mt-3">
          <Button variant="secondary" size="sm" className={`w-full ${radiusTokens.button} ${shadowTokens.card}`}>
            Set up automations
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
