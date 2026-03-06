export interface MembershipUser {
  id: string;
  email: string;
  fullName?: string | null;
}

export interface MembershipRole {
  id: string;
  name: string;
}

export interface MembershipResponse {
  id: string;
  dealershipId: string;
  userId: string;
  roleId: string;
  user: MembershipUser;
  role: MembershipRole;
  invitedAt: string | null;
  joinedAt: string | null;
  disabledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MembershipsListResponse {
  data: MembershipResponse[];
  meta: { total: number; limit: number; offset: number };
}
