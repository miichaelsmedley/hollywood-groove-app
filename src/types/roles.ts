// Role definitions for Hollywood Groove
import type { OrgMembership, OrgRole } from './firebaseContract';

export type UserRole = 'public' | 'band_member' | 'scorer' | 'admin';

export interface RoleInfo {
  roles: UserRole[];
  roleAssignedBy?: string;
  roleAssignedAt?: number;
  orgMemberships?: Record<string, OrgMembership>;
}

/**
 * Check if user has a specific role.
 */
export function hasRole(roles: UserRole[], role: UserRole): boolean {
  return roles.includes(role);
}

/**
 * Check if user can view test shows (band_member or admin).
 */
export function canViewTestShows(roles: UserRole[]): boolean {
  return hasRole(roles, 'admin') || hasRole(roles, 'band_member');
}

/**
 * Check if user can score activities (scorer or admin).
 */
export function canScoreActivities(roles: UserRole[]): boolean {
  return hasRole(roles, 'admin') || hasRole(roles, 'scorer');
}

/**
 * Check whether a user has a scoped organization role.
 */
export function hasOrgRole(
  orgMemberships: Record<string, OrgMembership> | undefined,
  orgId: string | undefined,
  role: OrgRole
): boolean {
  if (!orgId || !orgMemberships?.[orgId] || orgMemberships[orgId].status !== 'active') {
    return false;
  }
  return orgMemberships[orgId].roles.includes(role);
}

export function canRunOrgShow(
  orgMemberships: Record<string, OrgMembership> | undefined,
  orgId: string | undefined,
  isPlatformAdmin = false
): boolean {
  return isPlatformAdmin
    || hasOrgRole(orgMemberships, orgId, 'org_owner')
    || hasOrgRole(orgMemberships, orgId, 'show_operator');
}

export function canEditOrgContent(
  orgMemberships: Record<string, OrgMembership> | undefined,
  orgId: string | undefined,
  isPlatformAdmin = false
): boolean {
  return isPlatformAdmin
    || hasOrgRole(orgMemberships, orgId, 'org_owner')
    || hasOrgRole(orgMemberships, orgId, 'content_editor');
}

export function canRequestOrgCampaign(
  orgMemberships: Record<string, OrgMembership> | undefined,
  orgId: string | undefined,
  isPlatformAdmin = false
): boolean {
  return isPlatformAdmin
    || hasOrgRole(orgMemberships, orgId, 'org_owner')
    || hasOrgRole(orgMemberships, orgId, 'marketer');
}

/**
 * Get display text for a role.
 */
export function getRoleDisplay(role: UserRole): string {
  switch (role) {
    case 'band_member':
      return 'Band Member';
    case 'scorer':
      return 'Scorer';
    case 'admin':
      return 'Admin';
    case 'public':
      return 'Public';
    default:
      return role;
  }
}

/**
 * Get all display texts for a list of roles.
 */
export function getRolesDisplay(roles: UserRole[]): string {
  if (roles.length === 0) return 'Public';
  return roles.map(getRoleDisplay).join(', ');
}
