"use client";

import { SessionProvider } from "@/contexts/session-context";
import { DealerLifecycleProvider } from "@/contexts/dealer-lifecycle-context";
import { AuthGuard } from "@/components/auth-guard";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ThemeProvider } from "@/lib/ui/theme/theme-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <SessionProvider>
          <DealerLifecycleProvider>
            <AuthGuard>{children}</AuthGuard>
          </DealerLifecycleProvider>
        </SessionProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
