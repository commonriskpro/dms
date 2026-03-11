/**
 * Map nextBestActionKey from API to display label.
 * Backend returns a key; we show a short hint. Add keys as backend adds them.
 */
const NEXT_BEST_ACTION_LABELS: Record<string, string> = {
  schedule_appointment: "Schedule appointment",
  schedule_follow_up: "Schedule follow-up",
  complete_tasks: "Complete overdue tasks",
  send_email: "Send email",
  phone_call: "Phone call",
  add_note: "Add note",
  move_to_next_stage: "Move to next stage",
};

export function getNextBestActionLabel(key: string): string {
  return NEXT_BEST_ACTION_LABELS[key] ?? key;
}
