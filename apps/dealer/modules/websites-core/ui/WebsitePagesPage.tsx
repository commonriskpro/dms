"use client";

import * as React from "react";
import { apiFetch, getApiErrorMessage } from "@/lib/client/http";
import { useToast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/error-state";
import { EmptyState } from "@/components/empty-state";
import { WriteGuard } from "@/components/write-guard";
import type { WebsitePageDto } from "@dms/contracts";
import { Globe } from "@/lib/ui/icons";

type PagesResponse = { pages: WebsitePageDto[] };

const PAGE_TYPE_LABEL: Record<string, string> = {
  HOME: "Home",
  INVENTORY: "Inventory",
  VDP: "Vehicle Detail (VDP)",
  CONTACT: "Contact",
  CUSTOM: "Custom",
};

function PageRow({
  page,
  onUpdated,
}: {
  page: WebsitePageDto;
  onUpdated: (updated: WebsitePageDto) => void;
}) {
  const { addToast } = useToast();
  const [expanded, setExpanded] = React.useState(false);
  const [seoTitle, setSeoTitle] = React.useState(page.seoTitle ?? "");
  const [seoDesc, setSeoDesc] = React.useState(page.seoDescription ?? "");
  const [saving, setSaving] = React.useState(false);
  const [toggling, setToggling] = React.useState(false);

  async function handleToggle() {
    setToggling(true);
    try {
      const r = await apiFetch<{ page: WebsitePageDto }>(`/api/websites/pages/${page.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isEnabled: !page.isEnabled }),
      });
      onUpdated(r.page);
      addToast("success", `Page ${r.page.isEnabled ? "enabled" : "disabled"}.`);
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    } finally {
      setToggling(false);
    }
  }

  async function handleSaveSeo(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await apiFetch<{ page: WebsitePageDto }>(`/api/websites/pages/${page.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          seoTitle: seoTitle || null,
          seoDescription: seoDesc || null,
        }),
      });
      onUpdated(r.page);
      setExpanded(false);
      addToast("success", "SEO settings saved.");
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--accent)]/10 text-[var(--accent)]">
            <Globe size={16} />
          </div>
          <div>
            <p className="font-medium text-[var(--text)]">{page.title}</p>
            <p className="text-xs text-[var(--text-soft)]">
              {PAGE_TYPE_LABEL[page.pageType] ?? page.pageType} · /{page.slug}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
              page.isEnabled
                ? "bg-[var(--success-muted)] text-[var(--success-muted-fg)]"
                : "bg-[var(--muted)] text-[var(--text-soft)]"
            }`}
          >
            {page.isEnabled ? "Enabled" : "Disabled"}
          </span>
          <WriteGuard>
            <Button variant="outline" size="sm" onClick={handleToggle} disabled={toggling}>
              {toggling ? "…" : page.isEnabled ? "Disable" : "Enable"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setExpanded((v) => !v)}>
              SEO
            </Button>
          </WriteGuard>
        </div>
      </div>

      {expanded && (
        <form onSubmit={handleSaveSeo} className="mt-4 space-y-3 border-t border-[var(--border)] pt-4">
          <div className="space-y-1.5">
            <Label htmlFor={`seo-title-${page.id}`}>SEO Title</Label>
            <Input
              id={`seo-title-${page.id}`}
              value={seoTitle}
              onChange={(e) => setSeoTitle(e.target.value)}
              maxLength={200}
              placeholder={page.title}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`seo-desc-${page.id}`}>SEO Description</Label>
            <textarea
              id={`seo-desc-${page.id}`}
              value={seoDesc}
              onChange={(e) => setSeoDesc(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Brief description for search engines"
              className="w-full resize-none rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" variant="primary" size="sm" disabled={saving}>
              {saving ? "Saving…" : "Save SEO"}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setExpanded(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

export function WebsitePagesPage() {
  const [pages, setPages] = React.useState<WebsitePageDto[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    apiFetch<PagesResponse>("/api/websites/pages")
      .then((r) => setPages(r.pages))
      .catch((e) => setError(getApiErrorMessage(e)))
      .finally(() => setLoading(false));
  }, []);

  function handleUpdated(updated: WebsitePageDto) {
    setPages((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 rounded-[var(--radius-card)]" />
        ))}
      </div>
    );
  }
  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--text)]">Pages</h1>
        <p className="text-sm text-[var(--text-soft)]">Enable, disable, and configure SEO for each website page.</p>
      </div>

      {pages.length === 0 ? (
        <EmptyState
          title="No pages found"
          description="Pages are automatically created when you initialize your website."
        />
      ) : (
        <div className="space-y-3">
          {pages.map((page) => (
            <PageRow key={page.id} page={page} onUpdated={handleUpdated} />
          ))}
        </div>
      )}
    </div>
  );
}
