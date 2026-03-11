"use client";

import { useState } from "react";
import { SuspendedBanner } from "@/components/suspended-banner";
import { SupportSessionBanner } from "@/components/support-session-banner";
import { UnverifiedEmailBanner } from "@/components/unverified-email-banner";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

const SIDEBAR_WIDTH_EXPANDED = 236;
const SIDEBAR_WIDTH_COLLAPSED = 60;

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const sidebarWidth = sidebarCollapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED;

  return (
    <div className="h-screen overflow-hidden bg-[var(--page-bg)] text-[var(--text)]">
      <div
        className="grid h-full items-stretch transition-[grid-template-columns] duration-200 ease-out"
        style={{ gridTemplateColumns: `${sidebarWidth}px 1fr` }}
      >
        <aside className="sticky top-0 h-full overflow-hidden shrink-0">
          <Sidebar
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed((c) => !c)}
          />
        </aside>
        <div
          className="h-full min-w-0 flex flex-col overflow-hidden"
          style={{
            backgroundColor: "var(--page-bg)",
            backgroundImage: "none",
          }}
        >
          <SupportSessionBanner />
          <UnverifiedEmailBanner />
          <SuspendedBanner />
          <Topbar />
          <main className="min-h-0 flex-1 overflow-y-auto px-2.5 pt-2.5 pb-2.5">{children}</main>
        </div>
      </div>
    </div>
  );
}
