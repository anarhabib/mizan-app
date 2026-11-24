export type InvitationStatus = "pending" | "accepted" | "expired" | "revoked";
export type MembershipStatus = "active" | "inactive";
export type InvitationDelivery = "sent" | "failed" | "not_sent";

export interface StoreOption {
  id: string;
  name: string;
}
export interface InvitationSummary {
  id: string;
  email: string;
  storeId: string;
  status: InvitationStatus;
  expiresAt: string;
}
export interface SalespersonSummary {
  userId: string;
  fullName?: string | null;
  email: string | null;
  status: MembershipStatus;
  storeIds: string[];
}
export interface MembershipDirectory {
  stores: StoreOption[];
  invitations: InvitationSummary[];
  members: SalespersonSummary[];
  nextMemberCursor?: string;
  nextInvitationCursor?: string;
}

export const invitationTokenPattern = /^[a-zA-Z0-9_-]{43}$/;

export function normalizeInvitationEmail(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const email = input.trim().toLowerCase();
  return email.length <= 254 &&
    /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(email)
    ? email
    : null;
}
