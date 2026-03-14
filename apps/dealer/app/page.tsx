"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "@/contexts/session-context";
import { Button } from "@/components/ui/button";

export default function Home() {
  const router = useRouter();
  const { state, activeDealership, hasPermission } = useSession();

  React.useEffect(() => {
    if (state.status === "loading") return;
    if (state.status !== "authenticated") return;
    if (!activeDealership) {
      router.replace("/get-started");
      return;
    }
    // Role-based landing: Admin/Setup → Sales workspace → Inventory workspace → Manager workspace → fallback
    const hasAdmin =
      hasPermission("admin.dealership.read") ||
      hasPermission("admin.memberships.read") ||
      hasPermission("admin.roles.read") ||
      hasPermission("admin.audit.read") ||
      hasPermission("admin.settings.manage") ||
      hasPermission("admin.users.read");
    const hasSales = hasPermission("crm.read") || hasPermission("deals.read") || hasPermission("customers.read");
    const hasInventory = hasPermission("inventory.read");
    const hasManager = hasPermission("dashboard.read") || hasPermission("reports.read");

    if (hasAdmin && !hasSales && !hasInventory) {
      if (hasPermission("admin.dealership.read")) router.replace("/admin/dealership");
      else if (hasPermission("admin.memberships.read") || hasPermission("admin.users.read")) router.replace("/admin/users");
      else if (hasPermission("admin.roles.read")) router.replace("/admin/roles");
      else if (hasPermission("admin.audit.read")) router.replace("/admin/audit");
      else router.replace("/admin/dealership");
    } else if (hasSales) {
      router.replace("/sales");
    } else if (hasInventory) {
      router.replace("/inventory");
    } else if (hasManager) {
      router.replace("/dashboard");
    } else if (hasPermission("documents.read")) {
      router.replace("/files");
    } else {
      router.replace("/dashboard");
    }
  }, [state.status, activeDealership, hasPermission, router]);

  if (state.status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
      </div>
    );
  }

  if (state.status === "unauthenticated") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
        <h1 className="text-2xl font-semibold">DMS</h1>
        <p className="text-[var(--text-soft)]">Dealer Management System</p>
        <div className="flex flex-col items-center gap-3">
          <Link href="/login">
            <Button>Sign in</Button>
          </Link>
          <Link
            href="/accept-invite"
            className="text-sm text-[var(--accent)] hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 rounded"
          >
            Have an invite? Accept it
          </Link>
        </div>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
    </div>
  );
}
