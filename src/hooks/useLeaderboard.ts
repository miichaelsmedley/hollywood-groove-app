import { useMemo } from 'react';
import { LeaderboardEntry, ShowLeaderboard } from '../types/firebaseContract';
import { getShowPath, getTestShowPath } from '../lib/mode';
import { useRtdbValue } from './useRtdbValue';

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
  const path = showId
    ? isTestShow
      ? getTestShowPath(showId, 'leaderboard')
      : getShowPath(showId, 'leaderboard')
    : null;
  const { value: payload, loading, error } =
    useRtdbValue<ShowLeaderboard>(path);

  const state = useMemo<LeaderboardState>(() => {
    const entries = Array.isArray(payload?.top) ? payload?.top ?? [] : [];
    const sorted = [...entries].sort((a, b) => b.totalScore - a.totalScore);
    return {
      entries: sorted,
      updatedAt: payload?.updatedAt,
      isLoading: loading,
      error: error?.message ?? null,
    };
  }, [error, loading, payload]);

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
