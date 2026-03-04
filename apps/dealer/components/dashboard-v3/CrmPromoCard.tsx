import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function CrmPromoCard() {
  return (
    <Card className="rounded-xl border border-[var(--border)]/40 bg-[var(--panel)] shadow-sm hover:shadow-md transition-shadow h-full">
      <CardContent className="p-4 flex flex-col justify-center h-full">
        <p className="text-base font-medium text-[var(--text)]">CRM Workflows</p>
        <p className="text-xs text-[var(--text-soft)] mt-1">
          Automate follow-ups and sequences.
        </p>
        <Link href="/crm/automations" className="mt-3">
          <Button variant="secondary" size="sm" className="w-full rounded-lg shadow-sm">
            Set up automations
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
