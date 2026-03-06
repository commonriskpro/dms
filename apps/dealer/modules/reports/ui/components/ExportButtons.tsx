"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/toast";
import { HttpError } from "@/lib/client/http";

export interface ExportButtonsProps {
  canExport: boolean;
  dateFrom: string;
  dateTo: string;
  asOf: string; // ISO date for inventory
}

const API_BASE = "";

export function ExportButtons({
  canExport,
  dateFrom,
  dateTo,
  asOf,
}: ExportButtonsProps) {
  const { addToast } = useToast();
  const [exportingSales, setExportingSales] = React.useState(false);
  const [exportingInventory, setExportingInventory] = React.useState(false);

  const handleExport = React.useCallback(
    async (type: "sales" | "inventory") => {
      if (!canExport) return;
      const setLoading =
        type === "sales" ? setExportingSales : setExportingInventory;
      setLoading(true);
      try {
        const url =
          type === "sales"
            ? `${API_BASE}/api/reports/export/sales?from=${encodeURIComponent(dateFrom)}&to=${encodeURIComponent(dateTo)}&format=csv`
            : `${API_BASE}/api/reports/export/inventory?asOf=${encodeURIComponent(asOf)}&format=csv`;
        const res = await fetch(url, { credentials: "include" });
        if (!res.ok) {
          const isJson = (res.headers.get("content-type") || "").includes(
            "application/json"
          );
          const body = isJson ? await res.json() : null;
          const message =
            body?.error?.message || `${res.status} ${res.statusText}`;
          if (res.status === 403) {
            addToast("error", "Not allowed to export.");
            return;
          }
          if (res.status === 429) {
            addToast("error", "Rate limited — try again soon.");
            return;
          }
          addToast("error", message);
          return;
        }
        const blob = await res.blob();
        const disposition = res.headers.get("Content-Disposition");
        const match = disposition?.match(/filename="?([^";]+)"?/);
        const filename =
          match?.[1] ||
          (type === "sales"
            ? `sales-${dateFrom}-${dateTo}.csv`
            : `inventory-${asOf}.csv`);
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = objectUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(objectUrl);
        addToast("success", "Export downloaded.");
      } catch (e) {
        if (e instanceof HttpError) {
          if (e.status === 403) addToast("error", "Not allowed to export.");
          else if (e.status === 429)
            addToast("error", "Rate limited — try again soon.");
          else addToast("error", e.message);
        } else {
          addToast("error", "Export failed.");
        }
      } finally {
        setLoading(false);
      }
    },
    [canExport, dateFrom, dateTo, asOf, addToast]
  );

  if (!canExport) return null;

  return (
    <div className="flex gap-2">
      <Button
        variant="secondary"
        size="sm"
        onClick={() => handleExport("sales")}
        disabled={exportingSales || exportingInventory}
        aria-label="Export Sales CSV"
      >
        {exportingSales ? "Exporting…" : "Export Sales CSV"}
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => handleExport("inventory")}
        disabled={exportingSales || exportingInventory}
        aria-label="Export Inventory CSV"
      >
        {exportingInventory ? "Exporting…" : "Export Inventory CSV"}
      </Button>
    </div>
  );
}
