import * as React from "react";

export function SidebarGroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="px-3 pt-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--sidebar-text)]/70">
      {children}
    </span>
  );
}
