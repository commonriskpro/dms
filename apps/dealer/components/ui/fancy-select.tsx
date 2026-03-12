"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

export interface FancySelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface FancySelectProps {
  label?: string;
  value: string;
  options: FancySelectOption[];
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
  labelClassName?: string;
}

export function FancySelect({
  label,
  value,
  options,
  onChange,
  placeholder = "Select",
  disabled = false,
  className,
  triggerClassName,
  contentClassName,
  labelClassName,
}: FancySelectProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [menuWidth, setMenuWidth] = React.useState<number | null>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  const selected = options.find((option) => option.value === value);

  React.useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  React.useEffect(() => {
    if (!triggerRef.current) return;
    setMenuWidth(triggerRef.current.getBoundingClientRect().width);
  }, [isOpen]);

  return (
    <div ref={rootRef} className={cn("relative w-full", className)}>
      {label ? (
        <label className={cn("mb-1 block text-sm font-medium text-[var(--text)]/88", labelClassName)}>{label}</label>
      ) : null}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((open) => !open)}
        className={cn(
          "flex h-9 w-full items-center justify-between gap-2 rounded-md border px-3 py-1 text-left text-sm text-[var(--text)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50",
          triggerClassName
        )}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={label ?? placeholder}
      >
        <span className={cn("min-w-0 flex-1 truncate", !selected && "text-[var(--text-soft)]")}>
          {selected?.label ?? placeholder}
        </span>
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          className="shrink-0 text-[var(--muted-text)]"
        >
          <ChevronDown size={14} aria-hidden />
        </motion.span>
      </button>

      <AnimatePresence>
        {isOpen ? (
          <motion.div
            role="listbox"
            initial={{ opacity: 0, y: -10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.96 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className={cn(
              "absolute left-0 top-[calc(100%+0.5rem)] z-50 overflow-hidden rounded-[16px] border border-[color:rgba(148,163,184,0.16)] bg-[linear-gradient(180deg,rgba(13,24,45,0.96)_0%,rgba(10,18,34,0.96)_100%)] p-1 shadow-[0_16px_40px_rgba(2,6,23,0.42),inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur",
              contentClassName
            )}
            style={menuWidth ? { width: menuWidth } : undefined}
          >
            <motion.div
              initial="hidden"
              animate="visible"
              variants={{
                visible: {
                  transition: {
                    staggerChildren: 0.03,
                  },
                },
              }}
            >
              {options.map((option, index) => {
                const isSelected = option.value === value;
                return (
                  <motion.button
                    key={`${option.value}-${option.label}-${index}`}
                    type="button"
                    disabled={option.disabled}
                    variants={{
                      hidden: { opacity: 0, x: -12 },
                      visible: { opacity: 1, x: 0 },
                    }}
                    onClick={() => {
                      if (!option.disabled) {
                        onChange?.(option.value);
                        setIsOpen(false);
                      }
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-[12px] px-3 py-2 text-left text-sm transition-colors",
                      option.disabled
                        ? "cursor-not-allowed text-[var(--muted-text)] opacity-60"
                        : "text-[var(--text)]/95 hover:bg-[rgba(59,130,246,0.18)]",
                      isSelected && "bg-[rgba(59,130,246,0.16)]"
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                    {isSelected ? <Check size={14} className="shrink-0 text-[var(--accent)]" aria-hidden /> : null}
                  </motion.button>
                );
              })}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
