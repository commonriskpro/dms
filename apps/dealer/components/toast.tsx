"use client";

/**
 * Re-exports from the global toast provider (shadcn/Radix-based).
 * ToastProvider is mounted in app/(app)/layout.tsx.
 * For platform routes, wrap with ToastProvider in platform layout if needed.
 */

export type { ToastType, ToastItem } from "@/components/ui/toast-provider";
export { ToastProvider, useToast } from "@/components/ui/toast-provider";
