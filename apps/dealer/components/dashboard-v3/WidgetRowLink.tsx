"use client";

import { useRouter } from "next/navigation";

type Props = {
  href: string;
  left: React.ReactNode;
  right: React.ReactNode;
  className?: string;
  variant?: "plain" | "card" | "compact";
};

/** Clickable widget row: left (badge + label) | right (meta cluster). Default: plain (no row background/border). */
export function WidgetRowLink({ href, left, right, className = "", variant = "plain" }: Props) {
  const router = useRouter();
  const isPlain = variant === "plain" || variant === "compact";
  return (
    <button
      type="button"
      onClick={() => router.push(href)}
      className={`w-full text-left rounded-[12px] px-2 -mx-2 hover:bg-[var(--surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${className}`}
    >
      {isPlain ? (
        <div className="group flex items-center justify-between py-3">
          <span className="flex items-center gap-3 min-w-0">{left}</span>
          <span className="flex items-center gap-2 shrink-0 text-xs text-[var(--muted-text)]">
            {right}
            <span className="opacity-0 group-hover:opacity-100 transition" aria-hidden>→</span>
          </span>
        </div>
      ) : (
        <div className="min-h-[44px] rounded-[12px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 flex items-center justify-between gap-2 transition-colors hover:bg-[var(--surface-2)]">
          <span className="flex items-center gap-2 min-w-0">{left}</span>
          <span className="flex items-center gap-2 shrink-0 text-xs text-[var(--muted-text)]">
            {right}
            <span aria-hidden>→</span>
          </span>
        </div>
      )}
    </button>
  );
}
