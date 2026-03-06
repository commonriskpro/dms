"use client";

import * as React from "react";
import { useDealerLifecycle } from "@/contexts/dealer-lifecycle-context";
import { Button } from "@/components/ui/button";
import type { ButtonProps } from "@/components/ui/button";

const TOOLTIP = "Disabled while suspended";

type WriteGuardProps = {
  children: React.ReactNode;
  /** When suspended, render a disabled wrapper with tooltip. Default true. */
  wrapWithDisabled?: boolean;
};

/**
 * When ACTIVE: renders children. When SUSPENDED: renders children in a disabled state with tooltip.
 * When CLOSED: should not be reached (app shows ClosedScreen). Use for mutation triggers (buttons, submit).
 */
export function WriteGuard({ children, wrapWithDisabled = true }: WriteGuardProps) {
  const { isActive, isSuspended } = useDealerLifecycle();

  if (isActive) {
    return <>{children}</>;
  }

  if (isSuspended && wrapWithDisabled) {
    return (
      <span
        className="inline-flex cursor-not-allowed"
        title={TOOLTIP}
        aria-label={TOOLTIP}
      >
        <span className="pointer-events-none opacity-60 [&>*]:cursor-not-allowed" aria-hidden>
          {children}
        </span>
      </span>
    );
  }

  return <>{children}</>;
}

/**
 * Use with buttons: when suspended, disables the button and adds tooltip.
 * Pass through disabled so the button is actually disabled for forms.
 */
export function useWriteDisabled(): { disabled: boolean; title: string } {
  const { isSuspended } = useDealerLifecycle();
  return {
    disabled: isSuspended,
    title: isSuspended ? TOOLTIP : "",
  };
}

/**
 * Button that is disabled (with tooltip) when dealership is suspended.
 * Use for create/save/delete/upload actions in dealer app.
 */
export function MutationButton(props: ButtonProps) {
  const { disabled, title } = useWriteDisabled();
  return (
    <Button
      {...props}
      disabled={props.disabled ?? disabled}
      title={(props.title ?? title) || undefined}
    />
  );
}
