"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { useSession } from "@/contexts/session-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Tab = "password" | "magic";

function getRedirectPath(next: string | null): string {
  if (!next || typeof next !== "string") return "/";
  const path = next.startsWith("/") ? next : `/${next}`;
  if (path.includes("//") || path.startsWith("/\\")) return "/";
  return path;
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const redirectTo = React.useMemo(() => getRedirectPath(next), [next]);
  const { refetch } = useSession();
  const [tab, setTab] = React.useState<Tab>("password");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [magicSent, setMagicSent] = React.useState(false);

  const supabase = React.useMemo(() => createClient(), []);

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) {
        setError(err.message ?? "Invalid email or password");
        return;
      }
      await refetch();
      router.replace(redirectTo);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function handleMagicSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL ||
        (typeof window !== "undefined" ? window.location.origin : "");
      const redirectTo = baseUrl ? `${baseUrl.replace(/\/$/, "")}/` : `${typeof window !== "undefined" ? window.location.origin : ""}/`;
      const { error: err } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo },
      });
      if (err) {
        setError(err.message ?? "Failed to send magic link");
        return;
      }
      setMagicSent(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>Sign in to DMS with email</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Button
              type="button"
              variant={tab === "password" ? "secondary" : "ghost"}
              size="md"
              className="flex-1"
              onClick={() => { setTab("password"); setError(""); setMagicSent(false); }}
            >
              Password
            </Button>
            <Button
              type="button"
              variant={tab === "magic" ? "secondary" : "ghost"}
              size="md"
              className="flex-1"
              onClick={() => { setTab("magic"); setError(""); setMagicSent(false); }}
            >
              Magic link
            </Button>
          </div>

          {searchParams.get("error") === "invalid_link" && (
            <div className="mb-4 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--muted-text)]" role="status">
              This link has expired or is invalid. Please try again or sign in.
            </div>
          )}

          {error && (
            <div className="mb-4 rounded-md bg-[var(--danger-muted)] border border-[var(--danger)] px-3 py-2 text-sm text-[var(--danger-muted-fg)]">
              {error}
            </div>
          )}

          {tab === "password" && (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <Input
                label="Email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Input
                label="Password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <p className="text-right text-sm">
                <Link
                  href="/forgot-password"
                  className="text-[var(--accent)] hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--ring)] rounded"
                >
                  Forgot password?
                </Link>
              </p>
              <Button type="submit" className="w-full" isLoading={loading}>
                Sign in
              </Button>
            </form>
          )}

          {tab === "magic" && (
            <>
              {magicSent ? (
                <p className="text-sm text-[var(--text-soft)]">
                  Check your inbox for a sign-in link. You can close this page.
                </p>
              ) : (
                <form onSubmit={handleMagicSubmit} className="space-y-4">
                  <Input
                    label="Email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  <Button type="submit" className="w-full" isLoading={loading}>
                    Send magic link
                  </Button>
                </form>
              )}
            </>
          )}
          <p className="mt-4 text-center text-sm text-[var(--text-soft)]">
            <Link href="/accept-invite" className="text-[var(--accent)] hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 rounded">
              Have an invite? Accept it
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center p-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
        </div>
      }
    >
      <LoginContent />
    </React.Suspense>
  );
}
