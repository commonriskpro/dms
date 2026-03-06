"use client";

import * as React from "react";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "onChange"> {
  label?: string;
  options: SelectOption[];
  onChange?: (value: string) => void;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = "", label, options, value, onChange, id, ...props }, ref) => {
    const selectId = id ?? (label ? label.replace(/\s+/g, "-").toLowerCase() : undefined);
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={selectId} className="block text-sm font-medium text-[var(--text)] mb-1">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          className={`flex h-9 w-full rounded-md border border-[var(--border)] bg-[var(--panel)] px-3 py-1 text-sm shadow-sm focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:opacity-50 ${className}`}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    );
  }
);
Select.displayName = "Select";
