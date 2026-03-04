import { AppShell } from "@/components/app-shell";

export default function FilesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
