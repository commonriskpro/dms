import * as React from "react";
import { TableLayout, type TableLayoutProps } from "@/components/ui-system/tables";

type QueueTableProps = TableLayoutProps;

export function QueueTable(props: QueueTableProps) {
  return <TableLayout {...props} />;
}
