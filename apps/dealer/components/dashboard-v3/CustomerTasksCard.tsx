import { WidgetCard } from "./WidgetCard";
import type { DashboardV3CustomerTasks } from "./types";

export function CustomerTasksCard({ customerTasks }: { customerTasks: DashboardV3CustomerTasks }) {
  const items = [
    { label: "Appointments", count: customerTasks.appointments, color: "bg-blue-500" },
    { label: "New Prospects", count: customerTasks.newProspects, color: "bg-emerald-500" },
    { label: "Inbox", count: customerTasks.inbox, color: "bg-amber-500" },
    { label: "Follow-ups", count: customerTasks.followUps, color: "bg-violet-500" },
    { label: "Credit Apps", count: customerTasks.creditApps, color: "bg-slate-500" },
  ];
  return (
    <WidgetCard title="Customer Tasks">
      <ul className="space-y-2">
        {items.map(({ label, count, color }) => (
          <li
            key={label}
            className="flex items-center justify-between rounded-md border border-[var(--border)]/60 bg-[var(--muted)]/30 px-3 py-2 text-sm"
          >
            <span className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${color}`} aria-hidden />
              <span className="text-[var(--text)]">{label}</span>
            </span>
            <span className="font-semibold text-[var(--accent)]">{count}</span>
          </li>
        ))}
      </ul>
    </WidgetCard>
  );
}
