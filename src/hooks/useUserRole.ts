import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { onValue, ref } from 'firebase/database';
import { db, auth } from '../lib/firebase';
import {
  UserRole,
  canEditOrgContent as canEditOrgContentFor,
  canRequestOrgCampaign as canRequestOrgCampaignFor,
  canRunOrgShow as canRunOrgShowFor,
  canScoreActivities,
  canViewTestShows,
  hasOrgRole as hasScopedOrgRole,
  hasRole,
} from '../types/roles';
import type { OrgMembership, OrgRole } from '../types/firebaseContract';
import { readStaffClaims } from '../lib/claims';

interface UserRoleState {
  roles: UserRole[];
  orgMemberships: Record<string, OrgMembership>;
  orgRoles: Record<string, OrgRole[]>;
  isLoading: boolean;
  error: string | null;
  // Computed capabilities
  isBandMember: boolean;
  isScorer: boolean;
  isAdmin: boolean;
  isOrgOperator: boolean;
  canViewTestShows: boolean;
  canScoreActivities: boolean;
  hasOrgRole: (orgId: string, role: OrgRole) => boolean;
  canRunOrgShow: (orgId: string) => boolean;
  canEditOrgContent: (orgId: string) => boolean;
  canRequestOrgCampaign: (orgId: string) => boolean;
}

const emptyCapabilities = {
  hasOrgRole: () => false,
  canRunOrgShow: () => false,
  canEditOrgContent: () => false,
  canRequestOrgCampaign: () => false,
};

function normalizeOrgMemberships(value: unknown): Record<string, OrgMembership> {
  if (!value || typeof value !== 'object') {
    return {};
  }

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, OrgMembership>>(
    (acc, [orgId, raw]) => {
      if (!raw || typeof raw !== 'object') {
        return acc;
      }
      const record = raw as Partial<OrgMembership> & { roles?: unknown };
      const roles = Array.isArray(record.roles)
        ? record.roles.filter((role): role is OrgRole => typeof role === 'string')
        : [];
      acc[orgId] = {
        orgId: record.orgId ?? orgId,
        roles,
        status: record.status ?? 'active',
        grantedBy: record.grantedBy,
        grantedAt: record.grantedAt,
        updatedAt: record.updatedAt,
      };
      return acc;
    },
    {}
  );
}

function orgRolesFromMemberships(
  orgMemberships: Record<string, OrgMembership>
): Record<string, OrgRole[]> {
  return Object.fromEntries(
    Object.entries(orgMemberships).map(([orgId, membership]) => [orgId, membership.roles])
  );
}

/**
 * Hook to fetch and monitor the current user's roles from /members/{uid}/roles.
 * Admin authority comes from the Firebase Auth platform_admin custom claim.
 */
export function useUserRole(): UserRoleState {
  const [state, setState] = useState<UserRoleState>({
    roles: [],
    orgMemberships: {},
    orgRoles: {},
    isLoading: true,
    error: null,
    isBandMember: false,
    isScorer: false,
    isAdmin: false,
    isOrgOperator: false,
    canViewTestShows: false,
    canScoreActivities: false,
    ...emptyCapabilities,
  });

  useEffect(() => {
    let rolesUnsubscribe: (() => void) | undefined;

    // Listen to auth state changes
    const authUnsubscribe = onAuthStateChanged(auth, async (user) => {
      // Clean up previous roles listener
      if (rolesUnsubscribe) {
        rolesUnsubscribe();
        rolesUnsubscribe = undefined;
      }

      if (!user) {
        setState({
          roles: [],
          orgMemberships: {},
          orgRoles: {},
          isLoading: false,
          error: null,
          isBandMember: false,
          isScorer: false,
          isAdmin: false,
          isOrgOperator: false,
          canViewTestShows: false,
          canScoreActivities: false,
          ...emptyCapabilities,
        });
        return;
      }

      const uid = user.uid;

      let isClaimAdmin = false;
      let isClaimOrgOperator = false;
      try {
        const claims = await readStaffClaims(user);
        isClaimAdmin = claims.isPlatformAdmin;
        isClaimOrgOperator = claims.isOrgOperator;
      } catch (error) {
        console.warn('Staff claim check failed', error);
      }

      // Listen to member's global roles and org-scoped operator grants.
      const memberRef = ref(db, `members/${uid}`);

      rolesUnsubscribe = onValue(
        memberRef,
        async (snapshot) => {
          let userRoles: UserRole[] = [];
          const memberData = snapshot.val() ?? {};

          // Get roles from Firebase
          const rolesData = memberData.roles;
          if (rolesData && Array.isArray(rolesData)) {
            userRoles = rolesData as UserRole[];
          }

          if (isClaimAdmin && !userRoles.includes('admin')) {
            userRoles = [...userRoles, 'admin'];
          }

          const orgMemberships = normalizeOrgMemberships(memberData.org_roles);
          const orgRoles = orgRolesFromMemberships(orgMemberships);
          const isBandMember = hasRole(userRoles, 'band_member');
          const isScorer = hasRole(userRoles, 'scorer');
          const isAdmin = hasRole(userRoles, 'admin');
          const isPlatformAdmin = isAdmin || isClaimAdmin;
          const isOrgOperator = isClaimOrgOperator || Object.values(orgMemberships).some(
            (membership) => membership.status === 'active' && membership.roles.length > 0
          );

          setState({
            roles: userRoles,
            orgMemberships,
            orgRoles,
            isLoading: false,
            error: null,
            isBandMember,
            isScorer,
            isAdmin,
            isOrgOperator,
            canViewTestShows: canViewTestShows(userRoles),
            canScoreActivities: canScoreActivities(userRoles),
            hasOrgRole: (orgId, role) => hasScopedOrgRole(orgMemberships, orgId, role),
            canRunOrgShow: (orgId) => canRunOrgShowFor(orgMemberships, orgId, isPlatformAdmin),
            canEditOrgContent: (orgId) => canEditOrgContentFor(orgMemberships, orgId, isPlatformAdmin),
            canRequestOrgCampaign: (orgId) => canRequestOrgCampaignFor(orgMemberships, orgId, isPlatformAdmin),
          });
        },
        (err) => {
          console.error('Error fetching user roles:', err);
          setState((prev) => ({
            ...prev,
            isLoading: false,
            error: err.message,
          }));
        }
      );
    });

    return () => {
      authUnsubscribe();
      if (rolesUnsubscribe) {
        rolesUnsubscribe();
      }
    };
  }, []);

  return state;
}
