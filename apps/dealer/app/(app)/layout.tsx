import { AppShell } from "@/components/app-shell";
import { CommandPalette } from "@/components/command-palette/CommandPalette";
import { ConfirmDialogProvider } from "@/components/ui/confirm-dialog";
import { ToastProvider } from "@/components/ui/toast-provider";

export default function AppLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <ToastProvider>
      <ConfirmDialogProvider>
        <AppShell>{children}</AppShell>
        {modal}
        <CommandPalette />
      </ConfirmDialogProvider>
    </ToastProvider>
  );
}
