/**
 * Accounting export: CSV and QuickBooks-compatible format from posted transactions.
 */
import { prisma } from "@/lib/db";
import { requireTenantActiveForRead } from "@/lib/tenant-status";

function toDateStart(iso: string): Date {
  const d = new Date(iso);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function toDateEnd(iso: string): Date {
  const d = new Date(iso);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

/** Escape CSV cell; export for tests. */
export function escapeCsvCell(value: string | number | null | undefined): string {
  if (value == null) return "";
  const s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export type ExportAccountingParams = {
  dealershipId: string;
  from: string;
  to: string;
  accountId?: string | null;
  format: "csv" | "quickbooks";
};

/** One line per entry (transaction row). */
export async function exportAccountingTransactions(
  params: ExportAccountingParams
): Promise<string> {
  await requireTenantActiveForRead(params.dealershipId);
  const fromDate = toDateStart(params.from);
  const toDate = toDateEnd(params.to);

  const transactions = await prisma.accountingTransaction.findMany({
    where: {
      dealershipId: params.dealershipId,
      postedAt: { gte: fromDate, lte: toDate, not: null },
    },
    include: {
      entries: {
        include: { account: true },
        ...(params.accountId != null && params.accountId !== ""
          ? { where: { accountId: params.accountId } }
          : {}),
      },
    },
    orderBy: [{ postedAt: "asc" }, { createdAt: "asc" }],
  });

  const header =
    params.format === "quickbooks"
      ? "Date,Transaction ID,Account Code,Account Name,Debit,Credit,Memo"
      : "Date,TransactionId,AccountCode,AccountName,Debit,Credit,Memo";

  const lines: string[] = [header];
  for (const tx of transactions) {
    const dateStr = tx.postedAt?.toISOString().slice(0, 10) ?? "";
    for (const e of tx.entries) {
      const debit = e.direction === "DEBIT" ? e.amountCents.toString() : "";
      const credit = e.direction === "CREDIT" ? e.amountCents.toString() : "";
      lines.push(
        [
          dateStr,
          tx.id,
          escapeCsvCell(e.account.code),
          escapeCsvCell(e.account.name),
          debit,
          credit,
          escapeCsvCell(e.memo ?? tx.memo),
        ].join(",")
      );
    }
  }
  return lines.join("\n");
}
