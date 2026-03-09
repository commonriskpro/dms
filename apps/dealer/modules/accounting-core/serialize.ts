/**
 * API serializers for accounting-core: expenses and transactions.
 * BigInt → string, Date → ISO string for JSON responses.
 */

export function serializeExpense(exp: {
  id: string;
  dealershipId?: string;
  vehicleId: string | null;
  dealId: string | null;
  category: string;
  vendor: string | null;
  description: string | null;
  amountCents: bigint;
  incurredOn: Date;
  status: string;
  createdByUserId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  const out: Record<string, unknown> = {
    id: exp.id,
    vehicleId: exp.vehicleId,
    dealId: exp.dealId,
    category: exp.category,
    vendor: exp.vendor,
    description: exp.description,
    amountCents: exp.amountCents.toString(),
    incurredOn: exp.incurredOn.toISOString().slice(0, 10),
    status: exp.status,
    createdAt: exp.createdAt.toISOString(),
    updatedAt: exp.updatedAt.toISOString(),
  };
  if (exp.dealershipId !== undefined) out.dealershipId = exp.dealershipId;
  if (exp.createdByUserId !== undefined) out.createdByUserId = exp.createdByUserId;
  return out;
}

type TransactionEntry = {
  id: string;
  direction: string;
  amountCents: bigint;
  accountId: string;
  account?: { code: string; name: string };
};

export function serializeTransaction(tx: {
  id: string;
  dealershipId?: string;
  referenceType: string;
  referenceId: string | null;
  memo: string | null;
  postedAt: Date | null;
  createdByUserId?: string | null;
  createdAt: Date;
  updatedAt: Date;
  entries?: TransactionEntry[];
}) {
  const out: Record<string, unknown> = {
    id: tx.id,
    referenceType: tx.referenceType,
    referenceId: tx.referenceId,
    memo: tx.memo,
    postedAt: tx.postedAt?.toISOString() ?? null,
    createdAt: tx.createdAt.toISOString(),
    updatedAt: tx.updatedAt.toISOString(),
    entries: tx.entries?.map((e) => ({
      id: e.id,
      direction: e.direction,
      amountCents: e.amountCents.toString(),
      accountId: e.accountId,
      ...(e.account && { account: e.account }),
    })),
  };
  if (tx.dealershipId !== undefined) out.dealershipId = tx.dealershipId;
  if (tx.createdByUserId !== undefined) out.createdByUserId = tx.createdByUserId;
  return out;
}
