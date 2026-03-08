import { widgetRowSurface } from "@/lib/ui/tokens";
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
      <ul className="space-y-2">
        {appointments.map((apt) => (
          <li
            key={apt.id}
            className={`flex items-center gap-3 ${widgetRowSurface}`}
          >
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/20 text-xs font-medium text-[var(--accent)]"
              aria-hidden
            >
              {apt.name.slice(0, 2).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-[var(--text)] truncate">{apt.name}</p>
              {apt.meta != null && (
                <p className="text-xs text-[var(--text-soft)] truncate">{apt.meta}</p>
              )}
            </div>
            {apt.timeLabel != null && (
              <span className="text-xs text-[var(--text-soft)] shrink-0">{apt.timeLabel}</span>
            )}
          </li>
        ))}
      </ul>
    </WidgetCard>
  );
}
