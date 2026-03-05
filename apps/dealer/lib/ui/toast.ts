/**
 * Global toast API for client components.
 * Use toastSuccess, toastError, toastInfo, toastWarning from any client component.
 * The toast provider (mounted in app layout) registers the notifier on mount.
 */

export type ToastVariant = "success" | "error" | "info" | "warning";

type ToastNotifier = (variant: ToastVariant, message: string) => void;

let notifier: ToastNotifier | null = null;

export function setToastNotifier(fn: ToastNotifier | null): void {
  notifier = fn;
}

function show(variant: ToastVariant, message: string): void {
  notifier?.(variant, message);
}

export function toastSuccess(message: string): void {
  show("success", message);
}

export function toastError(message: string): void {
  show("error", message);
}

export function toastInfo(message: string): void {
  show("info", message);
}

export function toastWarning(message: string): void {
  show("warning", message);
}
