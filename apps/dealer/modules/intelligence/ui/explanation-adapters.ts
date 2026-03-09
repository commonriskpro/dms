import type { SignalSurfaceItem } from "@/components/ui-system/signals";

export type SignalExplanation = {
  problem: string;
  whyItMatters: string;
  nextAction: { label: string; href: string } | null;
};

const CODE_WHY_IT_MATTERS: Record<string, string> = {
  "deals.funding_delay": "Slows cash collection and can affect floor plan.",
  "operations.title_backlog": "Delays customer delivery and can create compliance risk.",
  "operations.delivery_hold": "Prevents vehicle delivery until cleared.",
  "inventory.aged_90d": "Vehicles over 90 days reduce turn and margin.",
  "inventory.recon_pending": "Unreconciled units delay listing and sale.",
  "inventory.missing_photos": "Photos improve listing quality and turn.",
  "crm.uncontacted_lead": "Uncontacted leads cool quickly.",
  "crm.overdue_task": "Overdue tasks can lose the customer.",
  "crm.missed_appointment": "Missed appointments hurt conversion.",
};

const CODE_NEXT_ACTION: Record<string, { label: string; href: string }> = {
  "deals.funding_delay": { label: "Review funding status", href: "#funding" },
  "operations.title_backlog": { label: "Open title queue", href: "/queues/title" },
  "operations.delivery_hold": { label: "Check delivery status", href: "#delivery" },
  "inventory.aged_90d": { label: "View aging report", href: "/inventory" },
  "inventory.recon_pending": { label: "Complete recon", href: "#recon" },
  "inventory.missing_photos": { label: "Add photos", href: "#photos" },
  "crm.uncontacted_lead": { label: "Contact lead", href: "#tasks" },
  "crm.overdue_task": { label: "Open tasks", href: "#tasks" },
  "crm.missed_appointment": { label: "Reschedule", href: "#tasks" },
};

/**
 * Derives a workflow explanation from a surface item (UI only).
 * Uses title, description, actionLabel, actionHref; falls back to code-based copy.
 */
export function toSignalExplanation(item: SignalSurfaceItem): SignalExplanation {
  const problem = item.title || "Signal";
  const whyItMatters =
    item.description?.trim() || CODE_WHY_IT_MATTERS[item.code] || "Review and take action if needed.";
  let nextAction: { label: string; href: string } | null = null;
  if (item.actionHref?.trim()) {
    nextAction = {
      label: item.actionLabel?.trim() || "View details",
      href: item.actionHref.trim(),
    };
  } else {
    const fallback = CODE_NEXT_ACTION[item.code];
    if (fallback) nextAction = fallback;
  }
  return { problem, whyItMatters, nextAction };
}
