// Role definitions for Hollywood Groove
export type UserRole = 'public' | 'band_member' | 'scorer' | 'admin';

export interface RoleInfo {
  roles: UserRole[];
  roleAssignedBy?: string;
  roleAssignedAt?: number;
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
