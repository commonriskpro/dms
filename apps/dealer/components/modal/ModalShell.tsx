"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AppModal } from "@/components/ui/app-modal";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/error-state";
import { mainGrid } from "@/lib/ui/recipes/layout";

export type ModalShellError = {
  title?: string;
  message?: string;
  onRetry?: () => void;
};

const DEFAULT_ERROR_BODY = (
  <div className="p-6">
    <p className="text-sm text-[var(--muted-text)]">
      If you think this is a mistake, contact your dealership admin.
    </p>
  </div>
);

export type ModalShellProps = {
  title: string;
  /** When omitted and error is set, default error body is shown. When omitted and no error, minimal empty body. Modal error pages: set error and omit children; success: set children only. */
  children?: React.ReactNode;
  /** When true, body shows a default skeleton instead of children. */
  loading?: boolean;
  /** When set, body shows error state; children are ignored. If no children, default error body is used. */
  error?: ModalShellError | null;
  size?: "md" | "lg" | "xl";
  /** When closing with no history (e.g. direct open in new tab), navigate here instead of "/". */
  fallbackPath?: string;
};

/**
 * Shared modal shell for DMS intercepting routes.
 * Overlay layout, close via router.back(), skeleton and error states, consistent DMS UI.
 */
export function ModalShell({
  title,
  children,
  loading = false,
  error = null,
  size = "xl",
  fallbackPath = "/",
}: ModalShellProps) {
  const router = useRouter();

  const handleClose = React.useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackPath);
    }
  }, [router, fallbackPath]);

  const body = error ? (
    <ErrorState
      title={error.title ?? "Something went wrong"}
      message={error.message}
      onRetry={error.onRetry}
    />
  ) : loading ? (
    <div className={mainGrid}>
      <Skeleton className="h-64" />
      <Skeleton className="h-48" />
    </div>
  ) : children != null ? (
    children
  ) : (
    DEFAULT_ERROR_BODY
  );

  return (
    <AppModal
      open
      onOpenChange={() => {}}
      title={title}
      closeBehavior="back"
      onRequestClose={handleClose}
      size={size}
    >
      {body}
    </AppModal>
  );
}
