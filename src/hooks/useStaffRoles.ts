import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase';
import {
  EMPTY_STAFF_CLAIMS,
  readStaffClaims,
  type StaffClaims,
} from '../lib/claims';

/**
 * Reactive view of the signed-in user's staff custom claims.
 *
 * Claim parsing lives in lib/claims.ts — the single source of truth for which
 * claim keys exist and what they grant. This hook only adapts it to React
 * state, re-evaluating on every auth-state change. Server callables remain
 * the real permission boundary; this drives UX only.
 */
export interface StaffRolesState extends StaffClaims {
  /** True until the first ID-token read resolves. */
  loading: boolean;
}

export function useStaffRoles(): StaffRolesState {
  const [state, setState] = useState<StaffRolesState>({
    ...EMPTY_STAFF_CLAIMS,
    loading: true,
  });

  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      const claims = await readStaffClaims(user);
      if (active) setState({ ...claims, loading: false });
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return state;
}
