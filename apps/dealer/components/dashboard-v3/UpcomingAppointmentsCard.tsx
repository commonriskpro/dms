import { WidgetCard } from "./WidgetCard";
import type { DashboardV3Appointment } from "./types";

export function UpcomingAppointmentsCard({
  appointments,
  title = "Upcoming Appointments",
}: {
  appointments: DashboardV3Appointment[];
  title?: string;
}) {
  if (appointments.length === 0) {
    return (
      <WidgetCard title={title}>
        <p className="text-sm text-[var(--text-soft)]">No upcoming appointments.</p>
      </WidgetCard>
    );
  }
  return (
    <WidgetCard title={title} subtitle="Inbox and follow-up pulse">
      <ul className="space-y-1">
        {appointments.map((apt) => (
          <li
            key={apt.id}
            className="flex min-h-[36px] items-center gap-2.5 rounded-[12px] border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1.5 text-sm"
          >
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[10px] font-semibold text-[var(--accent)]"
              aria-hidden
            >
              {apt.name.slice(0, 2).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-[var(--text)]">{apt.name}</p>
              {apt.meta != null && (
                <p className="truncate text-[11px] text-[var(--text-soft)]">{apt.meta}</p>
              )}
            </div>
            {apt.timeLabel != null && (
              <span className="shrink-0 text-[11px] tabular-nums text-[var(--text-soft)]">{apt.timeLabel}</span>
            )}
          </li>
        ))}
      </ul>
    </WidgetCard>
  );
}
