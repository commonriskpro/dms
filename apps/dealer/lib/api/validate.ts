import { z, ZodSchema } from "zod";
import { errorResponse } from "./errors";

export function validateQuery<T>(schema: ZodSchema<T>, query: unknown): T {
  return schema.parse(query);
}

export function validateBody<T>(schema: ZodSchema<T>, body: unknown): T {
  return schema.parse(body);
}

export function validateParams<T>(schema: ZodSchema<T>, params: unknown): T {
  return schema.parse(params);
}

export function validationErrorResponse(issues: z.ZodIssue[]): { error: { code: string; message: string; details?: unknown } } {
  return errorResponse(
    "VALIDATION_ERROR",
    "Validation failed",
    { issues: issues.map((i) => ({ path: i.path, message: i.message })) }
  );
}
