"use client";

import * as React from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const EXPIRED_MESSAGE = "This link has expired or was already used. Please request a new password reset.";
const SUCCESS_MESSAGE = "Password updated. You can sign in with your new password.";

function parseRecoveryFromHash(): { access_token: string; refresh_token: string } | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash?.slice(1) || "";
  const params = new URLSearchParams(hash);
  const type = params.get("type");
  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");
  if (type !== "recovery" || !access_token || !refresh_token) return null;
  return { access_token, refresh_token };
}

export function ResetPasswordForm() {
  const [recoveryReady, setRecoveryReady] = React.useState<boolean | null>(null);
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [success, setSuccess] = React.useState(false);
  const [error, setError] = React.useState("");
  const [fieldError, setFieldError] = React.useState<"password" | "confirm" | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const tokens = parseRecoveryFromHash();
    if (!tokens) {
      setRecoveryReady(false);
      return;
    }
    const supabase = createClient();
    supabase.auth
      .setSession({ access_token: tokens.access_token, refresh_token: tokens.refresh_token })
      .then(({ error: err }) => {
        if (!cancelled) setRecoveryReady(!err);
      })
      .catch(() => {
        if (!cancelled) setRecoveryReady(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setFieldError(null);
    if (password !== confirmPassword) {
      setFieldError("confirm");
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirmPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.error?.message ?? EXPIRED_MESSAGE;
        setError(msg);
        if (data?.error?.details?.fieldErrors?.password) setFieldError("password");
        else if (data?.error?.details?.fieldErrors?.confirmPassword) setFieldError("confirm");
        return;
      }
      setSuccess(true);
    } finally {
      setLoading(false);
    }
  }

  if (recoveryReady === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (recoveryReady === false) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Link expired</CardTitle>
            <CardDescription>{EXPIRED_MESSAGE}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/forgot-password"
              className="inline-flex items-center justify-center font-medium border border-[var(--border)] bg-[var(--panel)] text-[var(--text)] hover:bg-[var(--muted)] px-4 py-2 text-sm rounded-md transition-colors focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            >
              Request new reset link
            </Link>
            <p className="mt-4 text-center text-sm text-[var(--text-soft)]">
              <Link href="/login" className="text-[var(--accent)] hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--ring)] rounded">
                Back to sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Password updated</CardTitle>
            <CardDescription>{SUCCESS_MESSAGE}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/login"
              className="inline-flex items-center justify-center font-medium border border-[var(--border)] bg-[var(--panel)] text-[var(--text)] hover:bg-[var(--muted)] px-4 py-2 text-sm rounded-md transition-colors focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            >
              Sign in
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Set new password</CardTitle>
          <CardDescription>
            Enter your new password below. Use at least 12 characters and include 3 of: uppercase, lowercase, digit, symbol.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div
              className="mb-4 rounded-md border border-[var(--danger)] bg-[var(--danger-muted)] px-3 py-2 text-sm text-[var(--danger-muted-fg)]"
              role="alert"
            >
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="New password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setFieldError(null); }}
              required
              disabled={loading}
              error={fieldError === "password" ? error : undefined}
            />
            <Input
              label="Confirm password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setFieldError(null); }}
              required
              disabled={loading}
              error={fieldError === "confirm" ? error : undefined}
            />
            <Button type="submit" className="w-full" disabled={loading} isLoading={loading}>
              Update password
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-[var(--text-soft)]">
            <Link href="/login" className="text-[var(--accent)] hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--ring)] rounded">
              Back to sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
