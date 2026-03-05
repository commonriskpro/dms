"use client";

import { PageShell, PageHeader } from "@/components/ui/page-shell";
import { Button } from "@/components/ui/button";
import { SettingsContent } from "@/modules/settings/ui/SettingsContent";

export default function SettingsPage() {
  return (
    <PageShell className="space-y-4">
      <PageHeader
        actions={
          <Button variant="secondary" size="sm" disabled title="Coming soon">
            Save
          </Button>
        }
      />
      <SettingsContent />
    </PageShell>
  );
}
