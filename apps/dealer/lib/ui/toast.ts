/**
 * Global toast notifier registration for client components.
 * The toast provider (mounted in app layout) registers the notifier on mount.
 */

export type ToastVariant = "success" | "error" | "info" | "warning";

type ToastNotifier = (variant: ToastVariant, message: string) => void;

let notifier: ToastNotifier | null = null;

export function setToastNotifier(fn: ToastNotifier | null): void {
  notifier = fn;
}
