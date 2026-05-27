import type { User } from 'firebase/auth';

/**
 * Parsed Firebase Auth custom claims for ticketing / admin roles.
 *
 * Single source of truth for which claim keys exist and what they grant.
 * Claims are set server-side (setAdminClaim / grantVenueStaff); the client
 * reads them only to drive UX gating — every privileged callable re-checks
 * the claim server-side regardless.
 */
export interface StaffClaims {
  isPlatformAdmin: boolean;
  isVenueManager: boolean;
  isDoorStaff: boolean;
  isEventAdmin: boolean;
  isOrgOwner: boolean;
  isOrgOperator: boolean;
  /** Can open the door scanner at /scan. */
  canScanTickets: boolean;
  /** Holds any elevated staff/admin claim. */
  hasStaffAccess: boolean;
}

export const EMPTY_STAFF_CLAIMS: StaffClaims = {
  isPlatformAdmin: false,
  isVenueManager: false,
  isDoorStaff: false,
  isEventAdmin: false,
  isOrgOwner: false,
  isOrgOperator: false,
  canScanTickets: false,
  hasStaffAccess: false,
};

/**
 * Parse a raw Firebase ID-token `claims` object into staff role flags.
 * Pure — no I/O — so it is trivially unit-testable.
 */
export function parseStaffClaims(
  claims: Record<string, unknown> | null | undefined
): StaffClaims {
  if (!claims) return { ...EMPTY_STAFF_CLAIMS };
  const isPlatformAdmin = claims.platform_admin === true;
  const isVenueManager = claims.venue_manager === true;
  const isDoorStaff = claims.door_staff === true;
  const isEventAdmin = claims.event_admin === true;
  const isOrgOwner = claims.org_owner === true;
  const isOrgOperator = claims.org_operator === true;
  return {
    isPlatformAdmin,
    isVenueManager,
    isDoorStaff,
    isEventAdmin,
    isOrgOwner,
    isOrgOperator,
    canScanTickets: isPlatformAdmin || isVenueManager || isDoorStaff,
    hasStaffAccess:
      isPlatformAdmin || isVenueManager || isDoorStaff || isEventAdmin || isOrgOperator,
  };
}

/**
 * Read the user's current ID token and parse its staff claims. Returns the
 * empty set for a signed-out user or on any token-read failure.
 */
export async function readStaffClaims(
  user: User | null | undefined
): Promise<StaffClaims> {
  if (!user) return { ...EMPTY_STAFF_CLAIMS };
  try {
    const token = await user.getIdTokenResult();
    return parseStaffClaims(token.claims as Record<string, unknown>);
  } catch (error) {
    console.warn('readStaffClaims: failed to read ID token claims', error);
    return { ...EMPTY_STAFF_CLAIMS };
  }
}

/** Convenience: does the user currently hold the platform_admin claim? */
export async function hasPlatformAdminClaim(
  user: User | null | undefined
): Promise<boolean> {
  return (await readStaffClaims(user)).isPlatformAdmin;
}
