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
  permissions?: string[];
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
      {
        label: "Inventory",
        href: "/inventory",
        icon: Car,
        permissions: ["inventory.read"],
        children: [
          { label: "Inventory List", href: "/inventory/list" },
          {
            label: "Acquisition",
            href: "/inventory/acquisition",
            permissions: ["inventory.acquisition.read"],
          },
          {
            label: "Appraisals",
            href: "/inventory/appraisals",
            permissions: ["inventory.appraisals.read"],
          },
        ],
      },
      {
        label: "Customers",
        href: "/customers",
        icon: Users,
        permissions: ["customers.read"],
        children: [
          { label: "Customer List", href: "/customers/list" },
        ],
      },
      {
        label: "CRM",
        href: "/crm",
        icon: Megaphone,
        permissions: ["crm.read"],
        children: [
          { label: "Command Center", href: "/crm" },
          { label: "Pipeline", href: "/crm/opportunities?view=board" },
          { label: "Inbox", href: "/crm/inbox" },
          { label: "Automation", href: "/crm/automations" },
          { label: "Jobs", href: "/crm/jobs" },
        ],
      },
      { label: "Deals", href: "/deals", icon: Handshake, permissions: ["deals.read"] },
      { label: "Reports", href: "/reports", icon: BarChart3, permissions: ["reports.read"] },
    ],
  },
  {
    label: "Queues",
    items: [
      { label: "Title & DMV", href: "/deals/title", icon: FileText, permissions: ["deals.read"] },
      { label: "Delivery & Funding", href: "/deals/delivery", icon: Workflow, permissions: ["deals.read"] },
      { label: "Tasks", href: "/crm/jobs", icon: CheckCircle, permissions: ["crm.read"] },
    ],
  },
  {
    label: "Intelligence",
    items: [
      {
        label: "Intelligence",
        href: "/inventory/dashboard",
        icon: ScanLine,
        permissions: ["inventory.read"],
      },
    ],
  },
  {
    label: "Admin",
    items: [
      { label: "Integrations", href: "/lenders", icon: PlusCircle, permissions: ["finance.read", "finance.submissions.read"] },
    ],
  },
];
