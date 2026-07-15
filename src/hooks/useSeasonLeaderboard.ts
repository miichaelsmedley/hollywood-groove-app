import { useMemo } from 'react';
import { SeasonLeaderboard } from '../types/firebaseContract';
import { useRtdbValue } from './useRtdbValue';

interface UseSeasonLeaderboardOptions {
  isTestShow?: boolean;
}

function rootPath(isTestShow: boolean, suffix: string) {
  return isTestShow ? `test/${suffix}` : suffix;
}

export function useCurrentSeasonId(isTestShow = false) {
  const { value, loading, error } = useRtdbValue<string>(rootPath(isTestShow, 'config/current_season'));
  const seasonId = typeof value === 'string' && value.trim() ? value.trim() : '2026';
  return {
    seasonId,
    isLoading: loading,
    error: error?.message ?? null,
  };
}

export function useSeasonLeaderboard(currentUserId?: string | null, options?: UseSeasonLeaderboardOptions) {
  const isTestShow = options?.isTestShow ?? false;
  const { seasonId, isLoading: isSeasonLoading, error: seasonError } = useCurrentSeasonId(isTestShow);
  const path = rootPath(isTestShow, `leaderboards/season/${seasonId}`);
  const { value: payload, loading, error } = useRtdbValue<SeasonLeaderboard>(path);

  const entries = useMemo(() => {
    const top = Array.isArray(payload?.top) ? payload?.top ?? [] : [];
    return [...top].sort((a, b) => b.seasonPoints - a.seasonPoints);
  }, [payload]);

  const currentUserRank = useMemo(() => {
    if (!currentUserId) return null;
    const index = entries.findIndex((entry) => entry.uid === currentUserId);
    return index >= 0 ? index + 1 : null;
  }, [currentUserId, entries]);

  return {
    seasonId,
    entries,
    updatedAt: payload?.updatedAt,
    isLoading: isSeasonLoading || loading,
    error: seasonError ?? error?.message ?? null,
    currentUserRank,
  };
}

export function useMySeasonPoints(currentUserId?: string | null, options?: UseSeasonLeaderboardOptions) {
  const isTestShow = options?.isTestShow ?? false;
  const { seasonId } = useCurrentSeasonId(isTestShow);
  const path = currentUserId
    ? rootPath(isTestShow, `members/${currentUserId}/season_points/${seasonId}`)
    : null;
  const { value, loading, error } = useRtdbValue<number>(path);
  return {
    seasonId,
    points: typeof value === 'number' ? value : 0,
    isLoading: loading,
    error: error?.message ?? null,
  };
}
