"use client";

import * as React from "react";
import {
  Command as CmdkCommand,
  CommandInput as CmdkInput,
  CommandList as CmdkList,
  CommandItem as CmdkItem,
  CommandGroup as CmdkGroup,
  CommandEmpty as CmdkEmpty,
} from "cmdk";
import { cn } from "@/lib/utils";

const commandRootClass =
  "flex h-full w-full flex-col overflow-hidden rounded-[var(--radius-card)] bg-[var(--surface)] text-[var(--text)]";

const commandInputClass =
  "flex h-10 w-full rounded-[var(--radius-input)] border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm placeholder:text-[var(--text-soft)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50";

const commandListClass = "max-h-[300px] overflow-y-auto overflow-x-hidden p-1";

const commandItemClass =
  "relative flex cursor-pointer select-none items-center rounded-[var(--radius-button)] px-2 py-1.5 text-sm outline-none aria-selected:bg-[var(--muted)] aria-selected:text-[var(--text)] data-[disabled]:pointer-events-none data-[disabled]:opacity-50";

const commandGroupClass =
  "overflow-hidden p-1 text-[var(--text)] [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-[var(--muted-text)]";

const commandEmptyClass = "py-6 text-center text-sm text-[var(--muted-text)]";

export const Command = React.forwardRef<
  React.ComponentRef<typeof CmdkCommand>,
  React.ComponentPropsWithoutRef<typeof CmdkCommand>
>(({ className, ...props }, ref) => (
  <CmdkCommand
    ref={ref}
    className={cn(commandRootClass, className)}
    {...props}
  />
));
Command.displayName = "Command";

export const CommandInput = React.forwardRef<
  React.ComponentRef<typeof CmdkInput>,
  React.ComponentPropsWithoutRef<typeof CmdkInput>
>(({ className, ...props }, ref) => (
  <CmdkInput
    ref={ref}
    className={cn(commandInputClass, className)}
    {...props}
  />
));
CommandInput.displayName = "CommandInput";

export const CommandList = React.forwardRef<
  React.ComponentRef<typeof CmdkList>,
  React.ComponentPropsWithoutRef<typeof CmdkList>
>(({ className, ...props }, ref) => (
  <CmdkList ref={ref} className={cn(commandListClass, className)} {...props} />
));
CommandList.displayName = "CommandList";

export const CommandItem = React.forwardRef<
  React.ComponentRef<typeof CmdkItem>,
  React.ComponentPropsWithoutRef<typeof CmdkItem>
>(({ className, ...props }, ref) => (
  <CmdkItem
    ref={ref}
    className={cn(commandItemClass, className)}
    {...props}
  />
));
CommandItem.displayName = "CommandItem";

export const CommandGroup = React.forwardRef<
  React.ComponentRef<typeof CmdkGroup>,
  React.ComponentPropsWithoutRef<typeof CmdkGroup>
>(({ className, ...props }, ref) => (
  <CmdkGroup
    ref={ref}
    className={cn(commandGroupClass, className)}
    {...props}
  />
));
CommandGroup.displayName = "CommandGroup";

export const CommandEmpty = React.forwardRef<
  React.ComponentRef<typeof CmdkEmpty>,
  React.ComponentPropsWithoutRef<typeof CmdkEmpty>
>(({ className, ...props }, ref) => (
  <CmdkEmpty
    ref={ref}
    className={cn(commandEmptyClass, className)}
    {...props}
  />
));
CommandEmpty.displayName = "CommandEmpty";
