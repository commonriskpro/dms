import { NextRequest } from "next/server";

const COOKIE_NAME = "platform_user_id";
const DEV_LOGIN_ENABLED =
  process.env.NODE_ENV !== "production" &&
  process.env.PLATFORM_USE_HEADER_AUTH === "true";

export async function GET(request: NextRequest) {
  if (!DEV_LOGIN_ENABLED) {
    return new Response("Not available", { status: 404 });
  }
  const userId = request.nextUrl.searchParams.get("userId");
  if (!userId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
    return new Response("Invalid or missing userId (must be UUID)", { status: 400 });
  }
  const res = new Response(null, { status: 302, headers: { Location: "/platform/applications" } });
  res.headers.set(
    "Set-Cookie",
    `${COOKIE_NAME}=${userId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`
  );
  return res;
}
