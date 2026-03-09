"use client";

import * as React from "react";
import Link from "next/link";
import type { SignalSurfaceItem } from "@/components/ui-system/signals";

export type DealNextActionLineProps = {
  blockerSignals: SignalSurfaceItem[];
};

export function DealNextActionLine({ blockerSignals }: DealNextActionLineProps) {
  const first = blockerSignals[0];
  const href = first?.actionHref;
  const label = first?.actionLabel;

  if (first && href && label) {
    const external = href.startsWith("http");
    return (
      <p className="text-sm text-[var(--text-soft)]">
        Next:{" "}
        {external ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-[var(--accent)] hover:underline"
          >
            {label}
          </a>
        ) : (
          <Link href={href} className="font-medium text-[var(--accent)] hover:underline">
            {label}
          </Link>
        )}
      </p>
    );
  }
  return (
    <p className="text-sm text-[var(--text-soft)]">Next: No blocking actions.</p>
  );
}
