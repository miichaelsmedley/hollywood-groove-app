import { useEffect, useMemo, useState } from 'react';
import { onValue, ref } from 'firebase/database';
import { db } from '../lib/firebase';
import { LeaderboardEntry, ShowLeaderboard } from '../types/firebaseContract';

interface LeaderboardState {
  entries: LeaderboardEntry[];
  updatedAt?: number;
  isLoading: boolean;
  error: string | null;
}

export function useLeaderboard(showId: string | null, currentUserId?: string | null) {
  const [state, setState] = useState<LeaderboardState>({
    entries: [],
    updatedAt: undefined,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    if (!showId) {
      setState({ entries: [], updatedAt: undefined, isLoading: false, error: null });
      return;
    }

    setState((current) => ({ ...current, isLoading: true, error: null }));

    const leaderboardRef = ref(db, `shows/${showId}/leaderboard`);
    const unsubscribe = onValue(
      leaderboardRef,
      (snapshot) => {
        const payload = snapshot.val() as ShowLeaderboard | null;
        const entries = Array.isArray(payload?.top) ? payload?.top ?? [] : [];
        const sorted = [...entries].sort((a, b) => b.totalScore - a.totalScore);

        setState({
          entries: sorted,
          updatedAt: payload?.updatedAt,
          isLoading: false,
          error: null,
        });
      },
      (err) => {
        setState({
          entries: [],
          updatedAt: undefined,
          isLoading: false,
          error: err.message,
        });
      }
    );

    return () => unsubscribe();
  }, [showId]);

  const currentUserRank = useMemo(() => {
    if (!currentUserId) return null;
    const index = state.entries.findIndex((entry) => entry.uid === currentUserId);
    return index >= 0 ? index + 1 : null;
  }, [currentUserId, state.entries]);

  return {
    ...state,
    currentUserRank,
  };
}
