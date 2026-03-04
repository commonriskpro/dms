"use client";

import { useRouter } from "next/navigation";

type Props = {
  href: string;
  left: React.ReactNode;
  right: React.ReactNode;
  className?: string;
  variant?: "default" | "compact";
};

/** Clickable widget row: left (badge + label) | right (meta cluster). Blueprint: min-h-[44px], surface-2, rounded-[12px], px-3 py-2. */
export function WidgetRowLink({ href, left, right, className = "", variant = "default" }: Props) {
  const router = useRouter();
  return (
    <button type="button" onClick={() => router.push(href)} className={`w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${className}`}>
      {variant === "compact" ? (
        <div className="flex items-center justify-between gap-3 py-2 px-0 rounded-[12px] px-2 -mx-2 transition hover:bg-[var(--surface-2)]/40">
          <span className="flex items-center gap-2 min-w-0">{left}</span>
          <span className="flex items-center gap-2 shrink-0 text-xs text-[var(--muted-text)]">
            {right}
            <span aria-hidden>→</span>
          </span>
        </div>
      ) : (
        <div className="min-h-[44px] rounded-[12px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 flex items-center justify-between gap-2 transition-colors hover:bg-white/60">
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
