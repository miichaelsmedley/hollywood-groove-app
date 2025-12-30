import { useEffect, useState } from 'react';
import { onValue, ref } from 'firebase/database';
import { db, rtdbPath } from '../lib/firebase';
import { AllTimeLeaderboard, AllTimeLeaderboardEntry } from '../types/firebaseContract';

interface AllTimeLeaderboardState {
  entries: AllTimeLeaderboardEntry[];
  updatedAt?: number;
  isLoading: boolean;
  error: string | null;
}

export function useAllTimeLeaderboard() {
  const [state, setState] = useState<AllTimeLeaderboardState>({
    entries: [],
    updatedAt: undefined,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    const leaderboardRef = ref(db, rtdbPath('leaderboards/all_time'));
    const unsubscribe = onValue(
      leaderboardRef,
      (snapshot) => {
        const payload = snapshot.val() as AllTimeLeaderboard | null;
        const entries = Array.isArray(payload?.top) ? payload?.top ?? [] : [];
        const sorted = [...entries].sort((a, b) => b.stars - a.stars);

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
  }, []);

  return state;
}
