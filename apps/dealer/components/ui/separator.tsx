"use client";

import * as React from "react";

interface SeparatorProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: "horizontal" | "vertical";
}

export const Separator = React.forwardRef<HTMLDivElement, SeparatorProps>(
  ({ className = "", orientation = "horizontal", ...props }, ref) => {
    return (
      <div
        ref={ref}
        role="separator"
        aria-orientation={orientation}
        className={
          orientation === "horizontal"
            ? `h-px w-full bg-[var(--border)] ${className}`
            : `h-full w-px min-h-[1em] bg-[var(--border)] ${className}`
        }
        {...props}
      />
    );
  }
);
Separator.displayName = "Separator";
