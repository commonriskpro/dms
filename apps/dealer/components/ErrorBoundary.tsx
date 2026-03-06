"use client";

import * as React from "react";
import { ErrorBoundaryFallback } from "@/components/ui/error-boundary";

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
    if (typeof console !== "undefined" && console.error) {
      console.error("[ErrorBoundary]", error.message, info?.componentStack);
    }
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <ErrorBoundaryFallback
          onRetry={() => this.setState({ hasError: false })}
        />
      );
    }
    return this.props.children;
  }
}
