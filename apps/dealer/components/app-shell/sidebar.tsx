import { AppSidebar } from "@/components/ui-system/navigation";

type SidebarProps = {
  collapsed?: boolean;
  onToggle?: () => void;
};

export function Sidebar({ collapsed = false, onToggle }: SidebarProps) {
  return <AppSidebar collapsed={collapsed} onToggle={onToggle} />;
}
