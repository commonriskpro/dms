import { AppShell } from "@/components/app-shell";

export default function DealsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
