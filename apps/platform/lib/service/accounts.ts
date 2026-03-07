import * as accountsDb from "@/lib/db/accounts";
import { platformAuditLog } from "@/lib/audit";

export async function createPlatformAccount(
  actorPlatformUserId: string,
  data: { name: string; email: string; status?: "ACTIVE" | "SUSPENDED" }
) {
  const account = await accountsDb.createPlatformAccount({
    name: data.name,
    email: data.email,
    status: data.status ?? "ACTIVE",
  });
  await platformAuditLog({
    actorPlatformUserId,
    action: "platform.account_created",
    targetType: "platform_account",
    targetId: account.id,
    afterState: { name: account.name, status: account.status },
  });
  return account;
}

export async function listAccounts(options: {
  limit: number;
  offset: number;
  status?: "ACTIVE" | "SUSPENDED";
}) {
  return accountsDb.listPlatformAccounts({
    limit: options.limit,
    offset: options.offset,
    status: options.status,
  });
}
