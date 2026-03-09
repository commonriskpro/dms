"use client";

import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/toast";
import { SkeletonList } from "@/components/ui/skeleton";
import { WidgetCard } from "./WidgetCard";
import type { WidgetRow } from "./types";
import { SignalList, type SignalListItem } from "@/components/ui-system/signals";
import {
  fetchDomainSignalItems,
  mapWidgetRowsToSignalItems,
  shouldToastSignalError,
} from "./intelligence-signals";

const ROW_HREF_BY_KEY: Record<string, string> = {
  appointments: "/customers",
  newProspects: "/crm/opportunities",
  inbox: "/customers",
  followUps: "/customers",
  creditApps: "/lenders",
};

export function CustomerTasksCard({
  rows,
  refreshToken,
  title = "Customer Tasks",
}: {
  rows: WidgetRow[];
  refreshToken?: number;
  title?: string;
}) {
  const [items, setItems] = useState<SignalListItem[]>(
    mapWidgetRowsToSignalItems(rows, ROW_HREF_BY_KEY)
  );
  const [loading, setLoading] = useState(false);
  const didMount = useRef(false);
  const { addToast } = useToast();

  useEffect(() => {
    if (refreshToken === undefined) return;
    if (!didMount.current) {
      didMount.current = true;
      return;
    }
    const ac = new AbortController();
    setLoading(true);
    fetchDomainSignalItems("crm", ac.signal)
      .then((nextItems) => setItems(nextItems))
      .catch((e) => {
        if (!shouldToastSignalError(e)) return;
        addToast("error", "Failed to refresh CRM signals");
      })
      .finally(() => {
        setLoading(false);
      });
    return () => ac.abort();
  }, [refreshToken, addToast]);

  // Sync initial/server data into state when rows prop changes (e.g. navigation)
  useEffect(() => {
    setItems(mapWidgetRowsToSignalItems(rows, ROW_HREF_BY_KEY));
  }, [rows]);

  return (
    <WidgetCard title={title} subtitle="Follow-ups and pending customer actions">
      {loading ? (
        <SkeletonList lines={5} />
      ) : (
        <SignalList
          items={items}
          emptyTitle="No CRM tasks"
          emptyDescription="Follow-ups, messaging inbox signals, and appointment activity will appear here."
        />
      )}
    </WidgetCard>
  );
}
