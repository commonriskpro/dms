import { prisma } from "@/lib/db";

export type CreateAutomationRunInput = {
  entityType: string;
  entityId: string;
  eventKey: string;
  ruleId: string;
  status: string;
};

export async function insertAutomationRunIdempotent(
  dealershipId: string,
  input: CreateAutomationRunInput
): Promise<{ id: string } | null> {
  try {
    const run = await prisma.automationRun.create({
      data: {
        dealershipId,
        entityType: input.entityType,
        entityId: input.entityId,
        eventKey: input.eventKey,
        ruleId: input.ruleId,
        runAt: new Date(),
        status: input.status,
      },
      select: { id: true },
    });
    return run;
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err.code === "P2002") return null;
    throw e;
  }
}

export async function updateAutomationRunStatus(
  dealershipId: string,
  id: string,
  status: string
) {
  return prisma.automationRun.updateMany({
    where: { id, dealershipId },
    data: { status },
  });
}

/**
 * Atomically transition run from "scheduled" to "running". Returns true if updated (this worker owns the run).
 * Used by job worker to ensure only one execution of a delayed automation; idempotent on retry.
 */
export async function tryTransitionAutomationRunToRunning(
  dealershipId: string,
  runId: string
): Promise<boolean> {
  const result = await prisma.automationRun.updateMany({
    where: { id: runId, dealershipId, status: "scheduled" },
    data: { status: "running" },
  });
  return result.count > 0;
}
