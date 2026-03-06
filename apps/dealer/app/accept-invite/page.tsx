import { unstable_noStore as noStore } from "next/cache";
import { Suspense } from "react";
import { AcceptInviteClient } from "./AcceptInviteClient";

export const dynamic = "force-dynamic";

type ResolveSuccess = {
  inviteId: string;
  dealershipName: string;
  roleName: string;
  expiresAt?: string;
  emailMasked?: string;
};

async function getResolveForToken(token: string): Promise<{
  data: ResolveSuccess | null;
  error: { status: number; code?: string } | null;
}> {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    (typeof process.env.VERCEL_URL === "string"
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");
  try {
    const res = await fetch(
      `${base}/api/invite/resolve?token=${encodeURIComponent(token)}`,
      { cache: "no-store" }
    );
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.data) {
      return { data: json.data as ResolveSuccess, error: null };
    }
    const code = (json.error as { code?: string })?.code;
    return { data: null, error: { status: res.status, code } };
  } catch {
    return { data: null, error: { status: 500 } };
  }
}

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  noStore();
  const params = await searchParams;
  const token = (params.token ?? "").trim();

  let initialResolve: ResolveSuccess | null = null;
  let resolveError: { status: number; code?: string } | null = null;

  if (token) {
    const result = await getResolveForToken(token);
    initialResolve = result.data;
    resolveError = result.error;
    if (resolveError && resolveError.status !== 404 && resolveError.status !== 410) {
      resolveError = null;
    }
  }

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center p-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
        </div>
      }
    >
      <AcceptInviteClient
        initialToken={token}
        initialResolve={initialResolve}
        resolveError={resolveError}
      />
    </Suspense>
  );
}
