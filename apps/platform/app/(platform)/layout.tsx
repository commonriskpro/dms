import { getPlatformUserOrNull } from "@/lib/platform-auth";
import { getPlatformAuthDebug } from "@/lib/env";
import { logger } from "@/lib/logger";
import { PlatformShell } from "./platform-shell";
import { ToastProvider } from "@/components/toast";
import { PlatformAuthProvider } from "@/lib/platform-auth-context";
import { PlatformAuthRedirect } from "@/components/platform-auth-redirect";
import { ForbiddenOrBootstrap } from "@/components/forbidden-or-bootstrap";

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const result = await getPlatformUserOrNull();
  const debug = getPlatformAuthDebug();
  const hasUser = result !== null;
  const platformUserFound = hasUser && typeof result === "object" && !("forbidden" in result);

  if (result && "forbidden" in result && result.forbidden) {
    if (debug) {
      logger.info("auth_debug", {
        step: "layout_redirect",
        reason: "forbidden",
        hasUser: true,
        platformUserFound: false,
      });
    }
    return <ForbiddenOrBootstrap>{children}</ForbiddenOrBootstrap>;
  }

  const user = result && !("forbidden" in result) ? result : null;

  if (!user) {
    if (debug) {
      logger.info("auth_debug", {
        step: "layout_redirect",
        reason: "unauthenticated",
        hasUser: false,
        platformUserFound: false,
      });
    }
    return (
      <PlatformAuthProvider userId={null} role={null}>
        <PlatformAuthRedirect redirectTo="/platform/login?reason=unauthenticated">{children}</PlatformAuthRedirect>
      </PlatformAuthProvider>
    );
  }

  return (
    <PlatformAuthProvider userId={user.userId} role={user.role} emailVerified={user.emailVerified !== false}>
      <ToastProvider>
        <PlatformShell role={user.role} userId={user.userId} emailVerified={user.emailVerified !== false}>
          {children}
        </PlatformShell>
      </ToastProvider>
    </PlatformAuthProvider>
  );
}
