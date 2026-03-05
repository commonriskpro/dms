"use client";

import { PageShell, PageHeader } from "@/components/ui/page-shell";
import { Button } from "@/components/ui/button";
import { SettingsContent } from "@/modules/settings/ui/SettingsContent";

export default function SettingsPage() {
  return (
    <PageShell className="space-y-4">
      <PageHeader
        title={
          <h1 className="text-[24px] font-semibold leading-tight text-[var(--text)]">Settings</h1>
        }
        actions={
          <>
            <span className="text-sm text-[var(--muted-text)]">Last updated just now</span>
            <Button variant="secondary" size="sm" disabled title="Coming soon">
              Save
            </Button>
          </>
        }
      />
      <SettingsContent />
    </PageShell>
  );
}
