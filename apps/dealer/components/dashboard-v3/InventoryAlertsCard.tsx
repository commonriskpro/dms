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
  carsInRecon: "/inventory",
  pendingTasks: "/inventory",
  notPostedOnline: "/inventory",
  missingDocs: "/inventory",
  lowStock: "/inventory",
};

export function InventoryAlertsCard({
  rows,
  refreshToken,
}: {
  rows: WidgetRow[];
  refreshToken?: number;
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
    fetchDomainSignalItems("inventory", ac.signal)
      .then((nextItems) => setItems(nextItems))
      .catch((e) => {
        if (!shouldToastSignalError(e)) return;
        addToast("error", "Failed to refresh inventory signals");
      })
      .finally(() => {
        setLoading(false);
      });
    return () => ac.abort();
  }, [refreshToken, addToast]);

  useEffect(() => {
    setItems(mapWidgetRowsToSignalItems(rows, ROW_HREF_BY_KEY));
  }, [rows]);

  return (
    <WidgetCard title="Inventory Alerts">
      {loading ? (
        <SkeletonList lines={5} />
      ) : (
        <SignalList
          items={items}
          emptyTitle="No inventory alerts"
          emptyDescription="Aging, recon, pricing, and title signals will appear here."
        />
      )}
    </WidgetCard>
  );
}
