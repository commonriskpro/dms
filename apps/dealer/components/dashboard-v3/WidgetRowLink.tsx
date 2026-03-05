"use client";

import { useRouter } from "next/navigation";
import { DMSRow } from "@/components/ui/dms-row";
import { cn } from "@/lib/utils";

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
  const isCard = variant === "card";
  return (
    <DMSRow
      left={left}
      right={right}
      onClick={() => router.push(href)}
      className={cn(
        variant === "compact" && "min-h-[40px] py-2",
        isCard && "min-h-[44px] rounded-[12px] border border-[var(--border)] bg-[var(--surface-2)] px-3 -mx-0 hover:bg-[var(--surface-2)]"
      , className)}
    />
  );
}
