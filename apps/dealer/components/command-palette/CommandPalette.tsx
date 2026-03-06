"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";
import {
  Command,
  CommandInput,
  CommandList,
  CommandItem,
  CommandGroup,
  CommandEmpty,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

const NAV_ITEMS: { value: string; label: string; href: string }[] = [
  { value: "dashboard", label: "Dashboard", href: "/dashboard" },
  { value: "inventory", label: "Inventory", href: "/inventory" },
  { value: "customers", label: "Customers", href: "/customers" },
  { value: "deals", label: "Deals", href: "/deals" },
  { value: "crm", label: "CRM", href: "/crm" },
  { value: "reports", label: "Reports", href: "/reports" },
  { value: "files", label: "Files", href: "/files" },
  { value: "settings", label: "Settings", href: "/settings" },
];

const CREATE_ITEMS: { value: string; label: string; href: string }[] = [
  { value: "add-prospect", label: "Add Prospect", href: "/customers/new" },
  { value: "add-vehicle", label: "Add Vehicle", href: "/inventory/new" },
  { value: "start-deal", label: "Start Deal", href: "/deals/new" },
];

const dialogContentClass = cn(
  "relative z-50 flex flex-col w-full max-w-[640px] max-h-[85vh] min-h-[200px]",
  "rounded-none sm:rounded-[var(--radius-card)]",
  "border-0 sm:border border-[var(--border)]",
  "bg-[var(--surface)] shadow-[var(--shadow-card-hover)]",
  "p-0 overflow-hidden"
);

function isEditableElement(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  const role = target.getAttribute?.("role");
  const editable = target.getAttribute?.("contenteditable");
  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    editable === "true" ||
    role === "textbox"
  );
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        if (isEditableElement(e.target as HTMLElement)) return;
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSelect = React.useCallback(
    (href: string) => {
      router.push(href);
      setOpen(false);
    },
    [router]
  );

  return (
    <Dialog open={open} onOpenChange={setOpen} contentClassName={dialogContentClass}>
      <Command label="Command palette" loop className="rounded-none border-0">
        <CommandInput
          placeholder="Search or run a command…"
          className="rounded-none border-0 border-b border-[var(--border)] focus-visible:ring-0 focus-visible:ring-offset-0"
        />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Navigate">
            {NAV_ITEMS.map((item) => (
              <CommandItem
                key={item.value}
                value={`${item.value} ${item.label}`}
                onSelect={() => handleSelect(item.href)}
              >
                {item.label}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Create">
            {CREATE_ITEMS.map((item) => (
              <CommandItem
                key={item.value}
                value={`${item.value} ${item.label}`}
                onSelect={() => handleSelect(item.href)}
              >
                {item.label}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </Dialog>
  );
}
