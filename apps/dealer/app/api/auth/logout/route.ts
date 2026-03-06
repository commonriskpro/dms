import { createClient } from "@/lib/supabase/server";
import { clearActiveDealershipCookie } from "@/lib/tenant";
import { handleApiError } from "@/lib/api/handler";

export async function POST() {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
    await clearActiveDealershipCookie();
    return new Response(null, { status: 204 });
  } catch (e) {
    return handleApiError(e);
  }
}
