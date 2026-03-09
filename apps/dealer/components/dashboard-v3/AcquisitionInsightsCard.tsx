"use client";

import * as React from "react";
import { WidgetCard } from "./WidgetCard";
import { SignalList, type SignalListItem } from "@/components/ui-system/signals";
import { fetchDomainSignalItems } from "./intelligence-signals";

export function AcquisitionInsightsCard({
  refreshToken,
  canRead = true,
}: {
  refreshToken?: number;
  canRead?: boolean;
}) {
  const [items, setItems] = React.useState<SignalListItem[]>([]);
  const [readAllowed, setReadAllowed] = React.useState(canRead);

  React.useEffect(() => {
    if (process.env.NODE_ENV === "test") return;
    if (!canRead) {
      setReadAllowed(false);
      setItems([]);
      return;
    }
    const ac = new AbortController();
    let mounted = true;
    fetchDomainSignalItems("acquisition", ac.signal)
      .then((next) => {
        if (!mounted) return;
        setReadAllowed(true);
        setItems(next);
      })
      .catch(() => {
        if (!mounted) return;
        setReadAllowed(false);
        setItems([]);
      });
    return () => {
      mounted = false;
      ac.abort();
    };
  }, [canRead, refreshToken]);

  return (
    <WidgetCard title="Acquisition" subtitle="Appraisal and opportunity signals">
      {!readAllowed ? (
        <p className="text-sm text-[var(--muted-text)]">Acquisition insights unavailable.</p>
      ) : (
        <SignalList
          items={items}
          emptyTitle="No acquisition signals"
          emptyDescription="Appraisal opportunities and acquisition insights will appear here."
        />
      )}
    </WidgetCard>
  );
}
