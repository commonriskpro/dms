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
        <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-card)]">
          <p className="text-[var(--muted-text)]">You don&apos;t have access to accounting.</p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="mb-4 flex gap-2 border-b border-[var(--border)] pb-2">
        <Link
          href="/accounting/accounts"
          className="rounded-md px-3 py-1.5 text-sm font-medium text-[var(--text)] hover:bg-[var(--panel)]"
        >
          Accounts
        </Link>
        <Link
          href="/accounting/transactions"
          className="rounded-md px-3 py-1.5 text-sm font-medium text-[var(--text)] hover:bg-[var(--panel)]"
        >
          Transactions
        </Link>
        <Link
          href="/accounting/expenses"
          className="rounded-md px-3 py-1.5 text-sm font-medium text-[var(--text)] hover:bg-[var(--panel)]"
        >
          Expenses
        </Link>
      </div>
      {children}
    </PageShell>
  );
}
