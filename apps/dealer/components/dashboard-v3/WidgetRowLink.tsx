"use client";

import { useRouter } from "next/navigation";
<<<<<<< HEAD
import { DMSRow } from "@/components/ui/dms-row";
import { cn } from "@/lib/utils";
=======
>>>>>>> b6f3f0c3e03764d58a87dbe9a8ca709be7fc1083

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
<<<<<<< HEAD
  const isCard = variant === "card";
=======
  const isPlain = variant === "plain" || variant === "compact";
>>>>>>> b6f3f0c3e03764d58a87dbe9a8ca709be7fc1083
  return (
    <DMSRow
      left={left}
      right={right}
      onClick={() => router.push(href)}
<<<<<<< HEAD
      className={cn(
        variant === "compact" && "min-h-[40px] py-2",
        isCard && "min-h-[44px] rounded-[12px] border border-[var(--border)] bg-[var(--surface-2)] px-3 -mx-0 hover:bg-[var(--surface-2)]"
      , className)}
    />
=======
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
>>>>>>> b6f3f0c3e03764d58a87dbe9a8ca709be7fc1083
  );
}
