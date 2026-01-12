import { useEffect, useState } from 'react';
import { onValue, ref, query, orderByChild, limitToLast } from 'firebase/database';
import { db } from '../lib/firebase';
import { AllTimeLeaderboardEntry } from '../types/firebaseContract';

interface AllTimeLeaderboardState {
  entries: AllTimeLeaderboardEntry[];
  updatedAt?: number;
  isLoading: boolean;
  error: string | null;
}

interface MemberRecord {
  display_name?: string;
  stars?: {
    total?: number;
    tier?: string;
  };
}

export function useAllTimeLeaderboard() {
  const [state, setState] = useState<AllTimeLeaderboardState>({
    entries: [],
    updatedAt: undefined,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    // Read directly from members and build leaderboard client-side
    // This is more reliable than waiting for Cloud Function triggers
    const membersRef = query(
      ref(db, 'members'),
      orderByChild('stars/total'),
      limitToLast(50)
    );

    const unsubscribe = onValue(
      membersRef,
      (snapshot) => {
        const membersData = snapshot.val() as Record<string, MemberRecord> | null;

        if (!membersData) {
          setState({
            entries: [],
            updatedAt: Date.now(),
            isLoading: false,
            error: null,
          });
          return;
        }

        // Transform members into leaderboard entries
        const entries: AllTimeLeaderboardEntry[] = Object.entries(membersData)
          .filter(([_, member]) => {
            const stars = member?.stars?.total ?? 0;
            return stars > 0;
          })
          .map(([memberId, member]) => ({
            member_id: memberId,
            display_name: member.display_name ?? 'Guest',
            stars: member?.stars?.total ?? 0,
            tier: member?.stars?.tier ?? null,
          }))
          .sort((a, b) => b.stars - a.stars)
          .slice(0, 50);

        setState({
          entries,
          updatedAt: Date.now(),
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
