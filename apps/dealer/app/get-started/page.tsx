"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client/http";
import { useSession } from "@/contexts/session-context";
import { useToast } from "@/components/toast";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function GetStartedPage() {
  const router = useRouter();
  const { refetch } = useSession();
  const { addToast } = useToast();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  async function handleBootstrap() {
    setError("");
    setLoading(true);
    try {
      await apiFetch<{ message: string; dealershipId: string }>(
        "/api/admin/bootstrap-link-owner",
        { method: "POST" }
      );
      addToast("success", "Linked as Owner. Redirecting…");
      await refetch();
      router.replace("/admin/dealership");
      router.refresh();
    } catch (e: unknown) {
      const status = e && typeof e === "object" && "status" in e ? (e as { status: number }).status : 0;
      const message = e instanceof Error ? e.message : "Failed to link";
      if (status === 403) {
        setError("This dealership already has members. Contact an admin to be invited.");
      } else if (status === 404) {
        setError("No demo dealership found. Run db:seed first.");
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <div className="max-w-xl">
        <h1 className="text-2xl font-semibold text-[var(--text)]">Get started</h1>
        <p className="mt-1 text-[var(--text-soft)]">
          You’re signed in but don’t have an active dealership yet.
        </p>
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Link me as Owner (demo)</CardTitle>
            <CardDescription>
              Link your account as Owner of the demo dealership. Use this only for initial setup or development.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800">
                {error}
              </div>
            )}
            <Button onClick={handleBootstrap} isLoading={loading}>
              Link me as Owner
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
