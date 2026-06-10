/**
 * useTeam Hook
 *
 * Real-time listener for team details and members.
 *
 * Supports test mode: when isTestMode is true, listens to test/ paths.
 */

import { useMemo } from 'react';
import { useRtdbValue } from './useRtdbValue';
import type { Team, TeamMember } from '../types/firebaseContract';

export interface UseTeamResult {
  team: Team | null;
  members: Record<string, TeamMember>;
  membersList: Array<TeamMember & { uid: string }>;
  loading: boolean;
  error: Error | null;
}

export interface UseTeamOptions {
  isTestMode?: boolean;
}

export function useTeam(teamId: string | null, options: UseTeamOptions = {}): UseTeamResult {
  const { isTestMode = false } = options;
  const prefix = isTestMode ? 'test/' : '';
  const teamPath = teamId ? `${prefix}teams/${teamId}` : null;
  const membersPath = teamId ? `${prefix}teams/${teamId}/members` : null;
  const {
    value: rawTeam,
    loading,
    error,
  } = useRtdbValue<Team & { members?: Record<string, TeamMember> }>(teamPath);
  const { value: membersValue } =
    useRtdbValue<Record<string, TeamMember>>(membersPath);

  const team = useMemo(() => {
    if (!rawTeam) return null;
    const { members: _, ...teamData } = rawTeam;
    return teamData as Team;
  }, [rawTeam]);
  const members = membersValue ?? {};

  // Convert members object to sorted array
  const membersList = Object.entries(members)
    .map(([uid, member]) => ({ uid, ...member }))
    .sort((a, b) => {
      // Owner first, then by join date
      if (a.role === 'owner' && b.role !== 'owner') return -1;
      if (a.role !== 'owner' && b.role === 'owner') return 1;
      return a.joined_at - b.joined_at;
    });

  return {
    team,
    members,
    membersList,
    loading,
    error,
  };
}
