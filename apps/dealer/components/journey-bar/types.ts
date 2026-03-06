/** Single stage in the journey bar (matches API journey-bar response). */
export interface JourneyBarStage {
  id: string;
  name: string;
  order: number;
  colorKey?: string | null;
}

/** Signals returned with journey bar (display only). */
export interface JourneyBarSignals {
  overdueTaskCount?: number;
  nextAppointment?: { id: string; start: string } | null;
  lastActivityAt?: string | null;
}

/** Segment state derived from currentStageId and order. */
export type SegmentState = "completed" | "current" | "upcoming";
