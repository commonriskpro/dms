import { redirect } from "next/navigation";
import { getPlatformUserIdFromRequest } from "@/lib/platform-auth";
import { BootstrapForm } from "@/components/bootstrap-form";

export default async function PlatformBootstrapPage() {
  const userId = await getPlatformUserIdFromRequest();
  if (!userId) {
    redirect("/platform/login");
  }

  const bootstrapSecretSet = Boolean(
    process.env.PLATFORM_BOOTSTRAP_SECRET && process.env.PLATFORM_BOOTSTRAP_SECRET.length > 0
  );

  if (!bootstrapSecretSet) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] p-4">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-6 py-8 text-center max-w-md">
          <h1 className="text-xl font-semibold text-[var(--text)]">Bootstrap disabled</h1>
          <p className="mt-2 text-sm text-[var(--text-soft)]">
            Bootstrap is not enabled. Set PLATFORM_BOOTSTRAP_SECRET to enable it.
          </p>
          <a
            href="/api/platform/auth/logout"
            className="mt-4 inline-block text-sm text-[var(--accent)] hover:underline"
          >
            Sign out
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] p-4">
      <BootstrapForm />
    </div>
  );
}
