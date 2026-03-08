import * as React from "react";
import { cn } from "@/lib/utils";
import { widgetTokens } from "@/lib/ui/tokens";

export type WidgetState = "default" | "loading" | "empty" | "error";

export type WidgetProps = {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  footer?: React.ReactNode;
  state?: WidgetState;
  /** Tighter padding and header spacing for KPI/metric cards */
  compact?: boolean;
  className?: string;
  children?: React.ReactNode;
};

export function Widget({
  title,
  subtitle,
  action,
  footer,
  state = "default",
  compact,
  className,
  children,
}: WidgetProps) {
  const rootClass = compact ? widgetTokens.widgetCompact : widgetTokens.widget;
  const headerClass = compact ? widgetTokens.widgetHeaderCompact : widgetTokens.widgetHeader;
  return (
    <section className={cn(rootClass, className)}>
      <div className={headerClass}>
        <div className="min-w-0 space-y-1">
          <h3 className={widgetTokens.widgetTitle}>{title}</h3>
          {subtitle ? <p className={widgetTokens.widgetSubtitle}>{subtitle}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div data-state={state}>{children}</div>
      {footer ? <div className="mt-4 border-t border-[var(--border)] pt-3">{footer}</div> : null}
    </section>
  );
}
