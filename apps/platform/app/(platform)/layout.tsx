import { getPlatformUserOrNull } from "@/lib/platform-auth";
import { PlatformShell } from "./platform-shell";
import { ToastProvider } from "@/components/toast";
import { PlatformAuthProvider } from "@/lib/platform-auth-context";
import { PlatformAuthRedirect } from "@/components/platform-auth-redirect";
import { ForbiddenOrBootstrap } from "@/components/forbidden-or-bootstrap";

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const result = await getPlatformUserOrNull();

  if (result && "forbidden" in result && result.forbidden) {
    return <ForbiddenOrBootstrap>{children}</ForbiddenOrBootstrap>;
  }

  const user = result && !("forbidden" in result) ? result : null;

  if (!user) {
    return (
      <PlatformAuthProvider userId={null} role={null}>
        <PlatformAuthRedirect redirectTo="/platform/login">{children}</PlatformAuthRedirect>
      </PlatformAuthProvider>
    );
  }

  return (
    <PlatformAuthProvider userId={user.userId} role={user.role}>
      <ToastProvider>
        <PlatformShell role={user.role} userId={user.userId}>
          {children}
        </PlatformShell>
      </ToastProvider>
    </PlatformAuthProvider>
  );
}
