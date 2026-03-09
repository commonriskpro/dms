"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client/http";

export default function ApplyInviteTokenPage() {
  const params = useParams();
  const router = useRouter();
  const token = typeof params.token === "string" ? params.token : "";
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!token) {
      setError("Missing invite token.");
      setLoading(false);
      return;
    }
    apiFetch<{ applicationId: string }>(`/api/apply/invite/${encodeURIComponent(token)}`)
      .then((data) => {
        router.replace(`/apply/${data.applicationId}`);
      })
      .catch(() => {
        setError("Invalid or expired invite link.");
        setLoading(false);
      });
  }, [token, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-8">
      <p className="text-[var(--danger-muted-fg)]">{error}</p>
      <a href="/apply" className="mt-4 text-sm text-[var(--accent)] hover:underline">
        ← Back to apply
      </a>
    </div>
  );
}
