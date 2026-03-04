import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function CrmPromoCard() {
  return (
    <Card className="rounded-xl border border-[var(--border)]/60 shadow-sm bg-[var(--panel)] h-full">
      <CardContent className="p-4 flex flex-col justify-center h-full">
        <p className="text-sm font-medium text-[var(--text)]">CRM Workflows</p>
        <p className="text-xs text-[var(--text-soft)] mt-1">
          Automate follow-ups and sequences.
        </p>
        <Link href="/crm/automations" className="mt-3">
          <Button variant="secondary" size="sm" className="w-full">
            Set up automations
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
