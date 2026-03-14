import * as React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  labelClassName?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", label, error, id, labelClassName = "", ...props }, ref) => {
    const inputId = id ?? (label ? label.replace(/\s+/g, "-").toLowerCase() : undefined);
    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className={`mb-1 block text-sm font-medium text-[var(--text)] ${labelClassName}`}
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`glass-field flex h-9 w-full rounded-[var(--radius-input)] border border-[var(--glass-border)] px-3 py-1 text-sm text-[var(--text)] shadow-[var(--glass-shadow-sm)] transition-all duration-200 placeholder:text-[var(--text-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-0 aria-[invalid=true]:border-[var(--danger)] disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
          {...props}
        />
        {error && (
          <p id={inputId ? `${inputId}-error` : undefined} className="mt-1 text-sm text-[var(--danger)]">
            {error}
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";
