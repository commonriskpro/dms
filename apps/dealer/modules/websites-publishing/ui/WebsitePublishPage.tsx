"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import type { WebsitePublishReleaseDto, PublishWebsiteBody } from "@dms/contracts";
import { publishWebsiteBodySchema } from "@dms/contracts";

type ReleasesResponse = { releases: WebsitePublishReleaseDto[] };
type PublishResponse = { release: WebsitePublishReleaseDto };

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function WebsitePublishPage() {
  const { addToast } = useToast();
  const [releases, setReleases] = React.useState<WebsitePublishReleaseDto[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [publishing, setPublishing] = React.useState(false);
  const [publishNote, setPublishNote] = React.useState("");

  React.useEffect(() => {
    apiFetch<ReleasesResponse>("/api/websites/publish/releases")
      .then((r) => setReleases(r.releases))
      .catch((e) => setError(getApiErrorMessage(e)))
      .finally(() => setLoading(false));
  }, []);

  async function handlePublish(e: React.FormEvent) {
    e.preventDefault();
    setPublishing(true);
    try {
      const body: PublishWebsiteBody = publishNote.trim() ? { publishNote: publishNote.trim() } : {};
      const r = await apiFetch<PublishResponse>("/api/websites/publish", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setReleases((prev) =>
        [r.release, ...prev.map((rel) => ({ ...rel, isActive: false }))].slice(0, 50)
      );
      setPublishNote("");
      addToast("success", `Website published — Release v${r.release.versionNumber}`);
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    } finally {
      setPublishing(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 rounded-[var(--radius-card)]" />
        <Skeleton className="h-64 rounded-[var(--radius-card)]" />
      </div>
    );
  }
  if (error) return <ErrorState message={error} />;

  const activeRelease = releases.find((r) => r.isActive);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--text)]">Publish</h1>
        <p className="text-sm text-[var(--text-soft)]">
          Publish a new snapshot of your website to make changes live.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Publish New Release</CardTitle>
        </CardHeader>
        <CardContent>
          {activeRelease && (
            <div className="mb-4 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-sm">
              <span className="font-medium text-[var(--text)]">Currently live: </span>
              <span className="text-[var(--text-soft)]">
                Release v{activeRelease.versionNumber} · Published {formatDate(activeRelease.publishedAt)}
              </span>
            </div>
          )}
          <WriteGuard>
            <form onSubmit={handlePublish} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="pub-note">Release Note (optional)</Label>
                <Input
                  id="pub-note"
                  value={publishNote}
                  onChange={(e) => setPublishNote(e.target.value)}
                  maxLength={500}
                  placeholder="e.g. Updated inventory and contact hours"
                />
              </div>
              <Button type="submit" variant="primary" disabled={publishing}>
                {publishing ? "Publishing…" : "Publish Website"}
              </Button>
            </form>
          </WriteGuard>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Release History</CardTitle>
        </CardHeader>
        <CardContent>
          {releases.length === 0 ? (
            <EmptyState
              title="No releases yet"
              description="Publish your website to create the first release."
            />
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {releases.map((rel) => (
                <div key={rel.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-[var(--text)]">
                      Release v{rel.versionNumber}
                      {rel.isActive && (
                        <span className="ml-2 inline-flex items-center rounded-full bg-[var(--success-muted)] px-2 py-0.5 text-xs font-medium text-[var(--success-muted-fg)]">
                          Live
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-[var(--text-soft)]">{formatDate(rel.publishedAt)}</p>
                  </div>
                  <span className="text-xs text-[var(--text-soft)]">#{rel.id.slice(0, 8)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
