import type { CustomerDetail, CustomerPhone, CustomerEmail } from "@/api/endpoints";

export function getPrimaryPhone(c: CustomerDetail): string | null {
  if (!c.phones?.length) return null;
  const primary = c.phones.find((p) => p.isPrimary);
  return (primary ?? c.phones[0])?.value ?? null;
}

export function getPrimaryEmail(c: CustomerDetail): string | null {
  if (!c.emails?.length) return null;
  const primary = c.emails.find((e) => e.isPrimary);
  return (primary ?? c.emails[0])?.value ?? null;
}

export function formatCentsToDisplay(cents: string | number): string {
  const n = typeof cents === "string" ? parseInt(cents, 10) : cents;
  if (Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n / 100);
}

export function formatDateShort(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
