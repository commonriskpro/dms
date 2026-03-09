"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/client/http";

export default function ApplyEntryPage() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [resumePath, setResumePath] = React.useState("");

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const trimmed = email.trim();
    if (!trimmed) {
      setError("Email is required.");
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch<{ applicationId: string }>("/api/apply/draft", {
        method: "POST",
        body: JSON.stringify({
          source: "public_apply",
          ownerEmail: trimmed,
        }),
      });
      if (res.applicationId) {
        router.replace(`/apply/${res.applicationId}`);
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start application.");
    } finally {
      setLoading(false);
    }
  };

  const handleResume = (e: React.FormEvent) => {
    e.preventDefault();
    const path = resumePath.trim();
    const fromUrl = path.match(/\/apply\/([a-f0-9-]{36})/i);
    const id = fromUrl?.[1] ?? (path.match(/^[a-f0-9-]{36}$/i) ? path : null);
    if (id) {
      router.push(`/apply/${id}`);
      return;
    }
    setError("Paste your application link (e.g. /apply/...) or application ID.");
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-8">
      <h1 className="text-xl font-semibold text-[var(--text)]">Dealer application</h1>
      <p className="mt-1 text-sm text-[var(--text-soft)]">
        Apply to get started. You can save and resume using your application link.
      </p>

      <Card className="mt-6 border-[var(--border)] bg-[var(--surface)]">
        <CardHeader>
          <CardTitle className="text-base">Start new application</CardTitle>
          <CardDescription>Enter the owner email for this application.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md border border-[var(--danger)] bg-[var(--danger-muted)] px-3 py-2 text-sm text-[var(--danger-muted-fg)]">
              {error}
            </div>
          )}
          <form onSubmit={handleStart} className="space-y-3">
            <Input
              label="Owner email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@dealership.com"
              required
            />
            <Button type="submit" className="w-full" isLoading={loading} disabled={loading}>
              Start application
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="mt-4 border-[var(--border)] bg-[var(--surface)]">
        <CardHeader>
          <CardTitle className="text-base">Resume application</CardTitle>
          <CardDescription>
            Use the link you saved when you started (e.g. /apply/...). No account needed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleResume} className="space-y-3">
            <Input
              label="Application link or ID"
              type="text"
              value={resumePath}
              onChange={(e) => setResumePath(e.target.value)}
              placeholder="/apply/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            />
            <Button type="submit" variant="secondary" className="w-full">
              Open application
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="mt-6 text-center text-sm text-[var(--text-soft)]">
        <Link href="/login" className="text-[var(--accent)] hover:underline">
          Sign in
        </Link>
        {" · "}
        <Link href="/accept-invite" className="text-[var(--accent)] hover:underline">
          Have an invite?
        </Link>
      </p>
    </div>
  );
}
