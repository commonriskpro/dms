"use client";

import * as React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

const variantClasses = {
  primary: "bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] border-transparent shadow-[var(--glass-shadow-sm)]",
  secondary: "glass-field text-[var(--text)] hover:bg-[var(--glass-bg-strong)] border-[var(--glass-border)]",
  ghost: "bg-transparent text-[var(--text-soft)] hover:bg-[var(--glass-bg)] border-transparent",
  danger: "bg-[var(--danger)] text-white hover:opacity-90 border-transparent",
};

const sizeClasses = {
  sm: "px-2.5 py-1.5 text-sm rounded",
  md: "px-4 py-2 text-sm rounded-md",
  lg: "px-5 py-2.5 text-base rounded-md",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant = "primary", size = "md", isLoading, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      className={`inline-flex items-center justify-center font-medium border transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-0 disabled:opacity-50 disabled:pointer-events-none ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
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
  )
);
Button.displayName = "Button";
