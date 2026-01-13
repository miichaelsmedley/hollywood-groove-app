import { useEffect, useState } from 'react';
import { onValue, ref } from 'firebase/database';
import { db, auth } from '../lib/firebase';
import { MemberProfile } from '../types/firebaseContract';

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
  const [state, setState] = useState<MemberProfileState>({
    profile: null,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setState({
        profile: null,
        isLoading: false,
        error: null,
      });
      return;
    }

    // Users can read their own member profile: /members/{uid}
    const memberRef = ref(db, `members/${uid}`);

    const unsubscribe = onValue(
      memberRef,
      (snapshot) => {
        const data = snapshot.val() as MemberProfile | null;
        setState({
          profile: data,
          isLoading: false,
          error: null,
        });
      },
      (err) => {
        setState({
          profile: null,
          isLoading: false,
          error: err.message,
        });
      }
    );

    return () => unsubscribe();
  }, []);

  return state;
}
