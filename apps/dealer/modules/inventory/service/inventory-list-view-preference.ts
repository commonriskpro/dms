/**
 * Server-side persistence for inventory list view (table vs cards).
 * Scoped by dealershipId and userId from auth context.
 */
import { prisma } from "@/lib/db";

const PREF_KEY = "inventory_list_view";
const VALID_VALUES = ["table", "cards"] as const;
export type InventoryListView = (typeof VALID_VALUES)[number];

export type GetParams = { dealershipId: string; userId: string };
export type SetParams = GetParams & { view: InventoryListView };

export function isValidView(v: string): v is InventoryListView {
  return VALID_VALUES.includes(v as InventoryListView);
}

/** Get saved view or null (default to table). */
export async function getInventoryListViewPreference(
  params: GetParams
): Promise<InventoryListView | null> {
  const row = await prisma.userDealershipPreference.findUnique({
    where: {
      dealershipId_userId_key: {
        dealershipId: params.dealershipId,
        userId: params.userId,
        key: PREF_KEY,
      },
    },
    select: { value: true },
  });
  if (!row || !isValidView(row.value)) return null;
  return row.value as InventoryListView;
}

/** Save view preference. */
export async function setInventoryListViewPreference(params: SetParams): Promise<void> {
  await prisma.userDealershipPreference.upsert({
    where: {
      dealershipId_userId_key: {
        dealershipId: params.dealershipId,
        userId: params.userId,
        key: PREF_KEY,
      },
    },
    create: {
      dealershipId: params.dealershipId,
      userId: params.userId,
      key: PREF_KEY,
      value: params.view,
    },
    update: { value: params.view },
  });
}
