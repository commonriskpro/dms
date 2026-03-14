import * as dealershipDb from "../db/dealership";
import * as membershipDb from "../db/membership";
import * as roleDb from "../db/role";
import { ApiError, getOrCreateProfile } from "@/lib/auth";

type BootstrapLinkOwnerInput = {
  userId: string;
  email?: string | null;
  allowBootstrap: boolean;
};

type BootstrapLinkOwnerResult = {
  message: "Already linked" | "Linked as Owner";
  membershipId: string;
  dealershipId: string;
};

export async function bootstrapLinkOwnerToDemoDealership(
  input: BootstrapLinkOwnerInput
): Promise<BootstrapLinkOwnerResult> {
  const dealership = await dealershipDb.getDealershipBySlug("demo");
  if (!dealership) {
    throw new ApiError("NOT_FOUND", "No demo dealership found. Run db:seed first.");
  }

  const memberCount = await membershipDb.countActiveMembershipsForDealership(dealership.id);
  if (memberCount > 0 && !input.allowBootstrap) {
    throw new ApiError(
      "FORBIDDEN",
      "Dealership already has members. Set ALLOW_BOOTSTRAP_LINK=1 to link anyway."
    );
  }

  const ownerRole = await roleDb.getRoleByName(dealership.id, "Owner");
  if (!ownerRole) {
    throw new ApiError("NOT_FOUND", "Owner role not found. Run db:seed first.");
  }

  await getOrCreateProfile(input.userId, { email: input.email ?? undefined });

  const existing = await membershipDb.getActiveMembership(input.userId, dealership.id);
  if (existing) {
    return {
      message: "Already linked",
      membershipId: existing.id,
      dealershipId: dealership.id,
    };
  }

  const membership = await membershipDb.createMembership({
    dealershipId: dealership.id,
    userId: input.userId,
    roleId: ownerRole.id,
    joinedAt: new Date(),
  });

  return {
    message: "Linked as Owner",
    membershipId: membership.id,
    dealershipId: dealership.id,
  };
}
