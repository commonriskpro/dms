/** Customer list item from GET /api/customers */
export interface CustomerListItem {
  id: string;
  name: string;
  status: string;
  leadSource: string | null;
  assignedTo: string | null;
  assignedToProfile: { id: string; fullName: string | null; email: string } | null;
  primaryPhone: string | null;
  primaryEmail: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Customer detail from GET /api/customers/[id] */
export interface CustomerDetail {
  id: string;
  dealershipId: string;
  name: string;
  leadSource: string | null;
  status: string;
  assignedTo: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  phones: CustomerPhone[];
  emails: CustomerEmail[];
  assignedToProfile: { id: string; fullName: string | null; email: string } | null;
}

export interface CustomerPhone {
  id: string;
  kind: string | null;
  value: string;
  isPrimary: boolean;
}

export interface CustomerEmail {
  id: string;
  kind: string | null;
  value: string;
  isPrimary: boolean;
}

export interface CustomersListResponse {
  data: CustomerListItem[];
  meta: { total: number; limit: number; offset: number };
}

export type CustomerStatus = "LEAD" | "ACTIVE" | "SOLD" | "INACTIVE";

export const CUSTOMER_STATUS_OPTIONS: { value: CustomerStatus; label: string }[] = [
  { value: "LEAD", label: "Lead" },
  { value: "ACTIVE", label: "Active" },
  { value: "SOLD", label: "Sold" },
  { value: "INACTIVE", label: "Inactive" },
];

/** Create/update body: phones/emails without id for create */
export interface CustomerPhoneInput {
  kind?: string | null;
  value: string;
  isPrimary?: boolean;
}

export interface CustomerEmailInput {
  kind?: string | null;
  value: string;
  isPrimary?: boolean;
}

/** Note from GET /api/customers/[id]/notes */
export interface CustomerNote {
  id: string;
  body: string;
  createdAt: string;
  createdBy: string;
  createdByProfile: { id: string; fullName: string | null; email: string } | null;
}

export interface NotesListResponse {
  data: CustomerNote[];
  meta: { total: number; limit: number; offset: number };
}

/** Task from GET /api/customers/[id]/tasks */
export interface CustomerTask {
  id: string;
  title: string;
  description: string | null;
  dueAt: string | null;
  completedAt: string | null;
  completedBy: string | null;
  createdAt: string;
  createdByProfile: { id: string; fullName: string | null; email: string } | null;
  completedByProfile: { id: string; fullName: string | null; email: string } | null;
}

export interface TasksListResponse {
  data: CustomerTask[];
  meta: { total: number; limit: number; offset: number };
}

/** Activity from GET /api/customers/[id]/activity */
export interface CustomerActivityItem {
  id: string;
  activityType: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actor: { id: string; fullName: string | null; email: string } | null;
}

export interface ActivityListResponse {
  data: CustomerActivityItem[];
  meta: { total: number; limit: number; offset: number };
}

/** API error shape for toasts */
export interface ApiErrorPayload {
  error?: { code?: string; message?: string; details?: unknown };
}
