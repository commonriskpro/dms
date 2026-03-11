import { NextRequest } from "next/server";

/**
 * Converts URLSearchParams to a plain object for zod schema parsing.
 * Mirrors existing Object.fromEntries(request.nextUrl.searchParams) behavior.
 */
export function getQueryObject(request: NextRequest): Record<string, string> {
  return Object.fromEntries(request.nextUrl.searchParams);
}

