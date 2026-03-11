"use client";

import * as React from "react";
import { Input, type InputProps } from "@/components/ui/input";
import { warnIfForbiddenClasses } from "@/lib/ui/style-policy";

const APP_INPUT_BASE =
  "rounded-[var(--radius-input)] border-[var(--border)] bg-[var(--surface)] text-[var(--text)] placeholder:text-[var(--text-soft)] focus-visible:ring-[var(--ring)]";

const AppInput = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", ...props }, ref) => {
    const merged = `${APP_INPUT_BASE} ${className}`.trim();
    React.useEffect(() => {
      warnIfForbiddenClasses("AppInput", merged);
    }, [merged]);
    return <Input ref={ref} className={merged} {...props} />;
  }
);
AppInput.displayName = "AppInput";
