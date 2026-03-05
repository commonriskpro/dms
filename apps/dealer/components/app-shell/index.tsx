"use client";

import { SuspendedBanner } from "@/components/suspended-banner";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen overflow-hidden bg-[var(--page-bg)]">
      <div className="h-full grid grid-cols-[272px_1fr]">
<<<<<<< HEAD
        <aside className="sticky top-0 h-screen overflow-hidden shrink-0">
          <Sidebar />
        </aside>
        <div className="h-full min-w-0 flex flex-col overflow-hidden">
=======
        <aside className="h-full">
          <Sidebar />
        </aside>
        <div className="h-full min-w-0 flex flex-col">
>>>>>>> b6f3f0c3e03764d58a87dbe9a8ca709be7fc1083
          <SuspendedBanner />
          <Topbar />
          <main className="min-h-0 flex-1 overflow-y-auto px-6 pt-[18px] pb-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
