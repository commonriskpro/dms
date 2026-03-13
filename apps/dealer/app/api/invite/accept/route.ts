import { NextRequest } from "next/server";
import { getCurrentUser, requireUser } from "@/lib/auth";
import { handleApiError, getRequestMeta,
  readSanitizedJson,
} from "@/lib/api/handler";
import {
  checkRateLimit,
  checkRateLimitInviteAcceptPerToken,
  getClientIdentifier,
} from "@/lib/api/rate-limit";
import * as platformInviteService from "@/modules/platform-admin/service/invite";
import {
  acceptInviteBodySchema,
  acceptInviteSignupBodySchema,
} from "@/app/api/invite/schemas";
import { validatePasswordPolicy } from "@/lib/password-policy";

/** Body size limit for POST /api/invite/accept (4KB). Request body must not exceed this. */
const ACCEPT_BODY_MAX_BYTES = 4096;

/** Security headers for invite routes (no sniff; do not add headers that would break the flow). */
const INVITE_HEADERS = { "X-Content-Type-Options": "nosniff" } as const;

function inviteErrorResponse(
  body: { error: { code: string; message: string; details?: Record<string, unknown> } },
  status: number
): Response {
  return Response.json(body, { status, headers: INVITE_HEADERS });
}

/**
 * Accept invite: (1) Authenticated path — auth required, body { token }. (2) Signup path — no auth, body { token, email, password, confirmPassword?, fullName? }.
 * Same success shape. Rate limit: invite_accept per client (IP); per-token (hashed) for signup path. Token lookup by DB unique key (constant-time per row).
 */
export async function POST(request: NextRequest) {
  try {
    const clientId = getClientIdentifier(request);
    if (!checkRateLimit(clientId, "invite_accept")) {
      return inviteErrorResponse(
        { error: { code: "RATE_LIMITED", message: "Too many requests" } },
        429
      );
    }

    const contentLength = request.headers.get("content-length");
    if (contentLength) {
      const n = parseInt(contentLength, 10);
      if (!Number.isNaN(n) && n > ACCEPT_BODY_MAX_BYTES) {
        return inviteErrorResponse(
          { error: { code: "PAYLOAD_TOO_LARGE", message: "Request body too large" } },
          413
        );
      }
    }

    const body = (await readSanitizedJson(request)) as Record<string, unknown>;
    const hasSignupFields =
      typeof body?.email === "string" && typeof body?.password === "string";
    const user = await getCurrentUser();

    if (user && !hasSignupFields) {
      const { token } = acceptInviteBodySchema.parse(body);
      const authUser = await requireUser();
      const meta = getRequestMeta(request);
      const result = await platformInviteService.acceptInvite(
        {
          token,
          actorUserId: authUser.userId,
          actorEmail: authUser.email,
        },
        meta
      );
      return Response.json({ data: result }, { status: 200, headers: INVITE_HEADERS });
    }

    if (!user && hasSignupFields) {
      const parsed = acceptInviteSignupBodySchema.safeParse(body);
      if (!parsed.success) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of parsed.error.issues) {
          const path = issue.path[0];
          if (typeof path === "string") fieldErrors[path] = issue.message;
        }
        return inviteErrorResponse(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "Validation failed",
              details: { fieldErrors },
            },
          },
          400
        );
      }
      const { token, email, password, confirmPassword, fullName } = parsed.data;
      if (confirmPassword !== undefined && confirmPassword !== password) {
        return inviteErrorResponse(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "Passwords do not match",
              details: { fieldErrors: { password: "Passwords do not match" } },
            },
          },
          400
        );
      }
      const passwordResult = validatePasswordPolicy(password);
      if (!passwordResult.valid) {
        return inviteErrorResponse(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: passwordResult.message ?? "Invalid password",
              details: { fieldErrors: { password: passwordResult.message } },
            },
          },
          400
        );
      }
      if (!checkRateLimitInviteAcceptPerToken(token)) {
        return inviteErrorResponse(
          { error: { code: "RATE_LIMITED", message: "Too many attempts for this invite" } },
          429
        );
      }
      const meta = getRequestMeta(request);
      const result = await platformInviteService.acceptInviteWithSignup(
        { token, email, password, fullName: fullName ?? null },
        meta
      );
      return Response.json({ data: result }, { status: 200, headers: INVITE_HEADERS });
    }

    if (user && hasSignupFields) {
      const { token } = acceptInviteBodySchema.parse(body);
      const authUser = await requireUser();
      const meta = getRequestMeta(request);
      const result = await platformInviteService.acceptInvite(
        {
          token,
          actorUserId: authUser.userId,
          actorEmail: authUser.email,
        },
        meta
      );
      return Response.json({ data: result }, { status: 200, headers: INVITE_HEADERS });
    }

    return inviteErrorResponse(
      { error: { code: "UNAUTHORIZED", message: "Sign in or provide email and password to accept" } },
      401
    );
  } catch (e) {
    const res = handleApiError(e);
    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: new Headers({ ...Object.fromEntries(res.headers.entries()), ...INVITE_HEADERS }),
    });
  }
}
