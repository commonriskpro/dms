"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  dashboardCard,
  dashboardTokens,
  radiusTokens,
  shadowTokens,
} from "@/lib/ui/tokens";

export type QuickActionsCardProps = {
  canAddVehicle: boolean;
  canAddLead: boolean;
  canStartDeal: boolean;
};

const ACTION_STYLE: Record<string, string> = {
  "Add Vehicle": `${dashboardTokens.primary} ${dashboardTokens.primaryHover} ${dashboardTokens.primaryFg} ${shadowTokens.card}`,
  "Add Lead": `${dashboardTokens.success} ${dashboardTokens.primaryFg} hover:opacity-90 ${shadowTokens.card}`,
  "Start Deal": `${dashboardTokens.primaryDeals} ${dashboardTokens.primaryDealsHover} ${dashboardTokens.primaryFg} ${shadowTokens.card}`,
};

function ActionIcon({ label }: { label: string }) {
  const className = "h-4 w-4 shrink-0";
  if (label === "Add Vehicle") {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
      </svg>
    );
  }
  if (label === "Add Lead") {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
      </svg>
    );
  }
  if (label === "Start Deal") {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  }
  return null;
}

export function QuickActionsCard({ canAddVehicle, canAddLead, canStartDeal }: QuickActionsCardProps) {
  const actions = [
    { label: "Add Vehicle", href: "/inventory/new", show: canAddVehicle },
    { label: "Add Lead", href: "/customers/new", show: canAddLead },
    { label: "Start Deal", href: "/deals/new", show: canStartDeal },
  ].filter((a) => a.show);

  if (actions.length === 0) {
    return (
      <Card className={dashboardCard}>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-base font-medium text-[var(--text)]">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <p className="text-sm text-[var(--text-soft)]">No actions available.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={dashboardCard}>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-base font-medium text-[var(--text)]">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="grid grid-cols-2 gap-3">
          {actions.map(({ label, href }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center justify-center gap-2 ${radiusTokens.button} h-11 text-sm font-medium transition-colors ${ACTION_STYLE[label] ?? `${dashboardTokens.surface2} ${dashboardTokens.text} hover:opacity-80`}`}
            >
              <ActionIcon label={label} />
              {label}
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
