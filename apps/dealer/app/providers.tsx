"use client";

import { SessionProvider } from "@/contexts/session-context";
import { DealerLifecycleProvider } from "@/contexts/dealer-lifecycle-context";
import { ToastProvider } from "@/components/toast";
import { AuthGuard } from "@/components/auth-guard";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <DealerLifecycleProvider>
        <ToastProvider>
          <AuthGuard>{children}</AuthGuard>
        </ToastProvider>
      </DealerLifecycleProvider>
    </SessionProvider>
  );
}
