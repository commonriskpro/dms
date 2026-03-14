export type SalesRepSummaryItem = {
  id: string;
  title: string;
  detail: string;
  href: string;
  whenLabel?: string | null;
  severity?: "info" | "warning" | "danger";
};

export type SalesRepSummary = {
  kpis: {
    openOpportunities: number;
    dueNow: number;
    waitingConversations: number;
    overdueTasks: number;
    callbacksDueToday: number;
    inboundWaiting: number;
  };
  myTasksCount: number;
  dueNowItems: SalesRepSummaryItem[];
  myTasksSlice: { id: string; title: string; customerId: string; customerName: string }[];
  /** Stale prospects (no meaningful activity); link to customer. */
  staleProspects?: SalesRepSummaryItem[];
  /** Pipeline opportunities missing owner/next action/due date. */
  pipelineBlockers?: SalesRepSummaryItem[];
  /** Sequence exceptions (paused/failed). */
  sequenceExceptions?: SalesRepSummaryItem[];
};
