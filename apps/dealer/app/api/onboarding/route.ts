import { NextRequest } from "next/server";
import { z } from "zod";
import * as onboardingService from "@/modules/onboarding/service/onboarding";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
  readSanitizedJson,
} from "@/lib/api/handler";
import { validationErrorResponse } from "@/lib/api/validate";

export const dynamic = "force-dynamic";

const inventoryPathSchema = z.enum(["add_first", "import", "later"]);

const patchBodySchema = z
  .object({
    currentStep: z.number().int().min(1).max(6).optional(),
    completeStep: z.number().int().min(1).max(6).optional(),
    skipStep: z.number().int().min(1).max(6).optional(),
    inventoryPathChosen: inventoryPathSchema.optional(),
    markComplete: z.literal(true).optional(),
  })
  .refine(
    (data) => {
      const keys = Object.keys(data).filter((k) => data[k as keyof typeof data] !== undefined);
      return keys.length <= 1;
    },
    { message: "Exactly one of currentStep, completeStep, skipStep, inventoryPathChosen, markComplete allowed" }
  );

/**
 * GET /api/onboarding — Current dealership onboarding state (lazy-created on first read).
 * Requires admin.dealership.read. Scoped by session dealership.
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "admin.dealership.read");
    const state = await onboardingService.getOrCreateState(ctx.dealershipId);
    return jsonResponse({
      onboarding: {
        id: state.id,
        dealershipId: state.dealershipId,
        currentStep: state.currentStep,
        completedSteps: state.completedSteps,
        skippedSteps: state.skippedSteps,
        inventoryPathChosen: state.inventoryPathChosen ?? undefined,
        isComplete: state.isComplete,
        completedAt: state.completedAt?.toISOString() ?? undefined,
        createdAt: state.createdAt.toISOString(),
        updatedAt: state.updatedAt.toISOString(),
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}

/**
 * PATCH /api/onboarding — Update onboarding (advance step, complete/skip step, set path, or mark complete).
 * Requires admin.dealership.write. Exactly one action per request.
 */
export async function PATCH(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "admin.dealership.write");
    const body = await readSanitizedJson(request);
    const parsed = patchBodySchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        validationErrorResponse(parsed.error),
        { status: 400 }
      );
    }
    const data = parsed.data;
    let state;
    if (data.currentStep !== undefined) {
      state = await onboardingService.advanceStep(ctx.dealershipId, data.currentStep);
    } else if (data.completeStep !== undefined) {
      state = await onboardingService.completeStep(ctx.dealershipId, data.completeStep);
    } else if (data.skipStep !== undefined) {
      state = await onboardingService.skipStep(ctx.dealershipId, data.skipStep);
    } else if (data.inventoryPathChosen !== undefined) {
      state = await onboardingService.setInventoryPathChosen(
        ctx.dealershipId,
        data.inventoryPathChosen
      );
    } else if (data.markComplete === true) {
      state = await onboardingService.markOnboardingComplete(ctx.dealershipId);
    } else {
      state = await onboardingService.getOrCreateState(ctx.dealershipId);
    }
    return jsonResponse({
      onboarding: {
        id: state.id,
        dealershipId: state.dealershipId,
        currentStep: state.currentStep,
        completedSteps: state.completedSteps,
        skippedSteps: state.skippedSteps,
        inventoryPathChosen: state.inventoryPathChosen ?? undefined,
        isComplete: state.isComplete,
        completedAt: state.completedAt?.toISOString() ?? undefined,
        createdAt: state.createdAt.toISOString(),
        updatedAt: state.updatedAt.toISOString(),
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
