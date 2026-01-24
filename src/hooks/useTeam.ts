/**
 * useTeam Hook
 *
 * Real-time listener for team details and members.
 *
 * Supports test mode: when isTestMode is true, listens to test/ paths.
 */

import { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../lib/firebase';
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
  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<Record<string, TeamMember>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const prefix = isTestMode ? 'test/' : '';

  // Listen to team details
  useEffect(() => {
    if (!teamId) {
      setTeam(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const teamRef = ref(db, `${prefix}teams/${teamId}`);

    const unsubscribe = onValue(
      teamRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          // Extract team data (excluding members sub-path)
          const { members: _, ...teamData } = data;
          setTeam(teamData as Team);
        } else {
          setTeam(null);
        }
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Failed to load team:', err);
        setLoading(false);
        setError(err);
        setTeam(null);
      }
    );

    return () => unsubscribe();
  }, [teamId, prefix]);

  // Listen to team members separately
  useEffect(() => {
    if (!teamId) {
      setMembers({});
      return;
    }

    const membersRef = ref(db, `${prefix}teams/${teamId}/members`);

    const unsubscribe = onValue(
      membersRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setMembers(snapshot.val() as Record<string, TeamMember>);
        } else {
          setMembers({});
        }
      },
      (err) => {
        console.error('Failed to load team members:', err);
        setMembers({});
      }
    );

    return () => unsubscribe();
  }, [teamId, prefix]);

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
