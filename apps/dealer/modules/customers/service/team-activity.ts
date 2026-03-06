/**
 * Team activity today for inventory dashboard: calls, appointments, notes, callbacks, deals started.
 * All counts for today (start of day UTC). Dealership-scoped and bounded.
 */
import * as notesDb from "../db/notes";
import * as activityDb from "../db/activity";
import * as callbacksDb from "../db/callbacks";
import * as dealDb from "@/modules/deals/db/deal";
import { requireTenantActiveForRead } from "@/lib/tenant-status";

export type TeamActivityToday = {
  callsLogged: number;
  appointmentsSet: number;
  notesAdded: number;
  callbacksScheduled: number;
  dealsStarted: number;
};

/** Activity type strings used for calls and appointments (timeline/dashboard). */
const ACTIVITY_TYPE_CALL = "call";
const ACTIVITY_TYPE_APPOINTMENT = "appointment_scheduled";

export async function getTeamActivityToday(
  dealershipId: string
): Promise<TeamActivityToday> {
  await requireTenantActiveForRead(dealershipId);
  const [callsLogged, appointmentsSet, notesAdded, callbacksScheduled, dealsStarted] =
    await Promise.all([
      activityDb.countActivitiesByTypeToday(dealershipId, [ACTIVITY_TYPE_CALL]),
      activityDb.countActivitiesByTypeToday(dealershipId, [
        ACTIVITY_TYPE_APPOINTMENT,
      ]),
      notesDb.countNotesCreatedToday(dealershipId),
      callbacksDb.countCallbacksCreatedToday(dealershipId),
      dealDb.countDealsCreatedToday(dealershipId),
    ]);
  return {
    callsLogged,
    appointmentsSet,
    notesAdded,
    callbacksScheduled,
    dealsStarted,
  };
}
