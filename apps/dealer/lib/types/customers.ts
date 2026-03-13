/** Customer list item from GET /api/customers or RSC list */
export interface CustomerListItem {
  id: string;
  name: string;
  isDraft: boolean;
  status: string;
  leadSource: string | null;
  assignedTo: string | null;
  assignedToProfile: { id: string; fullName: string | null; email: string } | null;
  primaryPhone: string | null;
  primaryEmail: string | null;
  createdAt: string;
  updatedAt: string;
  lastVisitAt: string | null;
  lastVisitByUserId: string | null;
}

/** Customer detail from GET /api/customers/[id] or RSC */
export interface CustomerDetail {
  id: string;
  dealershipId: string;
  name: string;
  customerClass: string | null;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  nameSuffix: string | null;
  county: string | null;
  isActiveMilitary: boolean;
  isDraft: boolean;
  gender: string | null;
  dob: string | null;
  ssnMasked: string | null;
  leadSource: string | null;
  leadType: string | null;
  leadCampaign?: string | null;
  leadMedium?: string | null;
  status: string;
  assignedTo: string | null;
  bdcRepId: string | null;
  idType: string | null;
  idState: string | null;
  idNumber: string | null;
  idIssuedDate: string | null;
  idExpirationDate: string | null;
  cashDownCents: string | null;
  isInShowroom: boolean;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  lastVisitAt: string | null;
  lastVisitByUserId: string | null;
  phones: CustomerPhone[];
  emails: CustomerEmail[];
  assignedToProfile: { id: string; fullName: string | null; email: string } | null;
  bdcRepProfile: { id: string; fullName: string | null; email: string } | null;
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

/** Timeline event from GET /api/customers/[id]/timeline */
export type TimelineEventType = "NOTE" | "CALL" | "CALLBACK" | "APPOINTMENT" | "SYSTEM";

export interface TimelineEvent {
  type: TimelineEventType;
  createdAt: string;
  createdByUserId: string | null;
  payloadJson: Record<string, unknown>;
  sourceId: string;
}

export interface TimelineListResponse {
  data: TimelineEvent[];
  meta: { total: number; limit: number; offset: number };
}

/** Callback from GET /api/customers/[id]/callbacks */
export type CustomerCallbackStatus = "SCHEDULED" | "DONE" | "CANCELLED";

export interface CustomerCallbackItem {
  id: string;
  callbackAt: string;
  status: CustomerCallbackStatus;
  reason: string | null;
  assignedToUserId: string | null;
  snoozedUntil: string | null;
  createdAt: string;
  updatedAt: string;
  assignedTo?: { id: string; fullName: string | null; email: string } | null;
}

export interface CallbacksListResponse {
  data: CustomerCallbackItem[];
  meta: { total: number; limit: number; offset: number };
}

/** API error shape for toasts */
