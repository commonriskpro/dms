import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Clears Supabase session and redirects to /platform/login. Used by "Sign out" in platform shell. */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    (request.nextUrl?.origin ?? "http://localhost:3001");
  return NextResponse.redirect(new URL("/platform/login", base), 302);
}
