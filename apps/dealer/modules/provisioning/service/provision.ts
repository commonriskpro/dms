import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { auditLog } from "@/lib/audit";

const DEFAULT_ROLE_KEYS: Record<string, string[]> = {
  Owner: [
    "admin.dealership.read", "admin.dealership.write", "admin.memberships.read", "admin.memberships.write",
    "admin.roles.read", "admin.roles.write", "admin.audit.read", "inventory.read", "inventory.write",
    "customers.read", "customers.write", "deals.read", "deals.write", "documents.read", "documents.write",
    "finance.read", "finance.write", "lenders.read", "lenders.write", "finance.submissions.read", "finance.submissions.write",
    "reports.read", "reports.export", "crm.read", "crm.write",
  ],
  Admin: [
    "admin.dealership.read", "admin.dealership.write", "admin.memberships.read", "admin.memberships.write",
    "admin.roles.read", "admin.audit.read", "inventory.read", "inventory.write", "customers.read", "customers.write",
    "deals.read", "deals.write", "documents.read", "documents.write", "finance.read", "lenders.read",
    "finance.submissions.read", "reports.read", "crm.read", "crm.write",
  ],
  Sales: [
    "inventory.read", "inventory.write", "customers.read", "customers.write", "deals.read", "deals.write",
    "documents.read", "documents.write", "finance.read", "lenders.read", "finance.submissions.read",
    "reports.read", "crm.read", "crm.write",
  ],
  Finance: [
    "inventory.read", "customers.read", "deals.read", "deals.write", "documents.read", "documents.write",
    "finance.read", "finance.write", "lenders.read", "lenders.write", "finance.submissions.read", "finance.submissions.write",
    "reports.read", "reports.export", "crm.read", "crm.write",
  ],
};

const DEFAULT_PIPELINE_STAGES = [
  { name: "Lead", order: 0, colorKey: "gray" },
  { name: "Qualified", order: 1, colorKey: "blue" },
  { name: "Proposal", order: 2, colorKey: "yellow" },
  { name: "Won", order: 3, colorKey: "green" },
  { name: "Lost", order: 4, colorKey: "red" },
];

export type ProvisionResult = { dealerDealershipId: string; provisionedAt: Date };

export async function provisionDealership(
  platformDealershipId: string,
  legalName: string,
  displayName: string,
  planKey: string,
  limits: Record<string, unknown>,
  idempotencyKey: string
): Promise<ProvisionResult> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.provisioningIdempotency.findUnique({
      where: { idempotencyKey },
      include: { dealership: true },
    });
    if (existing) {
      return {
        dealerDealershipId: existing.dealerDealershipId,
        provisionedAt: existing.provisionedAt,
      };
    }

    const existingByPlatform = await tx.dealership.findUnique({
      where: { platformDealershipId },
    });
    if (existingByPlatform) {
      throw new Error("CONFLICT_PLATFORM_DEALERSHIP_ID");
    }

    const now = new Date();
    const dealership = await tx.dealership.create({
      data: {
        name: displayName,
        slug: null,
        settings: { planKey, limits } as Prisma.InputJsonValue,
        isActive: true,
        platformDealershipId,
        lifecycleStatus: "ACTIVE",
        locations: {
          create: { name: "Main", isPrimary: true },
        },
      },
    });

    const permissions = await tx.permission.findMany({
      where: { key: { in: [...new Set(Object.values(DEFAULT_ROLE_KEYS).flat())] } },
      select: { id: true, key: true },
    });
    const keyToId = new Map(permissions.map((p) => [p.key, p.id]));

    for (const [roleName, keys] of Object.entries(DEFAULT_ROLE_KEYS)) {
      const permIds = keys.filter((k) => keyToId.has(k)).map((k) => keyToId.get(k)!);
      await tx.role.create({
        data: {
          dealershipId: dealership.id,
          name: roleName,
          isSystem: true,
          rolePermissions: {
            create: permIds.map((permissionId) => ({ permissionId })),
          },
        },
      });
    }

    const pipeline = await tx.pipeline.create({
      data: {
        dealershipId: dealership.id,
        name: "Sales",
        isDefault: true,
      },
    });
    for (const s of DEFAULT_PIPELINE_STAGES) {
      await tx.stage.create({
        data: {
          dealershipId: dealership.id,
          pipelineId: pipeline.id,
          name: s.name,
          order: s.order,
          colorKey: s.colorKey,
        },
      });
    }

    await tx.provisioningIdempotency.create({
      data: {
        idempotencyKey,
        platformDealershipId,
        dealerDealershipId: dealership.id,
        provisionedAt: now,
      },
    });

    await auditLog({
      dealershipId: dealership.id,
      actorUserId: null,
      action: "tenant.provisioned",
      entity: "Dealership",
      entityId: dealership.id,
      metadata: { platformDealershipId, provisionedAt: now.toISOString() },
    });

    return { dealerDealershipId: dealership.id, provisionedAt: now };
  });
}
