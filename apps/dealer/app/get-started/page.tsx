"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client/http";
import { useSession } from "@/contexts/session-context";
import { useToast } from "@/components/toast";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type DealershipOption = { id: string; name: string };

export default function GetStartedPage() {
  const router = useRouter();
  const { refetch } = useSession();
  const { addToast } = useToast();
  const [myDealerships, setMyDealerships] = React.useState<DealershipOption[] | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [switchingId, setSwitchingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let cancelled = false;
    apiFetch<{ data: { dealerships: DealershipOption[] } }>("/api/auth/dealerships")
      .then((res) => {
        if (!cancelled) setMyDealerships(res.data.dealerships);
      })
      .catch(() => {
        if (!cancelled) setMyDealerships([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

  const hasMemberships = Array.isArray(myDealerships) && myDealerships.length > 0;

  return (
    <AppShell>
      <div className="max-w-xl">
        <h1 className="text-2xl font-semibold text-[var(--text)]">Get started</h1>
        <p className="mt-1 text-[var(--text-soft)]">
          You’re signed in but don’t have an active dealership yet.
        </p>

        {hasMemberships && (
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
                {myDealerships!.map((d) => (
                  <Button
                    key={d.id}
                    variant="outline"
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
            <Button onClick={handleBootstrap} isLoading={loading} variant={hasMemberships ? "outline" : "default"}>
              Link me as Owner
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
