"use client";

import * as React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", label, error, id, ...props }, ref) => {
    const inputId = id ?? (label ? label.replace(/\s+/g, "-").toLowerCase() : undefined);
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-[var(--text)] mb-1">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`flex h-9 w-full rounded-md border border-[var(--border)] bg-[var(--panel)] px-3 py-1 text-sm shadow-sm placeholder:text-[var(--text-soft)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-0 disabled:opacity-50 ${className}`}
          aria-invalid={error ? "true" : undefined}
          {...props}
        />
        {error && <p className="mt-1 text-sm text-[var(--danger)]">{error}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";
