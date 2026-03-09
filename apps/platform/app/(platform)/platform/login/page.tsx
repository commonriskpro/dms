"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Tab = "password" | "magic";

/** Platform login: email/password and magic link. Credentials go to Supabase only (no dev header). */
export default function PlatformLoginPage() {
  const searchParams = useSearchParams();
  const [tab, setTab] = React.useState<Tab>("password");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [magicSent, setMagicSent] = React.useState(false);

  const supabase = React.useMemo(() => createClient(), []);

  const redirectTo = "/platform";

  const authDebug = process.env.NEXT_PUBLIC_PLATFORM_AUTH_DEBUG === "true" || process.env.NEXT_PUBLIC_PLATFORM_AUTH_DEBUG === "1";

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) {
        if (authDebug) {
          console.info("[auth_debug] login_submit", { success: false, errorMessage: err.message ?? err.name });
        }
        setError(err.message ?? "Invalid email or password");
        return;
      }
      if (authDebug) {
        console.info("[auth_debug] login_submit", { success: true });
        try {
          const res = await fetch("/api/platform/auth/debug");
          const data = await res.json().catch(() => ({}));
          console.info("[auth_debug] session_after_login", {
            status: res.status,
            cookieNames: data.cookieNames,
            supabaseHasUser: data.supabaseHasUser,
            platformUserFound: data.platformUserFound,
          });
        } catch (_) {
          console.info("[auth_debug] session_after_login", { fetchError: "request failed" });
        }
      }
      // Full-page redirect so the next request sends session cookies; avoids RSC fetch
      // racing with cookie set and server not seeing the session (stuck on login / 404).
      window.location.href = redirectTo;
      return;
    } finally {
      setLoading(false);
    }
  }

  async function handleMagicSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const runtimeOrigin = typeof window !== "undefined" ? window.location.origin : "";
      const envOrigin = process.env.NEXT_PUBLIC_APP_URL ?? "";
      const baseUrl = runtimeOrigin || envOrigin;
      if (authDebug && runtimeOrigin && envOrigin && runtimeOrigin !== envOrigin) {
        console.info("[auth_debug] app_url_mismatch", {
          runtimeOrigin,
          envOrigin,
          using: runtimeOrigin,
        });
      }
      const redirectToUrl = baseUrl ? `${baseUrl.replace(/\/$/, "")}/api/platform/auth/callback` : "";
      const { error: err } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectToUrl },
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
          <CardTitle>Platform admin sign in</CardTitle>
          <CardDescription>Sign in with your platform account</CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className="flex gap-2 mb-4"
            role="tablist"
            aria-label="Sign in method"
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab === "password"}
              aria-controls="password-panel"
              id="tab-password"
              onClick={() => {
                setTab("password");
                setError("");
                setMagicSent(false);
              }}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium ${
                tab === "password"
                  ? "bg-[var(--muted)] text-[var(--accent)]"
                  : "text-[var(--text-soft)] hover:bg-[var(--muted)]"
              }`}
            >
              Password
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "magic"}
              aria-controls="magic-panel"
              id="tab-magic"
              onClick={() => {
                setTab("magic");
                setError("");
                setMagicSent(false);
              }}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium ${
                tab === "magic"
                  ? "bg-[var(--muted)] text-[var(--accent)]"
                  : "text-[var(--text-soft)] hover:bg-[var(--muted)]"
              }`}
            >
              Magic link
            </button>
          </div>

          {searchParams.get("error") && (
            <div
              className="mb-4 rounded-md border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--muted-text)]"
              role="status"
            >
              This link has expired or is invalid. Please try again or sign in.
            </div>
          )}

          {error && (
            <div
              className="mb-4 rounded-md border px-3 py-2 text-sm bg-[var(--panel)] border-[var(--danger)] text-[var(--danger)]"
              role="alert"
            >
              {error}
            </div>
          )}

          {tab === "password" && (
            <form
              id="password-panel"
              role="tabpanel"
              aria-labelledby="tab-password"
              onSubmit={handlePasswordSubmit}
              className="space-y-4"
            >
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
                  href="/platform/forgot-password"
                  className="text-[var(--accent)] hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--ring)] rounded"
                >
                  Forgot password?
                </Link>
              </p>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          )}

          {tab === "magic" && (
            <div
              id="magic-panel"
              role="tabpanel"
              aria-labelledby="tab-magic"
            >
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
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Sending…" : "Send magic link"}
                  </Button>
                </form>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
