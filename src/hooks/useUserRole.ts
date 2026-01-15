import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { onValue, ref, get } from 'firebase/database';
import { db, auth } from '../lib/firebase';
import { UserRole, canViewTestShows, canScoreActivities, hasRole } from '../types/roles';
import { isAdminEmail } from '../lib/mode';

interface UserRoleState {
  roles: UserRole[];
  isLoading: boolean;
  error: string | null;
  // Computed capabilities
  isBandMember: boolean;
  isScorer: boolean;
  isAdmin: boolean;
  canViewTestShows: boolean;
  canScoreActivities: boolean;
}

/**
 * Hook to fetch and monitor the current user's roles from /members/{uid}/roles.
 * Also checks for admin status via email match.
 */
export function useUserRole(): UserRoleState {
  const [state, setState] = useState<UserRoleState>({
    roles: [],
    isLoading: true,
    error: null,
    isBandMember: false,
    isScorer: false,
    isAdmin: false,
    canViewTestShows: false,
    canScoreActivities: false,
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
          isLoading: false,
          error: null,
          isBandMember: false,
          isScorer: false,
          isAdmin: false,
          canViewTestShows: false,
          canScoreActivities: false,
        });
        return;
      }

      const uid = user.uid;
      const email = user.email;

      // Check if user is admin by email (hardcoded admin email)
      const isEmailAdmin = isAdminEmail(email);

      // Listen to member's roles in Firebase
      const memberRef = ref(db, `members/${uid}/roles`);

      rolesUnsubscribe = onValue(
        memberRef,
        async (snapshot) => {
          let userRoles: UserRole[] = [];

          // Get roles from Firebase
          const rolesData = snapshot.val();
          if (rolesData && Array.isArray(rolesData)) {
            userRoles = rolesData as UserRole[];
          }

          // Add admin role if user has admin email but not in roles array
          if (isEmailAdmin && !userRoles.includes('admin')) {
            userRoles = [...userRoles, 'admin'];
          }

          // Also check /admins/{uid} path for admin status
          if (!userRoles.includes('admin')) {
            try {
              const adminRef = ref(db, `admins/${uid}`);
              const adminSnap = await get(adminRef);
              if (adminSnap.exists()) {
                userRoles = [...userRoles, 'admin'];
              }
            } catch (e) {
              // Permission denied is expected for non-admins
              console.log('Admin check not permitted (expected for non-admins)');
            }
          }

          const isBandMember = hasRole(userRoles, 'band_member');
          const isScorer = hasRole(userRoles, 'scorer');
          const isAdmin = hasRole(userRoles, 'admin');

          setState({
            roles: userRoles,
            isLoading: false,
            error: null,
            isBandMember,
            isScorer,
            isAdmin,
            canViewTestShows: canViewTestShows(userRoles),
            canScoreActivities: canScoreActivities(userRoles),
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
