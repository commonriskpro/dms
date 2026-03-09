import { prisma } from "@/lib/db";

export type TimelineEventType = "NOTE" | "CALL" | "CALLBACK" | "APPOINTMENT" | "SYSTEM";

export type TimelineEvent = {
  type: TimelineEventType;
  createdAt: Date;
  createdByUserId: string | null;
  payloadJson: Record<string, unknown>;
  sourceId: string;
};

export type ListTimelineOptions = {
  limit: number;
  offset: number;
  type?: TimelineEventType;
};

const ACTIVITY_TYPE_TO_TIMELINE: Record<string, TimelineEventType> = {
  call: "CALL",
  appointment_scheduled: "APPOINTMENT",
  sms_sent: "SYSTEM",
  email_sent: "SYSTEM",
  disposition_set: "SYSTEM",
  task_created: "SYSTEM",
  note_added: "SYSTEM",
};

function activityToTimelineType(activityType: string): TimelineEventType {
  return ACTIVITY_TYPE_TO_TIMELINE[activityType] ?? "SYSTEM";
}

/**
 * List timeline: aggregate CustomerNote (deletedAt null), CustomerActivity, CustomerCallback
 * into a common shape, merge-sort by createdAt desc, apply optional type filter and limit/offset.
 * Fetches a bounded window from each source to avoid unbounded reads.
 */
export async function listTimeline(
  dealershipId: string,
  customerId: string,
  options: ListTimelineOptions
): Promise<{ data: TimelineEvent[]; total: number }> {
  const { limit, offset, type: filterType } = options;
  const fetchLimit = Math.min(limit + offset + 100, 500);

  const [notes, activities, callbacks] = await Promise.all([
    prisma.customerNote.findMany({
      where: { dealershipId, customerId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: fetchLimit,
      select: { id: true, body: true, createdBy: true, createdAt: true },
    }),
    prisma.customerActivity.findMany({
      where: { dealershipId, customerId },
      orderBy: { createdAt: "desc" },
      take: fetchLimit,
      select: { id: true, activityType: true, metadata: true, actorId: true, createdAt: true },
    }),
    prisma.customerCallback.findMany({
      where: { dealershipId, customerId },
      orderBy: { createdAt: "desc" },
      take: fetchLimit,
      select: {
        id: true,
        callbackAt: true,
        status: true,
        reason: true,
        snoozedUntil: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  ]);

  const events: TimelineEvent[] = [];

  for (const n of notes) {
    events.push({
      type: "NOTE",
      createdAt: n.createdAt,
      createdByUserId: n.createdBy,
      payloadJson: { body: n.body },
      sourceId: n.id,
    });
  }
  for (const a of activities) {
    const eventType = activityToTimelineType(a.activityType);
    events.push({
      type: eventType,
      createdAt: a.createdAt,
      createdByUserId: a.actorId,
      payloadJson: (a.metadata as Record<string, unknown>) ?? {},
      sourceId: a.id,
    });
  }
  for (const c of callbacks) {
    events.push({
      type: "CALLBACK",
      createdAt: c.createdAt,
      createdByUserId: null,
      payloadJson: {
        callbackAt: c.callbackAt.toISOString(),
        status: c.status,
        reason: c.reason,
        snoozedUntil: c.snoozedUntil?.toISOString() ?? null,
        updatedAt: c.updatedAt.toISOString(),
      },
      sourceId: c.id,
    });
  }

  events.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const filtered = filterType ? events.filter((e) => e.type === filterType) : events;
  const total = filtered.length;
  const data = filtered.slice(offset, offset + limit);

  return { data, total };
}
