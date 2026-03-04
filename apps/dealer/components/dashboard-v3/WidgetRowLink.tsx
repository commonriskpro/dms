"use client";

import { useRouter } from "next/navigation";

type Props = {
  href: string;
  left: React.ReactNode;
  right: React.ReactNode;
  className?: string;
};

/** Clickable widget row: label | count + arrow, hover transition, router.push(href). */
export function WidgetRowLink({ href, left, right, className = "" }: Props) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.push(href)}
      className={`w-full text-left flex items-center justify-between rounded-md border border-[var(--border)]/60 bg-[var(--muted)]/30 px-3 py-2 text-sm transition-colors hover:bg-[var(--muted)] ${className}`}
    >
      <span className="min-w-0">{left}</span>
      <span className="flex items-center gap-1.5 shrink-0">
        {right}
        <span className="text-[var(--text-soft)]" aria-hidden>→</span>
      </span>
    </button>
  );
}
