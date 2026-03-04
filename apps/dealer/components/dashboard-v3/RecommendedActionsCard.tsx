"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { WidgetCard } from "./WidgetCard";
import type { WidgetRow } from "./types";

const MAX_ACTIONS = 4;

type ActionRule = {
  key: string;
  getCount: (rows: WidgetRow[]) => number;
  label: string;
  href: string;
  icon: "warning" | "doc" | "credit";
};

const RULES: ActionRule[] = [
  {
    key: "fundingIssues",
    getCount: (rows) => rows.find((r) => r.key === "fundingIssues")?.count ?? 0,
    label: "deals waiting funding approval",
    href: "/deals",
    icon: "warning",
  },
  {
    key: "missingDocs",
    getCount: (rows) => rows.find((r) => r.key === "missingDocs")?.count ?? 0,
    label: "missing vehicle documents",
    href: "/inventory",
    icon: "doc",
  },
  {
    key: "creditApps",
    getCount: (rows) => rows.find((r) => r.key === "creditApps")?.count ?? 0,
    label: "pending credit applications",
    href: "/lenders",
    icon: "credit",
  },
  {
    key: "carsInRecon",
    getCount: (rows) => rows.find((r) => r.key === "carsInRecon")?.count ?? 0,
    label: "vehicles in recon",
    href: "/inventory",
    icon: "warning",
  },
];

function getActions(
  customerTasks: WidgetRow[],
  inventoryAlerts: WidgetRow[],
  dealPipeline: WidgetRow[]
): { label: string; count: number; href: string; icon: ActionRule["icon"] }[] {
  const out: { label: string; count: number; href: string; icon: ActionRule["icon"] }[] = [];
  const dealCount = RULES[0].getCount(dealPipeline);
  if (dealCount > 0) out.push({ label: RULES[0].label, count: dealCount, href: RULES[0].href, icon: RULES[0].icon });
  const docCount = RULES[1].getCount(inventoryAlerts);
  if (docCount > 0) out.push({ label: RULES[1].label, count: docCount, href: RULES[1].href, icon: RULES[1].icon });
  const creditCount = RULES[2].getCount(customerTasks);
  if (creditCount > 0) out.push({ label: RULES[2].label, count: creditCount, href: RULES[2].href, icon: RULES[2].icon });
  const reconCount = RULES[3].getCount(inventoryAlerts);
  if (reconCount > 0) out.push({ label: RULES[3].label, count: reconCount, href: RULES[3].href, icon: RULES[3].icon });
  return out.slice(0, MAX_ACTIONS);
}

function ActionIcon({ icon }: { icon: ActionRule["icon"] }) {
  const className = "h-5 w-5 shrink-0 text-[var(--muted-text)]";
  if (icon === "warning") {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="var(--sev-warning)" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    );
  }
  if (icon === "doc") {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    );
  }
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

export type RecommendedActionsCardProps = {
  customerTasks: WidgetRow[];
  inventoryAlerts: WidgetRow[];
  dealPipeline: WidgetRow[];
};

const PLACEHOLDER_ACTIONS: { label: string; buttonLabel: string; href: string; icon: ActionRule["icon"] }[] = [
  { label: "2 deals need funding approval", buttonLabel: "Review deals", href: "/deals", icon: "warning" },
  { label: "missing vehicle documents", buttonLabel: "Upload docs", href: "/inventory", icon: "doc" },
  { label: "pending credit applications", buttonLabel: "Review apps", href: "/lenders", icon: "credit" },
];

type DisplayAction = { label: string; buttonLabel: string; href: string; icon: ActionRule["icon"] };

export function RecommendedActionsCard({
  customerTasks,
  inventoryAlerts,
  dealPipeline,
}: RecommendedActionsCardProps) {
  const router = useRouter();
  const actions = getActions(customerTasks, inventoryAlerts, dealPipeline);
  const displayActions: DisplayAction[] =
    actions.length > 0
      ? actions.map((a) => ({ label: `${a.count} ${a.label}`, buttonLabel: "Review", href: a.href, icon: a.icon }))
      : PLACEHOLDER_ACTIONS;

  return (
    <WidgetCard title="Recommended Actions">
      <ul className="space-y-3">
        {displayActions.map((action, i) => (
          <li
            key={`${action.href}-${action.label}-${i}`}
            className="rounded-[14px] border border-[var(--border)] bg-[var(--surface-2)] p-4"
          >
            <div className="flex gap-3">
              <ActionIcon icon={action.icon} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-[var(--text)]">{action.label}</div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="mt-2 h-8 rounded-[12px] border border-[var(--border)] bg-[var(--surface)] focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                  onClick={() => router.push(action.href)}
                >
                  {action.buttonLabel}
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </WidgetCard>
  );
}
