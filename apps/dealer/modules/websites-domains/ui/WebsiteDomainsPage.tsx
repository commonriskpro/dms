"use client";

import * as React from "react";
import Link from "next/link";
import { apiFetch, getApiErrorMessage } from "@/lib/client/http";
import { useToast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/error-state";
import { EmptyState } from "@/components/empty-state";
import { WriteGuard } from "@/components/write-guard";
import type { WebsiteDomainDto } from "@dms/contracts";
import { Globe } from "@/lib/ui/icons";

type DomainsResponse = { data: WebsiteDomainDto[] };

const verificationLabel: Record<string, string> = {
  PENDING: "Pending",
  VERIFIED: "Verified",
  FAILED: "Failed",
};

const sslLabel: Record<string, string> = {
  PENDING: "Pending",
  PROVISIONED: "Provisioned",
  FAILED: "Failed",
  NOT_APPLICABLE: "N/A",
};

const verificationClass: Record<string, string> = {
  PENDING: "bg-[var(--warning-muted)] text-[var(--warning-muted-fg)]",
  VERIFIED: "bg-[var(--success-muted)] text-[var(--success-muted-fg)]",
  FAILED: "bg-[var(--danger-muted)] text-[var(--danger-muted-fg)]",
};

const sslClass: Record<string, string> = {
  PENDING: "bg-[var(--warning-muted)] text-[var(--warning-muted-fg)]",
  PROVISIONED: "bg-[var(--success-muted)] text-[var(--success-muted-fg)]",
  FAILED: "bg-[var(--danger-muted)] text-[var(--danger-muted-fg)]",
  NOT_APPLICABLE: "bg-[var(--muted)] text-[var(--text-soft)]",
};

export function WebsiteDomainsPage() {
  const { addToast } = useToast();
  const [domains, setDomains] = React.useState<WebsiteDomainDto[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [action, setAction] = React.useState<{ domainId: string; type: "verify" | "ssl" } | null>(null);

  const fetchDomains = React.useCallback(() => {
    setLoading(true);
    setError(null);
    apiFetch<DomainsResponse>("/api/websites/domains")
      .then((r) => setDomains(r.data))
      .catch((e) => setError(getApiErrorMessage(e)))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    fetchDomains();
  }, [fetchDomains]);

  async function handleVerify(domain: WebsiteDomainDto) {
    setAction({ domainId: domain.id, type: "verify" });
    try {
      const r = await apiFetch<{ data: WebsiteDomainDto }>(
        `/api/websites/domains/${encodeURIComponent(domain.id)}/verify`,
        { method: "POST" }
      );
      setDomains((prev) => prev.map((d) => (d.id === domain.id ? r.data : d)));
      addToast("success", `Verification status updated for ${domain.hostname}.`);
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    } finally {
      setAction(null);
    }
  }

  async function handleRefreshSsl(domain: WebsiteDomainDto) {
    setAction({ domainId: domain.id, type: "ssl" });
    try {
      const r = await apiFetch<{ data: WebsiteDomainDto }>(
        `/api/websites/domains/${encodeURIComponent(domain.id)}/refresh-ssl`,
        { method: "POST" }
      );
      setDomains((prev) => prev.map((d) => (d.id === domain.id ? r.data : d)));
      addToast("success", `SSL status updated for ${domain.hostname}.`);
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    } finally {
      setAction(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 rounded-[var(--radius-card)]" />
      </div>
    );
  }
  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text)]">Custom Domains</h1>
          <p className="text-sm text-[var(--text-soft)]">
            View and manage custom domains. Check verification and refresh SSL status here; domain/SSL technical setup is managed by the platform.
          </p>
        </div>
        <Link
          href="/websites"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--accent)] hover:underline"
        >
          <Globe size={14} />
          Back to Website
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Domains</CardTitle>
        </CardHeader>
        <CardContent>
          {domains.length === 0 ? (
            <EmptyState
              title="No custom domains"
              description="Custom domains can be added from the API or a future add-domain flow. Your site is available at its default subdomain."
            />
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {domains.map((d) => (
                <div key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0">
                  <div>
                    <p className="font-medium text-[var(--text)]">
                      {d.hostname}
                      {d.isPrimary && (
                        <span className="ml-2 inline-flex items-center rounded-full bg-[var(--accent)]/10 px-2 py-0.5 text-xs font-medium text-[var(--accent)]">
                          Primary
                        </span>
                      )}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${verificationClass[d.verificationStatus] ?? verificationClass.PENDING}`}
                      >
                        Verification: {verificationLabel[d.verificationStatus] ?? d.verificationStatus}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${sslClass[d.sslStatus] ?? sslClass.PENDING}`}
                      >
                        SSL: {sslLabel[d.sslStatus] ?? d.sslStatus}
                      </span>
                    </div>
                  </div>
                  <WriteGuard>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={action !== null}
                        onClick={() => handleVerify(d)}
                      >
                        {action?.domainId === d.id && action?.type === "verify" ? "Checking…" : "Check verification"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={action !== null}
                        onClick={() => handleRefreshSsl(d)}
                      >
                        {action?.domainId === d.id && action?.type === "ssl" ? "Refreshing…" : "Refresh SSL"}
                      </Button>
                    </div>
                  </WriteGuard>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
