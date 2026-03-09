import { Suspense } from "react";
import { ApplyFormClient } from "./ApplyFormClient";

export const dynamic = "force-dynamic";

export default async function ApplyIdPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center p-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
        </div>
      }
    >
      <ApplyFormClient applicationId={id} />
    </Suspense>
  );
}
