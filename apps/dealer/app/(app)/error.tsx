"use client";

import { ErrorBoundaryFallback } from "@/components/ui/error-boundary";

/**
 * Next.js App Router route-level error UI for the (app) segment.
 * Renders when an error is thrown in this segment or a child.
 */
export default function AppError({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorBoundaryFallback onRetry={reset} />;
}
