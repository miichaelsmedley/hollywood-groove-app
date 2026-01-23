/**
 * useUserTeam Hook
 *
 * Real-time listener for the current user's team membership.
 * Returns null if user is not in a team.
 */

import { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../lib/firebase';
import { useUser } from '../contexts/UserContext';
import type { MemberTeamInfo } from '../types/firebaseContract';

export interface UseUserTeamResult {
  team: MemberTeamInfo | null;
  loading: boolean;
  error: Error | null;
  isInTeam: boolean;
  isOwner: boolean;
}

export function useUserTeam(): UseUserTeamResult {
  const { userProfile } = useUser();
  const [team, setTeam] = useState<MemberTeamInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!userProfile?.uid) {
      setTeam(null);
      setLoading(false);
      return;
    }

    const teamRef = ref(db, `members/${userProfile.uid}/current_team`);

    const unsubscribe = onValue(
      teamRef,
      (snapshot) => {
        setLoading(false);
        if (snapshot.exists()) {
          setTeam(snapshot.val() as MemberTeamInfo);
        } else {
          setTeam(null);
        }
        setError(null);
      },
      (err) => {
        console.error('Failed to load user team:', err);
        setLoading(false);
        setError(err);
        setTeam(null);
      }
    );

    return () => unsubscribe();
  }, [userProfile?.uid]);

  return {
    team,
    loading,
    error,
    isInTeam: team !== null,
    isOwner: team?.role === 'owner',
  };
}
