import { getSessionContextOrNull } from "@/lib/api/handler";
import Link from "next/link";
import { PageShell } from "@/components/ui/page-shell";

export const dynamic = "force-dynamic";

export default async function AccountingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSessionContextOrNull();
  const permissions = session?.permissions ?? [];
  const canRead = permissions.includes("finance.submissions.read");

  if (!canRead) {
    return (
      <PageShell>
        <div className="glass-surface rounded-[var(--radius-card)] border border-[var(--glass-border)] bg-[var(--glass-bg)] p-6 shadow-[var(--glass-shadow-sm)]">
          <p className="text-[var(--muted-text)]">You don&apos;t have access to accounting.</p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="mb-4 flex gap-2 border-b border-[var(--glass-border)] pb-2">
        <Link
          href="/accounting/accounts"
          className="glass-field rounded-md border border-transparent px-3 py-1.5 text-sm font-medium text-[var(--text)] hover:border-[var(--glass-border)] hover:bg-[var(--glass-bg)]"
        >
          Accounts
        </Link>
        <Link
          href="/accounting/transactions"
          className="glass-field rounded-md border border-transparent px-3 py-1.5 text-sm font-medium text-[var(--text)] hover:border-[var(--glass-border)] hover:bg-[var(--glass-bg)]"
        >
          Transactions
        </Link>
        <Link
          href="/accounting/expenses"
          className="glass-field rounded-md border border-transparent px-3 py-1.5 text-sm font-medium text-[var(--text)] hover:border-[var(--glass-border)] hover:bg-[var(--glass-bg)]"
        >
          Expenses
        </Link>
      </div>
      {children}
    </PageShell>
  );
}
