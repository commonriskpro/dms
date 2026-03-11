"use client";

import * as React from "react";
import { AcquisitionColumn } from "./AcquisitionColumn";
import type { AcquisitionLeadRow } from "./page";

export type AcquisitionBoardProps = {
  stages: Record<string, AcquisitionLeadRow[]>;
  canWrite: boolean;
  onMutate: () => void;
};

const COLUMN_ORDER = ["NEW", "CONTACTED", "NEGOTIATING", "WON", "LOST"] as const;

export function AcquisitionBoard({ stages, canWrite, onMutate }: AcquisitionBoardProps) {
  return (
    <div className="grid grid-cols-1 gap-4 overflow-x-auto md:grid-cols-2 lg:grid-cols-3 min-[1800px]:grid-cols-5">
      {COLUMN_ORDER.map((status) => (
        <AcquisitionColumn
          key={status}
          status={status}
          leads={stages[status] ?? []}
          canWrite={canWrite}
          onMutate={onMutate}
        />
      ))}
    </div>
  );
}
