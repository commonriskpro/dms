"use client";

import { SuspendedBanner } from "@/components/suspended-banner";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen overflow-hidden bg-[var(--page-bg)]">
      <div className="h-full grid grid-cols-[272px_1fr]">
        <aside className="h-full">
          <Sidebar />
        </aside>
        <div className="h-full min-w-0 flex flex-col">
          <SuspendedBanner />
          <Topbar />
          <main className="min-h-0 flex-1 overflow-y-auto px-6 pt-[18px] pb-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
