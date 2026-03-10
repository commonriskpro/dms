import * as React from "react";
import { PageShell, PageHeader } from "@/components/ui-system/layout";

type QueueLayoutProps = {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  kpis?: React.ReactNode;
  filters?: React.ReactNode;
  table: React.ReactNode;
  preview?: React.ReactNode;
};

export function QueueLayout({
  title,
  description,
  actions,
  kpis,
  filters,
  table,
  preview,
}: QueueLayoutProps) {
  return (
    <PageShell className="space-y-3">
      <PageHeader title={title} description={description} actions={actions} />
      {kpis}
      {filters}
      {!preview ? (
        table
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0">{table}</div>
          <aside className="space-y-3">{preview}</aside>
        </div>
      )}
    </PageShell>
  );
}
