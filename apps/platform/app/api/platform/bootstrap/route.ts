import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getPlatformUserIdFromRequest } from "@/lib/platform-auth";
import { prisma } from "@/lib/db";
import { platformAuditLog } from "@/lib/audit";
import { withApiLogging } from "@/lib/api/with-api-logging";

export const dynamic = "force-dynamic";

const bootstrapBodySchema = z.object({
  secret: z.string().min(1, "secret is required"),
});

async function bootstrapPost(request: NextRequest): Promise<Response> {
  const envSecret = process.env.PLATFORM_BOOTSTRAP_SECRET;
  if (!envSecret || envSecret.length === 0) {
    return NextResponse.json(
      { error: { code: "BOOTSTRAP_DISABLED", message: "Bootstrap is not enabled" } },
      { status: 403 }
    );
  }

  let body: z.infer<typeof bootstrapBodySchema>;
  try {
    const raw = await request.json();
    body = bootstrapBodySchema.parse(raw);
  } catch {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid request body", details: "secret is required" } },
      { status: 400 }
    );
  }

  if (body.secret !== envSecret) {
    return NextResponse.json(
      { error: { code: "INVALID_SECRET", message: "Invalid bootstrap secret" } },
      { status: 403 }
    );
  }

  const userId = await getPlatformUserIdFromRequest();
  if (!userId) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  await prisma.platformUser.upsert({
    where: { id: userId },
    create: { id: userId, role: "PLATFORM_OWNER" },
    update: { role: "PLATFORM_OWNER" },
  });

  await platformAuditLog({
    actorPlatformUserId: userId,
    action: "platform.owner_bootstrap",
    targetType: "platform_user",
    targetId: userId,
  });

  return NextResponse.json({ success: true });
}

export const POST = withApiLogging(bootstrapPost);
