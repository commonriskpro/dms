import * as React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "outline" | "danger";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

const variantClasses = {
  primary:
    "bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] border-transparent",
  secondary:
    "bg-[var(--muted)] text-[var(--text)] hover:bg-[var(--muted)]/80 border-[var(--border)]",
  ghost: "bg-transparent text-[var(--text-soft)] hover:bg-[var(--muted)] border-transparent",
  outline:
    "bg-transparent text-[var(--text)] hover:bg-[var(--muted)] border-[var(--border)]",
  danger:
    "bg-[var(--danger)] text-white hover:opacity-90 border-transparent",
};

const sizeClasses = {
  sm: "px-2.5 py-1.5 text-sm rounded",
  md: "px-4 py-2 text-sm rounded-md",
  lg: "px-5 py-2.5 text-base rounded-md",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className = "",
      variant = "primary",
      size = "md",
      isLoading,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        type="button"
        className={`inline-flex items-center justify-center font-medium border transition-colors focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
        disabled={disabled ?? isLoading}
        {...props}
      >
        {isLoading ? (
          <>
            <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
            {children}
          </>
        ) : (
          children
        )}
      </button>
    );
  }
);
Button.displayName = "Button";
