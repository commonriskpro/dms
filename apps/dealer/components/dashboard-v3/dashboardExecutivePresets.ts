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
    eyebrow: "GM / Owner preset",
    title: "Executive control tower",
    description:
      "A darker, more hierarchical command view built on the current dashboard payload: health, blockers, revenue flow, customer demand, and operational accountability.",
  },
  sales: {
    eyebrow: "Sales Manager preset",
    title: "Sales command board",
    description:
      "A role-weighted sales view built on the current dashboard payload: lead flow, customer demand, appointments, deal movement, and rep attention.",
    badge: {
      label: "Demand-first view",
      tone: "accent",
    },
  },
  ops: {
    eyebrow: "Ops / Desk preset",
    title: "Desk command board",
    description:
      "A blocker-first ops view built on the current dashboard payload: inventory readiness, finance pressure, desk throughput, and operational queue clearance.",
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
