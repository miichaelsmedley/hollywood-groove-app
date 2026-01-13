import { useEffect, useState } from 'react';
import { onValue, ref } from 'firebase/database';
import { db } from '../lib/firebase';
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
    // Read from the public leaderboards path (auth != null can read)
    // This is populated by Cloud Functions from /members data
    const leaderboardRef = ref(db, 'leaderboards/all_time');

    const unsubscribe = onValue(
      leaderboardRef,
      (snapshot) => {
        const data = snapshot.val() as AllTimeLeaderboard | null;

        if (!data || !data.top) {
          setState({
            entries: [],
            updatedAt: data?.updatedAt,
            isLoading: false,
            error: null,
          });
          return;
        }

        // Sort by stars descending (should already be sorted, but ensure)
        const entries = [...data.top].sort((a, b) => b.stars - a.stars);

        setState({
          entries,
          updatedAt: data.updatedAt,
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
