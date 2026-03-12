import * as React from "react";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "onChange"> {
  label?: string;
  error?: string;
  labelClassName?: string;
  options: SelectOption[];
  onChange?: (value: string) => void;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      className = "",
      label,
      error,
      labelClassName = "",
      options,
      value,
      onChange,
      id,
      ...props
    },
    ref
  ) => {
    const selectId = id ?? (label ? label.replace(/\s+/g, "-").toLowerCase() : undefined);
    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={selectId}
            className={`mb-1 block text-sm font-medium text-[var(--text)] ${labelClassName}`}
          >
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          className={`flex h-9 w-full rounded-md border border-[var(--border)] bg-[var(--panel)] px-3 py-1 text-sm shadow-sm focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
          aria-invalid={error ? "true" : undefined}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && (
          <p className="mt-1 text-sm text-[var(--danger)]">{error}</p>
        )}
      </div>
    );
  }
);
Select.displayName = "Select";
