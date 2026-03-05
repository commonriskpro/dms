import { AppShell } from "@/components/app-shell";

export default function AppLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <>
      <AppShell>{children}</AppShell>
      {modal}
    </>
  );
}
