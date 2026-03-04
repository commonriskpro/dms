"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/client/http";
import { useSession } from "@/contexts/session-context";
import { useToast } from "@/components/toast";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { OnboardingStatusFromServer } from "./page";

export type DealershipOption = { id: string; name: string };

export type GetStartedClientProps = {
  /** Onboarding state from GET /api/auth/onboarding-status (server). */
  initialOnboardingStatus: OnboardingStatusFromServer | null;
  /** Dealerships the user is a member of (from server), for CASE 1. */
  initialDealerships: DealershipOption[];
};

export function GetStartedClient({
  initialOnboardingStatus,
  initialDealerships,
}: GetStartedClientProps) {
  const router = useRouter();
  const { refetch } = useSession();
  const { addToast } = useToast();
  const [switchingId, setSwitchingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const membershipsCount = initialOnboardingStatus?.membershipsCount ?? initialDealerships.length;
  const hasActiveDealership = initialOnboardingStatus?.hasActiveDealership ?? false;
  const pendingInvitesCount = initialOnboardingStatus?.pendingInvitesCount ?? 0;
  const nextAction = initialOnboardingStatus?.nextAction ?? "NONE";

  const hasMemberships = membershipsCount > 0;
  const case1SelectDealership = hasMemberships && !hasActiveDealership;
  const case2PendingInvite = membershipsCount === 0 && pendingInvitesCount > 0;
  const case3NoDealership = membershipsCount === 0 && pendingInvitesCount === 0;

  async function handleSelectDealership(dealershipId: string) {
    setError("");
    setSwitchingId(dealershipId);
    try {
      await apiFetch("/api/auth/session/switch", {
        method: "PATCH",
        body: JSON.stringify({ dealershipId }),
      });
      addToast("success", "Dealership selected. Redirecting…");
      await refetch();
      router.replace("/dashboard");
      router.refresh();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to switch";
      setError(message);
    } finally {
      setSwitchingId(null);
    }
  }

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

        {case1SelectDealership && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Select your dealership</CardTitle>
              <CardDescription>
                You’re a member of the following dealerships. Choose one to continue (e.g. after accepting an invite).
              </CardDescription>
            </CardHeader>
            <CardContent>
              {error && (
                <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800">
                  {error}
                </div>
              )}
              <div className="flex flex-col gap-2">
                {initialDealerships.map((d) => (
                  <Button
                    key={d.id}
                    variant="secondary"
                    onClick={() => handleSelectDealership(d.id)}
                    disabled={switchingId !== null}
                    isLoading={switchingId === d.id}
                  >
                    {d.name}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {case2PendingInvite && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Pending invite</CardTitle>
              <CardDescription>
                You have a pending dealership invite. Check your email to join.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/accept-invite">
                <Button variant="secondary" className="w-full">
                  Open invite link
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {case3NoDealership && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>No dealership linked yet</CardTitle>
              <CardDescription>
                You don’t have a dealership linked yet. Accept an invite or use the dev option below.
              </CardDescription>
            </CardHeader>
            <CardContent />
          </Card>
        )}

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Link me as Owner (demo)</CardTitle>
            <CardDescription>
              <span className="font-medium text-[var(--text)]">DEV ONLY.</span>{" "}
              Link your account as Owner of the demo dealership. Use this only for initial setup or development.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800">
                {error}
              </div>
            )}
            <Button onClick={handleBootstrap} isLoading={loading} variant={case1SelectDealership ? "secondary" : "primary"}>
              Link me as Owner
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
