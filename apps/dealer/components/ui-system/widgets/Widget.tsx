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
  className?: string;
  children?: React.ReactNode;
};

export function Widget({
  title,
  subtitle,
  action,
  footer,
  state = "default",
  className,
  children,
}: WidgetProps) {
  return (
    <section className={cn(widgetTokens.widget, className)}>
      <div className={widgetTokens.widgetHeader}>
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
