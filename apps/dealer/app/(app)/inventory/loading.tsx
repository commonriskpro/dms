import { PageShell } from "@/components/ui/page-shell";
import { Skeleton, SkeletonCard, SkeletonTable } from "@/components/ui/skeleton";
import { sectionStack, summaryGrid, mainGrid, cardStack } from "@/lib/ui/recipes/layout";

export default function InventoryLoading() {
  return (
    <PageShell className={sectionStack}>
      <div className={summaryGrid}>
        {[1, 2, 3, 4].map((i) => (
          <SkeletonCard key={i} />
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-[var(--shadow-card)]">
        <div className="flex gap-2">
          <Skeleton className="h-9 w-32 rounded-[var(--radius-pill)]" />
          <Skeleton className="h-9 w-28 rounded-[var(--radius-pill)]" />
          <Skeleton className="h-9 w-28 rounded-[var(--radius-pill)]" />
        </div>
      </div>

      <div className={mainGrid}>
        <SkeletonTable rows={10} columns={6} />
        <aside className={`${cardStack} w-full min-w-0 lg:w-[280px]`}>
          <SkeletonCard />
          <SkeletonCard />
        </aside>
      </div>

      <div>
        <Skeleton className="h-4 w-28" />
      </div>
    </PageShell>
  );
}
