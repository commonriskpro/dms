/**
 * Date range presets and helpers for reports. Timezone fixed (America/New_York).
 */

const DEFAULT_TIMEZONE = "America/New_York";

export type DateRangePreset =
  | "today"
  | "last7"
  | "last30"
  | "mtd"
  | "qtd"
  | "ytd"
  | "custom";

export interface DateRange {
  from: string; // ISO date YYYY-MM-DD
  to: string;
  preset: DateRangePreset;
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfDayInTz(date: Date, tz: string): Date {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const y = parts.find((p) => p.type === "year")?.value ?? "2020";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return new Date(`${y}-${m}-${day}T00:00:00`);
}

/** Today in the given timezone (default America/New_York). */
export function getTodayInTz(tz: string = DEFAULT_TIMEZONE): Date {
  const now = new Date();
  return startOfDayInTz(now, tz);
}

/** Build date range for a preset. Uses timezone for "today" and calendar boundaries. */
export function getDateRangeForPreset(
  preset: DateRangePreset,
  customFrom?: string,
  customTo?: string,
  tz: string = DEFAULT_TIMEZONE
): DateRange {
  const today = getTodayInTz(tz);

  if (preset === "custom" && customFrom && customTo) {
    return { from: customFrom, to: customTo, preset: "custom" };
  }

  let from: Date;
  let to: Date = new Date(today);
  to.setDate(to.getDate() + 1);
  to.setMilliseconds(-1);

  switch (preset) {
    case "today":
      from = new Date(today);
      to = new Date(today);
      to.setHours(23, 59, 59, 999);
      break;
    case "last7":
      from = new Date(today);
      from.setDate(from.getDate() - 6);
      to = new Date(today);
      break;
    case "last30":
      from = new Date(today);
      from.setDate(from.getDate() - 29);
      to = new Date(today);
      break;
    case "mtd": {
      from = new Date(today.getFullYear(), today.getMonth(), 1);
      to = new Date(today);
      break;
    }
    case "qtd": {
      const q = Math.floor(today.getMonth() / 3) + 1;
      from = new Date(today.getFullYear(), (q - 1) * 3, 1);
      to = new Date(today);
      break;
    }
    case "ytd":
      from = new Date(today.getFullYear(), 0, 1);
      to = new Date(today);
      break;
    default:
      from = new Date(today);
      from.setDate(from.getDate() - 29);
      to = new Date(today);
  }

  return {
    from: toISODate(from),
    to: toISODate(to),
    preset: preset === "custom" ? "custom" : preset,
  };
}

export const REPORT_DATE_PRESETS: { value: DateRangePreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "last7", label: "Last 7 days" },
  { value: "last30", label: "Last 30 days" },
  { value: "mtd", label: "MTD" },
  { value: "qtd", label: "QTD" },
  { value: "ytd", label: "YTD" },
  { value: "custom", label: "Custom" },
];

export { DEFAULT_TIMEZONE as REPORTS_DEFAULT_TIMEZONE };
