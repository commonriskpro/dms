"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Tab = "password" | "magic";

/** Platform login: email/password and magic link. Credentials go to Supabase only (no dev header). */
export default function PlatformLoginPage() {
  const router = useRouter();
  const [tab, setTab] = React.useState<Tab>("password");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [magicSent, setMagicSent] = React.useState(false);

  const supabase = React.useMemo(() => createClient(), []);

  const redirectTo = "/platform";

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
        process.env.NEXT_PUBLIC_APP_URL ?? (typeof window !== "undefined" ? window.location.origin : "");
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
