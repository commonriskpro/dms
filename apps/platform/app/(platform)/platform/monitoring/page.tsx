"use client";

import { useEffect, useState, useCallback } from "react";
import { platformFetch } from "@/lib/api-client";
import { usePlatformAuthContext } from "@/lib/platform-auth-context";
import { useToast } from "@/components/toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getPlatformUiErrorMessage } from "@/lib/ui-error";

type HealthSnapshot = {
  ok?: boolean;
  app?: string;
  version?: string;
  time?: string;
  db?: string;
  upstreamStatus?: number;
  error?: string;
};

type DailyRateLimits = {
  items: Array<{
    day: string;
    routeKey: string;
    allowedCount: number;
    blockedCount: number;
    uniqueIpCountApprox: number | null;
  }>;
  total: number;
  limit: number;
  offset: number;
};

type DailyJobRuns = {
  items: Array<{
    day: string;
    dealershipId: string;
    totalRuns: number;
    skippedRuns: number;
    processedRuns: number;
    failedRuns: number;
    avgDurationMs: number;
  }>;
  total: number;
  limit: number;
  offset: number;
};

export default function MonitoringPage() {
  const { userId, role } = usePlatformAuthContext();
  const isOwner = role === "PLATFORM_OWNER";
  const [platformHealth, setPlatformHealth] = useState<HealthSnapshot | null>(null);
  const [dealerHealth, setDealerHealth] = useState<HealthSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [dailyRateLimits, setDailyRateLimits] = useState<DailyRateLimits | null>(null);
  const [dailyJobRuns, setDailyJobRuns] = useState<DailyJobRuns | null>(null);
  const [dailyLoading, setDailyLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<"check" | "maintenance" | null>(null);
  const [authError, setAuthError] = useState<"401" | "403" | null>(null);
  const toast = useToast();

  const fetchHealth = useCallback(async () => {
    if (!userId) {
      setAuthError("401");
      setLoading(false);
      return;
    }
    setLoading(true);
    setAuthError(null);
    const [platformRes, dealerRes] = await Promise.all([
      platformFetch<HealthSnapshot>("/api/health", { platformUserId: userId }),
      platformFetch<HealthSnapshot>("/api/platform/monitoring/dealer-health", { platformUserId: userId }),
    ]);

    if (!platformRes.ok) {
      if (platformRes.status === 401) setAuthError("401");
      else if (platformRes.status === 403) setAuthError("403");
      else setPlatformHealth({ ok: false, error: platformRes.error?.message });
    } else {
      setPlatformHealth(platformRes.data);
    }

    if (!dealerRes.ok) {
      if (dealerRes.status === 401) setAuthError("401");
      else if (dealerRes.status === 403) setAuthError("403");
      else setDealerHealth({ ok: false, upstreamStatus: dealerRes.status, error: dealerRes.error?.message });
    } else {
      setDealerHealth(dealerRes.data);
    }
    setLoading(false);
  }, [userId]);

  const fetchDaily = useCallback(async () => {
    if (!userId) return;
    const now = new Date();
    const dateTo = now.toISOString().slice(0, 10);
    const dateFrom = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    setDailyLoading(true);
    const [rateRes, jobRes] = await Promise.all([
      platformFetch<DailyRateLimits>(
        `/api/platform/monitoring/rate-limits/daily?dateFrom=${encodeURIComponent(dateFrom)}&dateTo=${encodeURIComponent(dateTo)}&limit=10&offset=0`,
        { platformUserId: userId }
      ),
      platformFetch<DailyJobRuns>(
        `/api/platform/monitoring/job-runs/daily?dateFrom=${encodeURIComponent(dateFrom)}&dateTo=${encodeURIComponent(dateTo)}&limit=10&offset=0`,
        { platformUserId: userId }
      ),
    ]);
    if (rateRes.ok) setDailyRateLimits(rateRes.data);
    if (jobRes.ok) setDailyJobRuns(jobRes.data);
    setDailyLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  useEffect(() => {
    fetchDaily();
  }, [fetchDaily]);

  const platformOk = platformHealth?.ok === true;
  const dealerOk = dealerHealth?.ok === true;
  const statusBanner =
    !platformOk ? "outage" : !dealerOk ? "degraded" : "operational";

  const copyDiagnostics = () => {
    const payload = {
      timestamp: new Date().toISOString(),
      platformUserId: userId ?? null,
      role: role ?? null,
      platformHealth: platformHealth ?? null,
      dealerHealth: dealerHealth ?? null,
      version: platformHealth?.version ?? dealerHealth?.version ?? null,
    };
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2)).then(
      () => toast("Diagnostics copied.", "success"),
      () => toast("Failed to copy", "error")
    );
  };

  const runCheckHealth = async () => {
    if (!userId || !isOwner) return;
    setActionLoading("check");
    try {
      const res = await platformFetch<{ ok: boolean; upstreamStatus: number }>(
        "/api/platform/monitoring/check-dealer-health",
        { method: "POST", body: JSON.stringify({}), platformUserId: userId }
      );
      if (res.ok) toast("Dealer health check completed.", "success");
      else {
        toast(
          getPlatformUiErrorMessage({
            status: res.status,
            error: res.error,
            fallback: "Dealer health check failed.",
          }),
          "error"
        );
      }
      fetchHealth();
    } catch {
      toast("Network error. Please retry.", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const runMaintenance = async () => {
    if (!userId) return;
    setActionLoading("maintenance");
    try {
      const res = await platformFetch<{ ok: boolean }>(
        "/api/platform/monitoring/maintenance/run",
        { method: "POST", body: JSON.stringify({ kind: "all" }), platformUserId: userId }
      );
      if (res.ok) toast("Maintenance run completed.", "success");
      else {
        toast(
          getPlatformUiErrorMessage({
            status: res.status,
            error: res.error,
            fallback: "Maintenance run failed.",
          }),
          "error"
        );
      }
      fetchDaily();
    } catch {
      toast("Network error. Please retry.", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const sentryPlatformUrl = typeof window !== "undefined" ? (process.env.NEXT_PUBLIC_SENTRY_PLATFORM_URL ?? "") : "";
  const sentryDealerUrl = typeof window !== "undefined" ? (process.env.NEXT_PUBLIC_SENTRY_DEALER_URL ?? "") : "";

  if (authError === "401") {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-[var(--text-soft)]">Sign in again to access monitoring.</p>
        </CardContent>
      </Card>
    );
  }

  if (authError === "403") {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-[var(--text-soft)]">You don't have access to monitoring.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-[var(--text)]">Monitoring</h1>

      {loading ? (
        <Skeleton className="h-24 w-full" />
      ) : (
        <div
          className={`rounded-lg border px-4 py-3 ${
            statusBanner === "operational"
              ? "border-green-200 bg-green-50 text-green-900"
              : statusBanner === "degraded"
                ? "border-amber-200 bg-amber-50 text-amber-900"
                : "border-red-200 bg-red-50 text-red-900"
          }`}
          role="status"
          aria-live="polite"
        >
          {statusBanner === "operational" && (
            <span>✅ All systems operational</span>
          )}
          {statusBanner === "degraded" && (
            <span>⚠️ Degraded — platform ok, dealer health failing</span>
          )}
          {statusBanner === "outage" && (
            <span>❌ Outage — platform health failing</span>
          )}
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Health &amp; diagnostics</CardTitle>
          <Button variant="secondary" size="sm" onClick={copyDiagnostics} disabled={loading}>
            Copy diagnostics
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {!loading && (
            <>
              <section>
                <h2 className="text-sm font-medium text-[var(--text)] mb-2">Platform</h2>
                <pre className="rounded bg-[var(--muted)] p-3 text-xs overflow-x-auto">
                  {JSON.stringify(platformHealth ?? { error: "Not loaded" }, null, 2)}
                </pre>
              </section>
              <section>
                <h2 className="text-sm font-medium text-[var(--text)] mb-2">Dealer (proxied)</h2>
                <pre className="rounded bg-[var(--muted)] p-3 text-xs overflow-x-auto">
                  {JSON.stringify(dealerHealth ?? { error: "Not loaded" }, null, 2)}
                </pre>
              </section>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Operational actions</CardTitle>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={runCheckHealth}
              disabled={loading || actionLoading != null || !isOwner}
              title={isOwner ? undefined : "Only platform owners can run health checks"}
            >
              {actionLoading === "check" ? "Checking…" : "Run dealer health check"}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={runMaintenance}
              disabled={loading || actionLoading != null || !isOwner}
              title={isOwner ? undefined : "Only platform owners can run maintenance"}
            >
              {actionLoading === "maintenance" ? "Running…" : "Run maintenance"}
            </Button>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Daily telemetry snapshot (last 7 days)</CardTitle>
          <Button variant="secondary" size="sm" onClick={fetchDaily} disabled={dailyLoading}>
            {dailyLoading ? "Refreshing…" : "Refresh"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <section>
            <h2 className="text-sm font-medium text-[var(--text)] mb-2">Rate limits (daily)</h2>
            <pre className="rounded bg-[var(--muted)] p-3 text-xs overflow-x-auto">
              {JSON.stringify(dailyRateLimits ?? { items: [], total: 0 }, null, 2)}
            </pre>
          </section>
          <section>
            <h2 className="text-sm font-medium text-[var(--text)] mb-2">Job runs (daily)</h2>
            <pre className="rounded bg-[var(--muted)] p-3 text-xs overflow-x-auto">
              {JSON.stringify(dailyJobRuns ?? { items: [], total: 0 }, null, 2)}
            </pre>
          </section>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sentry</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <span className="text-sm font-medium text-[var(--text)]">Platform: </span>
            {sentryPlatformUrl ? (
              <a
                href={sentryPlatformUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-[var(--accent)] underline"
                aria-label="Open Sentry platform in new tab"
              >
                Open in new tab
              </a>
            ) : (
              <span className="text-sm text-[var(--text-soft)]">
                Set NEXT_PUBLIC_SENTRY_PLATFORM_URL to show the link.
              </span>
            )}
          </div>
          <div>
            <span className="text-sm font-medium text-[var(--text)]">Dealer: </span>
            {sentryDealerUrl ? (
              <a
                href={sentryDealerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-[var(--accent)] underline"
                aria-label="Open Sentry dealer in new tab"
              >
                Open in new tab
              </a>
            ) : (
              <span className="text-sm text-[var(--text-soft)]">
                Set NEXT_PUBLIC_SENTRY_DEALER_URL to show the link.
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button variant="secondary" size="sm" onClick={fetchHealth} disabled={loading}>
          Refresh
        </Button>
      </div>
    </div>
  );
}
