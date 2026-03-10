import { z, ZodSchema } from "zod";
import { errorResponse } from "./errors";

/**
 * Build validation error response. Includes both issues (per-issue path/message)
 * and fieldErrors (Zod flatten) for API consumers that expect field-level errors.
 */
export function validationErrorResponse(
  err: z.ZodError | z.ZodIssue[]
): { error: { code: string; message: string; details?: unknown } } {
  const issues = err instanceof z.ZodError ? err.issues : err;
  const zodErr = err instanceof z.ZodError ? err : new z.ZodError(issues);
  const fieldErrors = zodErr.flatten().fieldErrors;
  return errorResponse(
    "VALIDATION_ERROR",
    "Validation failed",
    { issues: issues.map((i) => ({ path: i.path, message: i.message })), fieldErrors }
  );
}
