import { useMemo } from 'react';
import { ShowLeaderboard } from '../types/firebaseContract';
import { getShowPath, getTestShowPath } from '../lib/mode';
import { useRtdbValue } from './useRtdbValue';

interface UseSetLeaderboardOptions {
  isTestShow?: boolean;
}

export function useSetLeaderboard(
  showId: string | null,
  setNumber: number | null | undefined,
  currentUserId?: string | null,
  options?: UseSetLeaderboardOptions
) {
  const isTestShow = options?.isTestShow ?? false;
  const path = showId && setNumber
    ? isTestShow
      ? getTestShowPath(showId, `set_leaderboards/${setNumber}`)
      : getShowPath(showId, `set_leaderboards/${setNumber}`)
    : null;
  const { value: payload, loading, error } = useRtdbValue<ShowLeaderboard>(path);

  const entries = useMemo(() => {
    const top = Array.isArray(payload?.top) ? payload?.top ?? [] : [];
    return [...top].sort((a, b) => b.totalScore - a.totalScore);
  }, [payload]);

  const currentUserRank = useMemo(() => {
    if (!currentUserId) return null;
    const index = entries.findIndex((entry) => entry.uid === currentUserId);
    return index >= 0 ? index + 1 : null;
  }, [currentUserId, entries]);

  return {
    entries,
    updatedAt: payload?.updatedAt,
    isLoading: loading,
    error: error?.message ?? null,
    currentUserRank,
  };
}
