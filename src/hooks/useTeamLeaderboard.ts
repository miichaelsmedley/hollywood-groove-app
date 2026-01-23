/**
 * useTeamLeaderboard Hook
 *
 * Real-time listener for team leaderboard during shows.
 */

import { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../lib/firebase';
import { getShowPath, getTestShowPath } from '../lib/mode';
import type { TeamLeaderboardEntry, TeamLeaderboard } from '../types/firebaseContract';

export interface UseTeamLeaderboardResult {
  entries: TeamLeaderboardEntry[];
  loading: boolean;
  error: Error | null;
  updatedAt: number | null;
}

export function useTeamLeaderboard(
  showId: string | null,
  options?: { isTestShow?: boolean }
): UseTeamLeaderboardResult {
  const [entries, setEntries] = useState<TeamLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  const isTestShow = options?.isTestShow ?? false;

  useEffect(() => {
    if (!showId) {
      setEntries([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Use test or production path
    const basePath = isTestShow
      ? getTestShowPath(showId, 'team_leaderboard')
      : getShowPath(showId, 'team_leaderboard');

    const leaderboardRef = ref(db, basePath);

    const unsubscribe = onValue(
      leaderboardRef,
      (snapshot) => {
        setLoading(false);
        if (snapshot.exists()) {
          const data = snapshot.val() as TeamLeaderboard;
          setEntries(data.top || []);
          setUpdatedAt(data.updated_at || null);
        } else {
          setEntries([]);
          setUpdatedAt(null);
        }
        setError(null);
      },
      (err) => {
        console.error('Failed to load team leaderboard:', err);
        setLoading(false);
        setError(err);
        setEntries([]);
      }
    );

    return () => unsubscribe();
  }, [showId, isTestShow]);

  return {
    entries,
    loading,
    error,
    updatedAt,
  };
}

/**
 * Get a specific team's score for a show
 */
export function useTeamShowScore(
  showId: string | null,
  teamId: string | null,
  options?: { isTestShow?: boolean }
) {
  const [score, setScore] = useState<{
    combined_score: number;
    member_scores: Record<string, { display_name: string; score: number }>;
    contributing_members: string[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const isTestShow = options?.isTestShow ?? false;

  useEffect(() => {
    if (!showId || !teamId) {
      setScore(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    const basePath = isTestShow
      ? getTestShowPath(showId, `team_scores/${teamId}`)
      : getShowPath(showId, `team_scores/${teamId}`);

    const scoreRef = ref(db, basePath);

    const unsubscribe = onValue(
      scoreRef,
      (snapshot) => {
        setLoading(false);
        if (snapshot.exists()) {
          const data = snapshot.val();
          setScore({
            combined_score: data.combined_score || 0,
            member_scores: data.member_scores || {},
            contributing_members: data.contributing_members || [],
          });
        } else {
          setScore(null);
        }
      },
      (err) => {
        console.error('Failed to load team score:', err);
        setLoading(false);
        setScore(null);
      }
    );

    return () => unsubscribe();
  }, [showId, teamId, isTestShow]);

  return { score, loading };
}
