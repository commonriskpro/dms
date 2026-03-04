import { AppShell } from "@/components/app-shell";

export default function LendersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
