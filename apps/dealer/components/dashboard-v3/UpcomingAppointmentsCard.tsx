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
    <WidgetCard title={title}>
      <ul>
        {appointments.map((apt) => (
          <li
            key={apt.id}
            className="flex items-center gap-2.5 border-b border-[var(--border)] px-3 py-2 text-sm transition-colors last:border-b-0 hover:bg-[var(--surface-2)]/50"
          >
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-2)] text-[10px] font-semibold text-[var(--accent)]"
              aria-hidden
            >
              {apt.name.slice(0, 2).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[var(--text)]">{apt.name}</p>
              {apt.meta != null && (
                <p className="truncate text-sm text-[var(--muted-text)]">{apt.meta}</p>
              )}
            </div>
            {apt.timeLabel != null && (
              <span className="shrink-0 text-sm tabular-nums text-[var(--muted-text)]">{apt.timeLabel}</span>
            )}
          </li>
        ))}
      </ul>
    </WidgetCard>
  );
}
