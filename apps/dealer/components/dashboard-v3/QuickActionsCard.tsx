"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export type QuickActionsCardProps = {
  canAddVehicle: boolean;
  canAddLead: boolean;
  canStartDeal: boolean;
};

export function QuickActionsCard({ canAddVehicle, canAddLead, canStartDeal }: QuickActionsCardProps) {
  const actions = [
    { label: "Add Vehicle", href: "/inventory/new", show: canAddVehicle },
    { label: "Add Lead", href: "/customers/new", show: canAddLead },
    { label: "Start Deal", href: "/deals/new", show: canStartDeal },
  ].filter((a) => a.show);

  if (actions.length === 0) {
    return (
      <Card className="rounded-xl border border-[var(--border)]/60 shadow-sm bg-[var(--panel)] h-full">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-base font-semibold">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <p className="text-sm text-[var(--text-soft)]">No actions available.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-xl border border-[var(--border)]/60 shadow-sm bg-[var(--panel)] h-full">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-base font-semibold">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="grid grid-cols-2 gap-3">
          {actions.map(({ label, href }) => (
            <Link key={href} href={href}>
              <Button variant="secondary" className="w-full h-11 text-sm font-medium">
                {label}
              </Button>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
