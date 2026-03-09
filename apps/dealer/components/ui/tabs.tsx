"use client";

import * as React from "react";

type TabsContextValue = {
  value: string;
  onValueChange: (value: string) => void;
};

const TabsContext = React.createContext<TabsContextValue | null>(null);

export function Tabs({
  value,
  onValueChange,
  children,
  "aria-label": ariaLabel = "Tabs",
  className = "",
}: {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
  "aria-label"?: string;
  className?: string;
}) {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div role="tablist" aria-label={ariaLabel} className={`flex flex-col ${className}`}>
        {children}
      </div>
    </TabsContext.Provider>
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
  className = "",
}: {
  value: string;
  selected?: boolean;
  onSelect?: () => void;
  children: React.ReactNode;
  id?: string;
  className?: string;
}) {
  const ctx = React.useContext(TabsContext);
  const isSelected = selected ?? (ctx ? ctx.value === value : false);
  const handleSelect = onSelect ?? (ctx ? () => ctx.onValueChange(value) : undefined);
  const triggerId = id ?? `tab-${value}`;
  return (
    <button
      type="button"
      role="tab"
      id={triggerId}
      aria-selected={isSelected}
      aria-controls={`panel-${value}`}
      tabIndex={isSelected ? 0 : -1}
      onClick={handleSelect}
      className={`px-4 py-2 text-sm font-medium rounded-t border-b-2 -mb-px transition-colors focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-0 ${
        isSelected
          ? "border-[var(--accent)] text-[var(--accent)]"
          : "border-transparent text-[var(--text-soft)] hover:text-[var(--text)]"
      } ${className}`}
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
  className = "",
}: {
  value: string;
  selected?: boolean;
  children: React.ReactNode;
  id?: string;
  className?: string;
}) {
  const ctx = React.useContext(TabsContext);
  const isSelected = selected ?? (ctx ? ctx.value === value : false);
  const panelId = id ?? `panel-${value}`;
  if (!isSelected) return null;
  return (
    <div
      role="tabpanel"
      id={panelId}
      aria-labelledby={`tab-${value}`}
      className={`outline-none ${className}`}
    >
      {children}
    </div>
  );
}
