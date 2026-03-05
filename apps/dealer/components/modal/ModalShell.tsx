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

export type ModalShellProps = {
  title: string;
  children: React.ReactNode;
  /** When true, body shows a default skeleton instead of children. */
  loading?: boolean;
  /** When set, body shows error state; children are ignored. */
  error?: ModalShellError | null;
  size?: "md" | "lg" | "xl";
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
}: ModalShellProps) {
  const router = useRouter();

  const handleClose = React.useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  }, [router]);

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
  ) : (
    children
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
