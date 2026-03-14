"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/error-state";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import type { WebsiteSiteDto } from "@dms/contracts";
import { apiFetch, getApiErrorMessage } from "@/lib/client/http";
import { Globe, Pencil, BarChart3 } from "@/lib/ui/icons";

type SiteResponse = { data: WebsiteSiteDto | null };

const statusLabel: Record<string, string> = {
  DRAFT: "Draft",
  LIVE: "Live",
  PAUSED: "Paused",
};

const statusColor: Record<string, string> = {
  DRAFT: "bg-[var(--warning-muted)] text-[var(--warning-muted-fg)]",
  LIVE: "bg-[var(--success-muted)] text-[var(--success-muted-fg)]",
  PAUSED: "bg-[var(--muted)] text-[var(--text-soft)]",
};

export function WebsiteOverviewPage() {
  const [site, setSite] = React.useState<WebsiteSiteDto | null | undefined>(undefined);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    apiFetch<SiteResponse>("/api/websites/site")
      .then((r) => setSite(r.data))
      .catch((e) => setError(getApiErrorMessage(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <PageShell className="space-y-6">
        <PageHeader title="Websites" description="Website health, readiness to publish, branding, and lead flow." />
        <OverviewSkeleton />
      </PageShell>
    );
  }
  if (error) {
    return (
      <PageShell className="space-y-6">
        <PageHeader title="Websites" description="Website health, readiness to publish, branding, and lead flow." />
        <ErrorState message={error} />
      </PageShell>
    );
  }

  if (!site) {
    return (
      <PageShell className="space-y-6">
        <PageHeader
          title="Websites"
          description="Website health, readiness to publish, branding, and lead flow."
        />
        <div className="mx-auto max-w-lg">
          <Card>
            <CardHeader>
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent)]/10 text-[var(--accent)]">
                <Globe size={24} />
              </div>
              <CardTitle>No website yet</CardTitle>
              <p className="text-sm text-[var(--text-soft)]">
                Your dealer website has not been provisioned yet. Contact your platform administrator to have a website created. Once it&apos;s set up, you&apos;ll configure theme, pages, and publish from here.
              </p>
            </CardHeader>
          </Card>
        </div>
      </PageShell>
    );
  }

  const siteUrl = `https://${site.subdomain}.dms.auto`;

  return (
    <PageShell className="space-y-6">
      <PageHeader
        title="Websites"
        description="Website health, readiness to publish, branding, and lead flow. Configure → review → publish."
        actions={
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor[site.status] ?? statusColor.DRAFT}`}
            >
              {statusLabel[site.status] ?? site.status}
            </span>
            {site.status === "LIVE" && (
              <a
                href={siteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-[var(--accent)] hover:underline"
              >
                <Globe size={14} />
                Visit site
              </a>
            )}
          </div>
        }
      />

      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">
        Configure → Review → Publish
      </p>
      <p className="max-w-[66ch] text-sm text-[var(--muted-text)]">
        You control template selection, branding, page configuration (SEO, sections), safe content, inventory display, and when to publish. Layout, template code, and domain/SSL are managed by the platform.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <QuickCard
          title="Brand & theme"
          description="Logo, colors, fonts, and contact info."
          href="/websites/theme"
          icon={<Pencil size={20} />}
        />
        <QuickCard
          title="Page configuration"
          description="Enable pages, set SEO, and configure sections (template-controlled)."
          href="/websites/pages"
          icon={<Globe size={20} />}
        />
        <QuickCard
          title="Publish & readiness"
          description={site.publishedReleaseId ? "Live. Review release history or rollback." : "Not published yet. Review and publish when ready."}
          href="/websites/publish"
          icon={<Globe size={20} />}
        />
        <QuickCard
          title="Domains"
          description="Custom domains, verification, and SSL."
          href="/websites/domains"
          icon={<Globe size={20} />}
        />
        <QuickCard
          title="Lead flow & analytics"
          description="Page views, VDP views, and website lead attribution."
          href="/websites/analytics"
          icon={<BarChart3 size={20} />}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Site Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="divide-y divide-[var(--border)]">
            <DetailRow label="Subdomain URL">
              <a href={siteUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline">
                {siteUrl}
              </a>
            </DetailRow>
            <DetailRow label="Template">{site.activeTemplateKey}</DetailRow>
            <DetailRow label="Status">{statusLabel[site.status] ?? site.status}</DetailRow>
            <DetailRow label="Published Release">{site.publishedReleaseId ? "Active" : "Not published yet"}</DetailRow>
          </dl>
        </CardContent>
      </Card>
    </PageShell>
  );
}

function QuickCard({ title, description, href, icon }: { title: string; description: string; href: string; icon: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-card-hover)]"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--accent)]/10 text-[var(--accent)]">
        {icon}
      </div>
      <div>
        <p className="font-semibold text-[var(--text)] group-hover:text-[var(--accent)]">{title}</p>
        <p className="text-sm text-[var(--text-soft)]">{description}</p>
      </div>
    </Link>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3">
      <dt className="text-sm text-[var(--text-soft)]">{label}</dt>
      <dd className="text-sm font-medium text-[var(--text)]">{children}</dd>
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-56" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-32 rounded-[var(--radius-card)]" />
        ))}
      </div>
      <Skeleton className="h-48 rounded-[var(--radius-card)]" />
    </div>
  );
}
