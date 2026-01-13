import { useEffect, useMemo, useState } from 'react';
import { onValue, ref } from 'firebase/database';
import { db } from '../lib/firebase';
import { LeaderboardEntry, ShowLeaderboard } from '../types/firebaseContract';
import { getShowPath, getTestShowPath } from '../lib/mode';

interface LeaderboardState {
  entries: LeaderboardEntry[];
  updatedAt?: number;
  isLoading: boolean;
  error: string | null;
}

interface UseLeaderboardOptions {
  isTestShow?: boolean;
}

export function useLeaderboard(
  showId: string | null,
  currentUserId?: string | null,
  options?: UseLeaderboardOptions
) {
  const isTestShow = options?.isTestShow ?? false;

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

    const path = isTestShow
      ? getTestShowPath(showId, 'leaderboard')
      : getShowPath(showId, 'leaderboard');
    const leaderboardRef = ref(db, path);
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
  }, [showId, isTestShow]);

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
