"use client";

import { useRouter } from "next/navigation";
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
  if (icon === "warning") {
    return (
      <span className="text-amber-600 font-medium" aria-hidden>
        ⚠
      </span>
    );
  }
  if (icon === "doc") {
    return (
      <span className="text-[var(--text-soft)]" aria-hidden>
        📄
      </span>
    );
  }
  return (
    <span className="text-[var(--text-soft)]" aria-hidden>
      ✓
    </span>
  );
}

export type RecommendedActionsCardProps = {
  customerTasks: WidgetRow[];
  inventoryAlerts: WidgetRow[];
  dealPipeline: WidgetRow[];
};

export function RecommendedActionsCard({
  customerTasks,
  inventoryAlerts,
  dealPipeline,
}: RecommendedActionsCardProps) {
  const router = useRouter();
  const actions = getActions(customerTasks, inventoryAlerts, dealPipeline);

  if (actions.length === 0) {
    return (
      <WidgetCard title="Recommended actions">
        <p className="text-sm text-[var(--text-soft)]">No recommended actions right now.</p>
      </WidgetCard>
    );
  }

  return (
    <WidgetCard title="Recommended actions">
      <ul className="space-y-2">
        {actions.map((action, i) => (
          <li
            key={`${action.href}-${action.label}-${i}`}
            className="flex items-center justify-between gap-2 rounded-md border border-[var(--border)]/60 bg-[var(--muted)]/30 px-3 py-2 text-sm"
          >
            <span className="flex items-center gap-2 min-w-0">
              <ActionIcon icon={action.icon} />
              <span className="text-[var(--text)] truncate">
                {action.count} {action.label}
              </span>
            </span>
            <button
              type="button"
              onClick={() => router.push(action.href)}
              className="shrink-0 text-xs font-medium text-[var(--accent)] hover:underline"
            >
              Review →
            </button>
          </li>
        ))}
      </ul>
    </WidgetCard>
  );
}
