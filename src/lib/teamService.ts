/**
 * Team Service
 *
 * Handles all team CRUD operations, join/leave functionality,
 * and team code management.
 */

import { ref, get, update, push, runTransaction } from 'firebase/database';
import { db } from './firebase';
import type {
  Team,
  TeamSettings,
  TeamMember,
  MemberTeamInfo,
  TeamCodeIndex,
} from '../types/firebaseContract';

// Default team settings
const DEFAULT_TEAM_SETTINGS: TeamSettings = {
  max_members: 8,
  top_contributors: 5,
};

// ============================================
// Team Code Generation
// ============================================

/**
 * Generate a random 6-character alphanumeric code
 * Uses uppercase letters and numbers, avoiding confusing characters (0, O, I, L, 1)
 */
export function generateTeamCode(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Check if a team code is available
 */
export async function isTeamCodeAvailable(code: string): Promise<boolean> {
  const codeRef = ref(db, `team_codes/${code.toUpperCase()}`);
  const snapshot = await get(codeRef);
  return !snapshot.exists();
}

/**
 * Check if a team name is available (case-insensitive)
 */
export async function isTeamNameAvailable(name: string): Promise<boolean> {
  const teamsRef = ref(db, 'teams');
  const snapshot = await get(teamsRef);

  if (!snapshot.exists()) return true;

  const teams = snapshot.val();
  const normalizedName = name.toLowerCase().trim();

  for (const teamData of Object.values(teams) as Team[]) {
    if (teamData.name.toLowerCase().trim() === normalizedName) {
      return false;
    }
  }

  return true;
}

// ============================================
// Team Creation
// ============================================

export interface CreateTeamResult {
  success: boolean;
  teamId?: string;
  code?: string;
  error?: string;
}

/**
 * Create a new team
 */
export async function createTeam(
  ownerId: string,
  ownerDisplayName: string,
  teamName: string,
  ownerPhotoUrl?: string,
  settings?: Partial<TeamSettings>
): Promise<CreateTeamResult> {
  // Validate team name
  const trimmedName = teamName.trim();
  if (!trimmedName || trimmedName.length < 2) {
    return { success: false, error: 'Team name must be at least 2 characters' };
  }
  if (trimmedName.length > 30) {
    return { success: false, error: 'Team name must be 30 characters or less' };
  }

  // Check if user already has a team
  const existingTeam = await getUserTeam(ownerId);
  if (existingTeam) {
    return { success: false, error: 'You are already in a team. Leave your current team first.' };
  }

  // Check if name is available
  const nameAvailable = await isTeamNameAvailable(trimmedName);
  if (!nameAvailable) {
    return { success: false, error: 'Team name is already taken' };
  }

  // Generate unique code
  let code = generateTeamCode();
  let attempts = 0;
  while (!(await isTeamCodeAvailable(code)) && attempts < 10) {
    code = generateTeamCode();
    attempts++;
  }
  if (attempts >= 10) {
    return { success: false, error: 'Failed to generate unique team code. Please try again.' };
  }

  // Create team
  const teamsRef = ref(db, 'teams');
  const newTeamRef = push(teamsRef);
  const teamId = newTeamRef.key!;
  const now = Date.now();

  const teamSettings: TeamSettings = {
    ...DEFAULT_TEAM_SETTINGS,
    ...settings,
  };

  const team: Team = {
    name: trimmedName,
    code: code,
    created_by: ownerId,
    created_at: now,
    settings: teamSettings,
    member_count: 1,
  };

  const ownerMember: TeamMember = {
    display_name: ownerDisplayName,
    joined_at: now,
    role: 'owner',
    photo_url: ownerPhotoUrl,
  };

  const memberTeamInfo: MemberTeamInfo = {
    team_id: teamId,
    team_name: trimmedName,
    joined_at: now,
    role: 'owner',
  };

  const codeIndex: TeamCodeIndex = {
    team_id: teamId,
  };

  // Write all data atomically
  const updates: Record<string, any> = {};
  updates[`teams/${teamId}`] = team;
  updates[`teams/${teamId}/members/${ownerId}`] = ownerMember;
  updates[`team_codes/${code}`] = codeIndex;
  updates[`members/${ownerId}/current_team`] = memberTeamInfo;

  try {
    await update(ref(db), updates);
    return { success: true, teamId, code };
  } catch (error) {
    console.error('Failed to create team:', error);
    return { success: false, error: 'Failed to create team. Please try again.' };
  }
}

// ============================================
// Team Joining
// ============================================

export interface JoinTeamResult {
  success: boolean;
  teamId?: string;
  teamName?: string;
  error?: string;
}

/**
 * Join an existing team using a join code
 */
export async function joinTeam(
  userId: string,
  userDisplayName: string,
  teamCode: string,
  userPhotoUrl?: string
): Promise<JoinTeamResult> {
  const normalizedCode = teamCode.toUpperCase().trim();

  // Check if user already has a team
  const existingTeam = await getUserTeam(userId);
  if (existingTeam) {
    return { success: false, error: 'You are already in a team. Leave your current team first.' };
  }

  // Look up team by code
  const codeRef = ref(db, `team_codes/${normalizedCode}`);
  const codeSnapshot = await get(codeRef);

  if (!codeSnapshot.exists()) {
    return { success: false, error: 'Invalid team code. Please check and try again.' };
  }

  const { team_id: teamId } = codeSnapshot.val() as TeamCodeIndex;

  // Get team details
  const teamRef = ref(db, `teams/${teamId}`);
  const teamSnapshot = await get(teamRef);

  if (!teamSnapshot.exists()) {
    return { success: false, error: 'Team not found. It may have been disbanded.' };
  }

  const team = teamSnapshot.val() as Team;

  // Check if team is full
  if (team.member_count >= team.settings.max_members) {
    return { success: false, error: `This team is full (max ${team.settings.max_members} members).` };
  }

  // Add member using transaction to handle race conditions
  const now = Date.now();

  const newMember: TeamMember = {
    display_name: userDisplayName,
    joined_at: now,
    role: 'member',
    photo_url: userPhotoUrl,
  };

  const memberTeamInfo: MemberTeamInfo = {
    team_id: teamId,
    team_name: team.name,
    joined_at: now,
    role: 'member',
  };

  try {
    // Use transaction to safely increment member count
    await runTransaction(ref(db, `teams/${teamId}/member_count`), (currentCount) => {
      const count = currentCount || 0;
      if (count >= team.settings.max_members) {
        // Abort transaction if team became full
        return undefined;
      }
      return count + 1;
    });

    // Write member data
    const updates: Record<string, any> = {};
    updates[`teams/${teamId}/members/${userId}`] = newMember;
    updates[`members/${userId}/current_team`] = memberTeamInfo;

    await update(ref(db), updates);

    return { success: true, teamId, teamName: team.name };
  } catch (error) {
    console.error('Failed to join team:', error);
    return { success: false, error: 'Failed to join team. Please try again.' };
  }
}

// ============================================
// Team Leaving
// ============================================

/**
 * Leave current team
 */
export async function leaveTeam(userId: string): Promise<{ success: boolean; error?: string }> {
  const currentTeam = await getUserTeam(userId);

  if (!currentTeam) {
    return { success: false, error: 'You are not in a team.' };
  }

  // Check if user is owner
  if (currentTeam.role === 'owner') {
    return {
      success: false,
      error: 'Team owners cannot leave. Transfer ownership or disband the team.'
    };
  }

  try {
    // Decrement member count
    await runTransaction(ref(db, `teams/${currentTeam.team_id}/member_count`), (currentCount) => {
      return Math.max((currentCount || 1) - 1, 0);
    });

    // Remove member data
    const updates: Record<string, any> = {};
    updates[`teams/${currentTeam.team_id}/members/${userId}`] = null;
    updates[`members/${userId}/current_team`] = null;

    await update(ref(db), updates);

    return { success: true };
  } catch (error) {
    console.error('Failed to leave team:', error);
    return { success: false, error: 'Failed to leave team. Please try again.' };
  }
}

// ============================================
// Team Disbanding
// ============================================

/**
 * Disband a team (owner only)
 */
export async function disbandTeam(
  ownerId: string,
  teamId: string
): Promise<{ success: boolean; error?: string }> {
  // Verify ownership
  const teamRef = ref(db, `teams/${teamId}`);
  const teamSnapshot = await get(teamRef);

  if (!teamSnapshot.exists()) {
    return { success: false, error: 'Team not found.' };
  }

  const team = teamSnapshot.val() as Team;

  if (team.created_by !== ownerId) {
    return { success: false, error: 'Only the team owner can disband the team.' };
  }

  // Get all members
  const membersRef = ref(db, `teams/${teamId}/members`);
  const membersSnapshot = await get(membersRef);
  const memberUids = membersSnapshot.exists() ? Object.keys(membersSnapshot.val()) : [];

  try {
    // Remove team data
    const updates: Record<string, any> = {};
    updates[`teams/${teamId}`] = null;
    updates[`team_codes/${team.code}`] = null;

    // Remove current_team from all members
    for (const uid of memberUids) {
      updates[`members/${uid}/current_team`] = null;
    }

    await update(ref(db), updates);

    return { success: true };
  } catch (error) {
    console.error('Failed to disband team:', error);
    return { success: false, error: 'Failed to disband team. Please try again.' };
  }
}

// ============================================
// Team Queries
// ============================================

/**
 * Get team by ID
 */
export async function getTeam(teamId: string): Promise<Team | null> {
  const teamRef = ref(db, `teams/${teamId}`);
  const snapshot = await get(teamRef);

  if (!snapshot.exists()) return null;

  return snapshot.val() as Team;
}

/**
 * Get team by join code
 */
export async function getTeamByCode(
  code: string
): Promise<{ teamId: string; team: Team } | null> {
  const normalizedCode = code.toUpperCase().trim();
  const codeRef = ref(db, `team_codes/${normalizedCode}`);
  const codeSnapshot = await get(codeRef);

  if (!codeSnapshot.exists()) return null;

  const { team_id: teamId } = codeSnapshot.val() as TeamCodeIndex;
  const team = await getTeam(teamId);

  if (!team) return null;

  return { teamId, team };
}

/**
 * Get all members of a team
 */
export async function getTeamMembers(teamId: string): Promise<Record<string, TeamMember>> {
  const membersRef = ref(db, `teams/${teamId}/members`);
  const snapshot = await get(membersRef);

  if (!snapshot.exists()) return {};

  return snapshot.val() as Record<string, TeamMember>;
}

/**
 * Get user's current team info
 */
export async function getUserTeam(userId: string): Promise<MemberTeamInfo | null> {
  const teamRef = ref(db, `members/${userId}/current_team`);
  const snapshot = await get(teamRef);

  if (!snapshot.exists()) return null;

  return snapshot.val() as MemberTeamInfo;
}

// ============================================
// Team Settings
// ============================================

/**
 * Update team settings (owner only)
 */
export async function updateTeamSettings(
  teamId: string,
  ownerId: string,
  settings: Partial<TeamSettings>
): Promise<{ success: boolean; error?: string }> {
  const team = await getTeam(teamId);

  if (!team) {
    return { success: false, error: 'Team not found.' };
  }

  if (team.created_by !== ownerId) {
    return { success: false, error: 'Only the team owner can update settings.' };
  }

  // Validate settings
  if (settings.max_members !== undefined) {
    if (settings.max_members < 2 || settings.max_members > 50) {
      return { success: false, error: 'Max members must be between 2 and 50.' };
    }
    if (settings.max_members < team.member_count) {
      return { success: false, error: `Cannot set max members below current count (${team.member_count}).` };
    }
  }

  if (settings.top_contributors !== undefined) {
    if (settings.top_contributors < 1 || settings.top_contributors > 20) {
      return { success: false, error: 'Top contributors must be between 1 and 20.' };
    }
  }

  try {
    const settingsRef = ref(db, `teams/${teamId}/settings`);
    await update(settingsRef, settings);
    return { success: true };
  } catch (error) {
    console.error('Failed to update team settings:', error);
    return { success: false, error: 'Failed to update settings. Please try again.' };
  }
}

/**
 * Update team name (owner only)
 */
export async function updateTeamName(
  teamId: string,
  ownerId: string,
  newName: string
): Promise<{ success: boolean; error?: string }> {
  const team = await getTeam(teamId);

  if (!team) {
    return { success: false, error: 'Team not found.' };
  }

  if (team.created_by !== ownerId) {
    return { success: false, error: 'Only the team owner can update the team name.' };
  }

  const trimmedName = newName.trim();
  if (!trimmedName || trimmedName.length < 2) {
    return { success: false, error: 'Team name must be at least 2 characters.' };
  }
  if (trimmedName.length > 30) {
    return { success: false, error: 'Team name must be 30 characters or less.' };
  }

  // Check if name is available (unless it's the same name)
  if (trimmedName.toLowerCase() !== team.name.toLowerCase()) {
    const nameAvailable = await isTeamNameAvailable(trimmedName);
    if (!nameAvailable) {
      return { success: false, error: 'Team name is already taken.' };
    }
  }

  try {
    // Update team name and all member references
    const members = await getTeamMembers(teamId);
    const memberUids = Object.keys(members);

    const updates: Record<string, any> = {};
    updates[`teams/${teamId}/name`] = trimmedName;

    for (const uid of memberUids) {
      updates[`members/${uid}/current_team/team_name`] = trimmedName;
    }

    await update(ref(db), updates);
    return { success: true };
  } catch (error) {
    console.error('Failed to update team name:', error);
    return { success: false, error: 'Failed to update name. Please try again.' };
  }
}

// ============================================
// Ownership Transfer
// ============================================

/**
 * Transfer team ownership to another member
 */
export async function transferOwnership(
  teamId: string,
  currentOwnerId: string,
  newOwnerId: string
): Promise<{ success: boolean; error?: string }> {
  const team = await getTeam(teamId);

  if (!team) {
    return { success: false, error: 'Team not found.' };
  }

  if (team.created_by !== currentOwnerId) {
    return { success: false, error: 'Only the team owner can transfer ownership.' };
  }

  if (currentOwnerId === newOwnerId) {
    return { success: false, error: 'You are already the owner.' };
  }

  // Verify new owner is a member
  const members = await getTeamMembers(teamId);
  if (!members[newOwnerId]) {
    return { success: false, error: 'New owner must be a team member.' };
  }

  try {
    const updates: Record<string, any> = {};

    // Update team created_by
    updates[`teams/${teamId}/created_by`] = newOwnerId;

    // Update roles in team members
    updates[`teams/${teamId}/members/${currentOwnerId}/role`] = 'member';
    updates[`teams/${teamId}/members/${newOwnerId}/role`] = 'owner';

    // Update roles in member profiles
    updates[`members/${currentOwnerId}/current_team/role`] = 'member';
    updates[`members/${newOwnerId}/current_team/role`] = 'owner';

    await update(ref(db), updates);
    return { success: true };
  } catch (error) {
    console.error('Failed to transfer ownership:', error);
    return { success: false, error: 'Failed to transfer ownership. Please try again.' };
  }
}

// ============================================
// Remove Member (Owner only)
// ============================================

/**
 * Remove a member from the team (owner only)
 */
export async function removeMember(
  teamId: string,
  ownerId: string,
  memberToRemoveId: string
): Promise<{ success: boolean; error?: string }> {
  const team = await getTeam(teamId);

  if (!team) {
    return { success: false, error: 'Team not found.' };
  }

  if (team.created_by !== ownerId) {
    return { success: false, error: 'Only the team owner can remove members.' };
  }

  if (memberToRemoveId === ownerId) {
    return { success: false, error: 'Cannot remove yourself. Transfer ownership or disband the team.' };
  }

  // Verify member exists
  const members = await getTeamMembers(teamId);
  if (!members[memberToRemoveId]) {
    return { success: false, error: 'Member not found in team.' };
  }

  try {
    // Decrement member count
    await runTransaction(ref(db, `teams/${teamId}/member_count`), (currentCount) => {
      return Math.max((currentCount || 1) - 1, 0);
    });

    // Remove member data
    const updates: Record<string, any> = {};
    updates[`teams/${teamId}/members/${memberToRemoveId}`] = null;
    updates[`members/${memberToRemoveId}/current_team`] = null;

    await update(ref(db), updates);

    return { success: true };
  } catch (error) {
    console.error('Failed to remove member:', error);
    return { success: false, error: 'Failed to remove member. Please try again.' };
  }
}
