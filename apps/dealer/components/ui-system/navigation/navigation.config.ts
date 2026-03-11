import type { LucideIcon } from "@/lib/ui/icons";
import {
  LayoutDashboard,
  Car,
  Users,
  Handshake,
  Megaphone,
  FileText,
  BarChart3,
  CheckCircle,
  ScanLine,
  PlusCircle,
  Workflow,
} from "@/lib/ui/icons";

export type NavSubItemConfig = {
  label: string;
  href: string;
};

export type NavItemConfig = {
  label: string;
  href: string;
  icon: LucideIcon;
  permissions?: string[];
  showChevron?: boolean;
  /** Optional sub-menu items rendered as an expandable list below the parent. */
  children?: NavSubItemConfig[];
};

export type NavGroupConfig = {
  label: string;
  items: NavItemConfig[];
};

export const APP_NAV_GROUPS: NavGroupConfig[] = [
  {
    label: "Primary",
    items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, permissions: ["dashboard.read"] }],
  },
  {
    label: "Core",
    items: [
      { label: "Inventory", href: "/inventory", icon: Car, permissions: ["inventory.read"] },
      { label: "Customers", href: "/customers", icon: Users, permissions: ["customers.read"] },
      { label: "CRM", href: "/crm", icon: Megaphone, permissions: ["crm.read"] },
      { label: "Deals", href: "/deals", icon: Handshake, permissions: ["deals.read"] },
      { label: "Reports", href: "/reports", icon: BarChart3, permissions: ["reports.read"] },
    ],
  },
  {
    label: "Queues",
    items: [
      { label: "Inbox", href: "/crm/inbox", icon: FileText, permissions: ["crm.read", "customers.read"] },
      { label: "Title & DMV", href: "/deals/title", icon: FileText, permissions: ["deals.read"] },
      { label: "Delivery & Funding", href: "/deals/delivery", icon: Workflow, permissions: ["deals.read"] },
      { label: "Tasks", href: "/crm/jobs", icon: CheckCircle, permissions: ["crm.read"] },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { label: "Intelligence", href: "/inventory/dashboard", icon: ScanLine, permissions: ["inventory.read"] },
    ],
  },
  {
    label: "Admin",
    items: [
      { label: "Integrations", href: "/lenders", icon: PlusCircle, permissions: ["finance.read", "finance.submissions.read"] },
    ],
  },
];
