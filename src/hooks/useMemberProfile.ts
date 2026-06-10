import { auth } from '../lib/firebase';
import { MemberProfile } from '../types/firebaseContract';
import { useRtdbValue } from './useRtdbValue';

interface MemberProfileState {
  profile: MemberProfile | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook to fetch the current user's member profile from /members/{uid}.
 * This includes their persistent stars, tier, and engagement history.
 */
export function useMemberProfile() {
  const uid = auth.currentUser?.uid;
  const { value, loading, error } =
    useRtdbValue<MemberProfile>(uid ? `members/${uid}` : null);

  return {
    profile: value,
    isLoading: loading,
    error: error?.message ?? null,
  } satisfies MemberProfileState;
}
