"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DealAuditEntry } from "../types";

export interface AuditPanelProps {
  audit: DealAuditEntry[];
  total: number;
}

export function AuditPanel({ audit, total }: AuditPanelProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-[var(--text)]">Audit trail</CardTitle>
      </CardHeader>
      <CardContent>
        {audit.length === 0 ? (
          <p className="text-sm text-[var(--muted-text)]">No audit entries.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {audit.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-baseline gap-x-2 border-b border-[var(--border)] pb-2 last:border-0 last:pb-0"
              >
                <span className="font-medium text-[var(--text)]">{a.action}</span>
                <span className="text-xs text-[var(--muted-text)]">
                  {new Date(a.createdAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
        {total > audit.length && (
          <p className="mt-2 text-xs text-[var(--muted-text)]">
            Showing {audit.length} of {total}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
