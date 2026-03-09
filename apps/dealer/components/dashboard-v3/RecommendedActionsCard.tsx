"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { WidgetCard } from "./WidgetCard";
import type { WidgetRow } from "./types";
import { AlertTriangle, FileText, CreditCard } from "@/lib/ui/icons";

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
  if (icon === "warning") return <AlertTriangle size={20} className={`${className} text-[var(--sev-warning)]`} aria-hidden />;
  if (icon === "doc") return <FileText size={20} className={className} aria-hidden />;
  return <CreditCard size={20} className={className} aria-hidden />;
}

export type RecommendedActionsCardProps = {
  customerTasks: WidgetRow[];
  inventoryAlerts: WidgetRow[];
  dealPipeline: WidgetRow[];
};

type DisplayAction = { label: string; buttonLabel: string; href: string; icon: ActionRule["icon"] };

export function RecommendedActionsCard({
  customerTasks,
  inventoryAlerts,
  dealPipeline,
}: RecommendedActionsCardProps) {
  const router = useRouter();
  const actions = getActions(customerTasks, inventoryAlerts, dealPipeline);
  const displayActions: DisplayAction[] = actions.map((a) => ({
    label: `${a.count} ${a.label}`,
    buttonLabel: "Review",
    href: a.href,
    icon: a.icon,
  }));

  return (
    <WidgetCard title="Recommended Actions">
      {displayActions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <p className="text-sm text-[var(--text-soft)]">No recommended actions right now.</p>
          <p className="text-xs text-[var(--muted-text)] mt-1">Actions appear when items need your attention.</p>
        </div>
      ) : (
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
      )}
    </WidgetCard>
  );
}
