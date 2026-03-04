"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";

type SafeLog = {
  message: string;
  componentStack: string | null;
  pathname: string | null;
  searchParamKeys: string[];
  sessionStatusSummary: "unknown" | "loading" | "authenticated" | "unauthenticated" | "error";
};

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    const pathname =
      typeof window !== "undefined" && window.location ? window.location.pathname : null;
    const search = typeof window !== "undefined" && window.location ? window.location.search : "";
    const searchParamKeys: string[] = [];
    if (search) {
      const params = new URLSearchParams(search);
      params.forEach((_, key) => searchParamKeys.push(key));
    }
    const safe: SafeLog = {
      message: error.message,
      componentStack: info?.componentStack ?? null,
      pathname,
      searchParamKeys,
      sessionStatusSummary: "unknown",
    };
    if (typeof console !== "undefined" && console.error) {
      console.error("[ErrorBoundary]", JSON.stringify(safe));
    }
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div
          className="flex min-h-screen flex-col items-center justify-center p-6"
          role="alert"
          aria-live="assertive"
        >
          <h1 className="text-lg font-semibold text-[var(--text)]">Something went wrong</h1>
          <p className="mt-2 text-sm text-[var(--text-soft)]">
            We’ve recorded the issue. Please refresh or try again later.
          </p>
          <Button
            type="button"
            variant="primary"
            onClick={() => this.setState({ hasError: false })}
            className="mt-4"
          >
            Try again
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
