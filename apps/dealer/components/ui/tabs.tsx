"use client";

import * as React from "react";

export function Tabs({
  value,
  onValueChange,
  children,
  "aria-label": ariaLabel = "Tabs",
}: {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
  "aria-label"?: string;
}) {
  return (
    <div role="tablist" aria-label={ariaLabel} className="flex flex-col">
      {children}
    </div>
  );
}

export function TabsList({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex gap-1 border-b border-[var(--border)] mb-4 ${className}`}
      role="presentation"
    >
      {children}
    </div>
  );
}

export function TabsTrigger({
  value,
  selected,
  onSelect,
  children,
  id,
}: {
  value: string;
  selected: boolean;
  onSelect: () => void;
  children: React.ReactNode;
  id?: string;
}) {
  const triggerId = id ?? `tab-${value}`;
  return (
    <button
      type="button"
      role="tab"
      id={triggerId}
      aria-selected={selected}
      aria-controls={`panel-${value}`}
      tabIndex={selected ? 0 : -1}
      onClick={onSelect}
      className={`px-4 py-2 text-sm font-medium rounded-t border-b-2 -mb-px transition-colors focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-0 ${
        selected
          ? "border-[var(--accent)] text-[var(--accent)]"
          : "border-transparent text-[var(--text-soft)] hover:text-[var(--text)]"
      }`}
    >
      {children}
    </button>
  );
}

export function TabsContent({
  value,
  selected,
  children,
  id,
}: {
  value: string;
  selected: boolean;
  children: React.ReactNode;
  id?: string;
}) {
  const panelId = id ?? `panel-${value}`;
  if (!selected) return null;
  return (
    <div
      role="tabpanel"
      id={panelId}
      aria-labelledby={`tab-${value}`}
      className="outline-none"
    >
      {children}
    </div>
  );
}
