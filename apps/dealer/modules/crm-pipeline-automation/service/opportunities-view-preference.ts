import { prisma } from "@/lib/db";

const PREF_KEY = "crm_opportunities_view";
const VALID_VALUES = ["board", "list"] as const;

export type OpportunitiesWorkspaceView = (typeof VALID_VALUES)[number];

export type GetParams = { dealershipId: string; userId: string };
export type SetParams = GetParams & { view: OpportunitiesWorkspaceView };

export function isValidOpportunitiesView(value: string): value is OpportunitiesWorkspaceView {
  return VALID_VALUES.includes(value as OpportunitiesWorkspaceView);
}

export async function getOpportunitiesViewPreference(
  params: GetParams
): Promise<OpportunitiesWorkspaceView | null> {
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

  if (!row || !isValidOpportunitiesView(row.value)) return null;
  return row.value as OpportunitiesWorkspaceView;
}

export async function setOpportunitiesViewPreference(params: SetParams): Promise<void> {
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
    update: {
      value: params.view,
    },
  });
}
