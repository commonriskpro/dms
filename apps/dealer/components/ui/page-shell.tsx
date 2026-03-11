import * as React from "react";
import {
  PageShell as SystemPageShell,
  PageHeader as SystemPageHeader,
} from "@/components/ui-system/layout";

/** Wraps a page: sets background and page padding using tokens. */
export function PageShell({
  className = "",
  rail,
  fullWidth,
  contentClassName,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  rail?: React.ReactNode;
  fullWidth?: boolean;
  contentClassName?: string;
}) {
  return (
    <SystemPageShell
      className={className}
      rail={rail}
      fullWidth={fullWidth}
      contentClassName={contentClassName}
      {...props}
    >
      {children}
    </SystemPageShell>
  );
}

/** Standard header layout: title left, actions right. Title and actions are optional. */
export function PageHeader({
  title,
  description,
  actions,
  className = "",
  ...props
}: Omit<React.HTMLAttributes<HTMLDivElement>, "title"> & {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  if (title == null && description == null && actions == null) return null;
  return (
    <SystemPageHeader
      title={title}
      description={description}
      actions={actions}
      className={className}
      {...props}
    />
  );
}
