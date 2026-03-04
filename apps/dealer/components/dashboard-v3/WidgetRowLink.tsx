"use client";

import { useRouter } from "next/navigation";
import { widgetRowSurface } from "@/lib/ui/tokens";

type Props = {
  href: string;
  left: React.ReactNode;
  right: React.ReactNode;
  className?: string;
};

/** Clickable widget row: left (badge + label) | right (total + chevron), compact, hover. */
export function WidgetRowLink({ href, left, right, className = "" }: Props) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.push(href)}
      className={`w-full text-left flex items-center justify-between gap-2 ${widgetRowSurface} transition-colors hover:bg-[var(--muted)] hover:shadow-sm ${className}`}
    >
      <span className="flex items-center gap-2 min-w-0">{left}</span>
      <span className="flex items-center gap-1.5 shrink-0 text-[var(--text-soft)]">
        {right}
        <span aria-hidden>→</span>
      </span>
    </button>
  );
}
