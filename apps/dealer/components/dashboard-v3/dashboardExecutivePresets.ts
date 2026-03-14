export type DashboardPreset = "gm" | "sales" | "ops";

export type DashboardPresetMeta = {
  eyebrow: string;
  title: string;
  description: string;
  badge?: {
    label: string;
    tone: "accent" | "success" | "warning";
  };
};

export const DASHBOARD_PRESET_META: Record<DashboardPreset, DashboardPresetMeta> = {
  gm: {
    eyebrow: "Manager workspace",
    title: "Manager workspace",
    description:
      "Owner and GM home for business health, exceptions, and intervention. See how the store is doing, what’s at risk, what changed, and where to act—in under a minute.",
    badge: {
      label: "Owner / GM view",
      tone: "success",
    },
  },
  sales: {
    eyebrow: "Sales Manager preset",
    title: "Sales command board",
    description:
      "Demand-first view: lead flow, appointments, follow-up pressure, and deal movement for sales managers.",
    badge: {
      label: "Demand-first view",
      tone: "accent",
    },
  },
  ops: {
    eyebrow: "Ops / Desk preset",
    title: "Desk command board",
    description:
      "Blocker-first view: title, delivery, funding queues, inventory readiness, and desk throughput.",
    badge: {
      label: "Queue-clearance view",
      tone: "warning",
    },
  },
};

export function getDashboardPreset(value: string | null): DashboardPreset {
  if (value === "sales" || value === "ops") return value;
  return "gm";
}
