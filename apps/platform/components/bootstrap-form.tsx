"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { platformFetch } from "@/lib/api-client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function BootstrapForm() {
  const router = useRouter();
  const [secret, setSecret] = React.useState("");
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await platformFetch("/api/platform/bootstrap", {
        method: "POST",
        body: JSON.stringify({ secret }),
      });
      if (!res.ok) {
        if (res.status === 401) setError("Sign in again to continue.");
        else if (res.status === 403) setError("Bootstrap is not allowed for this account.");
        else if (res.error?.code === "INVALID_SECRET") setError("Bootstrap secret is incorrect.");
        else setError("Bootstrap failed.");
        return;
      }
      router.replace("/platform");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Platform owner bootstrap</CardTitle>
        <CardDescription>
          Enter the bootstrap secret to become the platform owner. You must be signed in.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="password"
            label="Bootstrap secret"
            placeholder="Enter secret"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            autoComplete="off"
            required
          />
          {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
          <Button type="submit" isLoading={loading} disabled={loading}>
            Bootstrap as owner
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
