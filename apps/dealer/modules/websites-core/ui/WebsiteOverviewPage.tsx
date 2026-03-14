"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/error-state";
import type { WebsiteSiteDto } from "@dms/contracts";
import { apiFetch, getApiErrorMessage } from "@/lib/client/http";
import { Globe, Pencil } from "@/lib/ui/icons";

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

  if (loading) return <OverviewSkeleton />;
  if (error) return <ErrorState message={error} />;

  if (!site) {
    return (
      <div className="mx-auto max-w-lg py-16">
        <Card>
          <CardHeader>
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent)]/10 text-[var(--accent)]">
              <Globe size={24} />
            </div>
            <CardTitle>Website not provisioned</CardTitle>
            <p className="text-sm text-[var(--text-soft)]">
              Your dealer website has not been set up yet. Website provisioning is managed in the platform app. Contact your platform administrator to have a website created for your dealership.
            </p>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const siteUrl = `https://${site.subdomain}.dms.auto`;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text)]">{site.name}</h1>
          <p className="text-sm text-[var(--text-soft)]">Manage your public dealer website</p>
        </div>
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
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)]/50 px-4 py-3 text-sm text-[var(--text-soft)]">
        <p className="font-medium text-[var(--text)]">You control</p>
        <p className="mt-0.5">
          Template selection, branding, page configuration (SEO, section toggles), safe content, inventory display, and when to publish. Layout, template code, and domain/SSL technical setup are managed by the platform.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <QuickCard
          title="Theme & Branding"
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
          title="Publish"
          description="Publish your website or review release history."
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
          title="Analytics"
          description="Page views, VDP views, and lead attribution."
          href="/websites/analytics"
          icon={<Globe size={20} />}
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
    </div>
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
