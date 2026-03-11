"use client";

import * as React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { warnIfForbiddenClasses } from "@/lib/ui/style-policy";

const APP_BUTTON_BASE =
  "rounded-[var(--radius-input)] border font-medium transition-colors focus-visible:ring-[var(--ring)]";

const AppButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", children, ...props }, ref) => {
    const merged = `${APP_BUTTON_BASE} ${className}`.trim();
    React.useEffect(() => {
      warnIfForbiddenClasses("AppButton", merged);
    }, [merged]);
    return (
      <Button ref={ref} className={merged} {...props}>
        {children}
      </Button>
    );
  }
);
AppButton.displayName = "AppButton";
