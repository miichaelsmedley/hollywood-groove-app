import { useState, useEffect } from 'react';
import { Link, useParams, useSearchParams, useNavigate } from 'react-router-dom';
import {
  Users,
  UserPlus,
  ArrowLeft,
  Trophy,
  Star,
  Settings,
  LogOut,
  Trash2,
  Check,
  AlertTriangle,
  Camera,
  X,
  FlaskConical,
} from 'lucide-react';
import { Scanner } from '@yudiel/react-qr-scanner';
import { useUser } from '../contexts/UserContext';
import { useUserTeam } from '../hooks/useUserTeam';
import { useTeam } from '../hooks/useTeam';
import TeamCard from '../components/teams/TeamCard';
import TeamQRCode from '../components/teams/TeamQRCode';
import TeamMemberList from '../components/teams/TeamMemberList';
import { TeamCardPreview } from '../components/teams/TeamCard';
import {
  createTeam,
  joinTeam,
  leaveTeam,
  disbandTeam,
  getTeamByCode,
  updateTeamSettings,
  updateTeamName,
  transferOwnership,
  removeMember,
} from '../lib/teamService';
import type { Team } from '../types/firebaseContract';

/**
 * Hook to get test mode from URL params
 * Teams uses ?test=true to indicate test mode
 */
function useIsTestMode(): boolean {
  const [searchParams] = useSearchParams();
  return searchParams.get('test') === 'true';
}

/**
 * Get URL with test mode param preserved
 */
function getTestAwareUrl(path: string, isTestMode: boolean): string {
  return isTestMode ? `${path}?test=true` : path;
}

// ============================================
// Teams Hub Page
// ============================================

export function TeamsHub() {
  useUser(); // For auth context
  const isTestMode = useIsTestMode();
  const { team: userTeam, loading, isInTeam } = useUserTeam({ isTestMode });
  const { team: teamDetails } = useTeam(userTeam?.team_id || null, { isTestMode });

  if (loading) {
    return (
      <div className="mx-auto max-w-md flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // User has a team - show team card
  if (isInTeam && userTeam && teamDetails) {
    return (
      <div className="mx-auto max-w-md space-y-6">
        {isTestMode && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-300 text-sm">
            <FlaskConical className="w-4 h-4" />
            <span>Test Mode - Data isolated from production</span>
          </div>
        )}

        <section className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-cinema-100">Your Team</h1>
          <p className="text-cinema-400">Compete together at shows</p>
        </section>

        <TeamCard
          team={teamDetails}
          teamId={userTeam.team_id}
          memberInfo={userTeam}
          showQR={true}
          showActions={true}
          linkTo={getTestAwareUrl(`/teams/${userTeam.team_id}`, isTestMode)}
          isTestMode={isTestMode}
        />

        <section className="p-4 bg-cinema-50/10 rounded-xl border border-cinema-200">
          <h2 className="text-sm font-semibold text-cinema-400 mb-2">Quick Share</h2>
          <p className="text-cinema-500 text-sm">
            Share your team code <span className="font-mono font-bold text-primary">{teamDetails.code}</span> with
            friends to let them join!
          </p>
        </section>
      </div>
    );
  }

  // User has no team - show create/join options
  return (
    <div className="mx-auto max-w-md space-y-6">
      {isTestMode && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-300 text-sm">
          <FlaskConical className="w-4 h-4" />
          <span>Test Mode - Data isolated from production</span>
        </div>
      )}

      <section className="text-center space-y-2">
        <div className="w-16 h-16 mx-auto rounded-full bg-primary/20 flex items-center justify-center">
          <Users className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-cinema-100">Teams</h1>
        <p className="text-cinema-400">Compete together with friends and family</p>
      </section>

      <section className="space-y-3">
        <Link
          to={getTestAwareUrl('/teams/create', isTestMode)}
          className="block w-full rounded-xl bg-primary px-4 py-4 text-cinema font-bold shadow-glow-lg active:scale-[0.99] transition"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-lg leading-tight">Create a Team</div>
              <div className="text-sm font-semibold opacity-80">
                Start a new team and invite members
              </div>
            </div>
            <Users className="h-6 w-6" />
          </div>
        </Link>

        <Link
          to={getTestAwareUrl('/teams/join', isTestMode)}
          className="block w-full rounded-xl bg-cinema-50 border border-cinema-200 px-4 py-4 font-semibold text-cinema-900 hover:border-primary/60 transition"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-lg leading-tight">Join a Team</div>
              <div className="text-sm text-cinema-500">Enter a team code to join</div>
            </div>
            <UserPlus className="h-6 w-6 text-primary" />
          </div>
        </Link>
      </section>

      <section className="mt-8 p-4 bg-cinema-50/10 rounded-xl border border-cinema-200">
        <h2 className="text-lg font-semibold text-cinema-100 mb-2">Why Teams?</h2>
        <ul className="space-y-2 text-sm text-cinema-400">
          <li className="flex items-start gap-2">
            <Trophy className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            <span>Combine your top scores for team leaderboards</span>
          </li>
          <li className="flex items-start gap-2">
            <Star className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            <span>Earn bonus stars when your team performs well</span>
          </li>
          <li className="flex items-start gap-2">
            <Users className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            <span>Compete against other teams at shows</span>
          </li>
        </ul>
      </section>
    </div>
  );
}

// ============================================
// Create Team Page
// ============================================

export function CreateTeam() {
  const navigate = useNavigate();
  const isTestMode = useIsTestMode();
  const { userProfile } = useUser();
  const { isInTeam, loading: teamLoading } = useUserTeam({ isTestMode });

  const [teamName, setTeamName] = useState('');
  const [maxMembers, setMaxMembers] = useState(8);
  const [topContributors, setTopContributors] = useState(5);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdTeam, setCreatedTeam] = useState<{ teamId: string; code: string; name: string } | null>(null);

  // Redirect if already in a team
  useEffect(() => {
    if (!teamLoading && isInTeam) {
      navigate(getTestAwareUrl('/teams', isTestMode));
    }
  }, [teamLoading, isInTeam, navigate, isTestMode]);

  const handleCreate = async () => {
    if (!userProfile?.uid || !userProfile?.displayName) {
      setError('Please sign in to create a team');
      return;
    }

    if (!teamName.trim()) {
      setError('Please enter a team name');
      return;
    }

    setCreating(true);
    setError(null);

    const result = await createTeam(
      userProfile.uid,
      userProfile.displayName,
      teamName.trim(),
      userProfile.photoURL,
      { max_members: maxMembers, top_contributors: topContributors },
      isTestMode
    );

    setCreating(false);

    if (result.success && result.teamId && result.code) {
      setCreatedTeam({ teamId: result.teamId, code: result.code, name: teamName.trim() });
    } else {
      setError(result.error || 'Failed to create team');
    }
  };

  // Show success state with QR code
  if (createdTeam) {
    return (
      <div className="mx-auto max-w-md space-y-6">
        {isTestMode && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-300 text-sm">
            <FlaskConical className="w-4 h-4" />
            <span>Test Mode - Team created in test namespace</span>
          </div>
        )}

        <section className="text-center space-y-2">
          <div className="w-16 h-16 mx-auto rounded-full bg-green-500/20 flex items-center justify-center">
            <Check className="w-8 h-8 text-green-400" />
          </div>
          <h1 className="text-2xl font-bold text-cinema-100">Team Created!</h1>
          <p className="text-cinema-400">Share the code below to invite members</p>
        </section>

        <TeamQRCode
          teamCode={createdTeam.code}
          teamName={createdTeam.name}
          size={180}
          showCode={true}
          isTestMode={isTestMode}
        />

        <Link
          to={getTestAwareUrl(`/teams/${createdTeam.teamId}`, isTestMode)}
          className="block w-full text-center rounded-xl bg-primary px-4 py-3 text-cinema font-bold shadow-glow-lg active:scale-[0.99] transition"
        >
          Go to Team
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      {isTestMode && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-300 text-sm">
          <FlaskConical className="w-4 h-4" />
          <span>Test Mode - Team will be created in test namespace</span>
        </div>
      )}

      <Link
        to={getTestAwareUrl('/teams', isTestMode)}
        className="inline-flex items-center gap-2 text-cinema-400 hover:text-cinema-200 transition"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Teams</span>
      </Link>

      <section className="text-center space-y-2">
        <div className="w-16 h-16 mx-auto rounded-full bg-primary/20 flex items-center justify-center">
          <Users className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-cinema-100">Create a Team</h1>
        <p className="text-cinema-400">Set up your team and invite members</p>
      </section>

      <section className="space-y-4">
        {/* Team Name */}
        <div>
          <label className="block text-sm font-medium text-cinema-300 mb-2">
            Team Name
          </label>
          <input
            type="text"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder="e.g., The Smiths, Team Awesome"
            maxLength={30}
            className="w-full px-4 py-3 rounded-xl bg-cinema-50/10 border border-cinema-200 text-cinema-100 placeholder-cinema-500 focus:border-primary focus:outline-none transition"
          />
          <p className="text-xs text-cinema-500 mt-1">{teamName.length}/30 characters</p>
        </div>

        {/* Settings */}
        <div className="p-4 bg-cinema-50/10 rounded-xl border border-cinema-200 space-y-4">
          <h3 className="text-sm font-semibold text-cinema-300">Team Settings</h3>

          <div>
            <label className="block text-sm text-cinema-400 mb-2">
              Maximum Members: <span className="text-primary font-bold">{maxMembers}</span>
            </label>
            <input
              type="range"
              min="2"
              max="20"
              value={maxMembers}
              onChange={(e) => setMaxMembers(parseInt(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-xs text-cinema-500">
              <span>2</span>
              <span>20</span>
            </div>
          </div>

          <div>
            <label className="block text-sm text-cinema-400 mb-2">
              Top Scores Count: <span className="text-primary font-bold">{topContributors}</span>
            </label>
            <input
              type="range"
              min="1"
              max="10"
              value={topContributors}
              onChange={(e) => setTopContributors(parseInt(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-xs text-cinema-500">
              <span>1</span>
              <span>10</span>
            </div>
            <p className="text-xs text-cinema-500 mt-1">
              Only the top {topContributors} member scores will count towards your team total
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-sm">
            {error}
          </div>
        )}

        <button
          onClick={handleCreate}
          disabled={creating || !teamName.trim()}
          className="w-full rounded-xl bg-primary px-4 py-3 text-cinema font-bold shadow-glow-lg active:scale-[0.99] transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {creating ? 'Creating...' : 'Create Team'}
        </button>
      </section>
    </div>
  );
}

// ============================================
// Join Team Page
// ============================================

export function JoinTeam() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isTestMode = useIsTestMode();
  const { userProfile } = useUser();
  const { isInTeam, loading: teamLoading } = useUserTeam({ isTestMode });

  const [code, setCode] = useState(searchParams.get('code') || '');
  const [previewTeam, setPreviewTeam] = useState<{ teamId: string; team: Team } | null>(null);
  const [searching, setSearching] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);

  // Redirect if already in a team
  useEffect(() => {
    if (!teamLoading && isInTeam) {
      navigate(getTestAwareUrl('/teams', isTestMode));
    }
  }, [teamLoading, isInTeam, navigate, isTestMode]);

  // Auto-search if code from URL
  useEffect(() => {
    if (searchParams.get('code') && !previewTeam) {
      handleSearch();
    }
  }, []);

  const handleSearch = async () => {
    if (!code.trim()) {
      setError('Please enter a team code');
      return;
    }

    setSearching(true);
    setError(null);
    setPreviewTeam(null);

    const result = await getTeamByCode(code.trim(), isTestMode);

    setSearching(false);

    if (result) {
      setPreviewTeam(result);
    } else {
      setError('Team not found. Check the code and try again.');
    }
  };

  const handleJoin = async () => {
    if (!userProfile?.uid || !userProfile?.displayName) {
      setError('Please sign in to join a team');
      return;
    }

    if (!previewTeam) {
      setError('Please search for a team first');
      return;
    }

    setJoining(true);
    setError(null);

    const result = await joinTeam(
      userProfile.uid,
      userProfile.displayName,
      code.trim(),
      userProfile.photoURL,
      isTestMode
    );

    setJoining(false);

    if (result.success && result.teamId) {
      navigate(getTestAwareUrl(`/teams/${result.teamId}`, isTestMode));
    } else {
      setError(result.error || 'Failed to join team');
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-6">
      {isTestMode && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-300 text-sm">
          <FlaskConical className="w-4 h-4" />
          <span>Test Mode - Searching test teams only</span>
        </div>
      )}

      <Link
        to={getTestAwareUrl('/teams', isTestMode)}
        className="inline-flex items-center gap-2 text-cinema-400 hover:text-cinema-200 transition"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Teams</span>
      </Link>

      <section className="text-center space-y-2">
        <div className="w-16 h-16 mx-auto rounded-full bg-primary/20 flex items-center justify-center">
          <UserPlus className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-cinema-100">Join a Team</h1>
        <p className="text-cinema-400">Enter a team code to join</p>
      </section>

      <section className="space-y-4">
        {/* QR Scanner */}
        {showScanner && (
          <div className="relative rounded-xl overflow-hidden border border-cinema-200">
            <button
              onClick={() => setShowScanner(false)}
              className="absolute top-2 right-2 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition"
            >
              <X className="w-5 h-5" />
            </button>
            <Scanner
              onScan={(result) => {
                if (result && result[0]?.rawValue) {
                  const scannedUrl = result[0].rawValue;
                  // Extract code from URL like /teams/join?code=ABC123
                  const codeMatch = scannedUrl.match(/[?&]code=([A-Z0-9]{6})/i);
                  if (codeMatch) {
                    setCode(codeMatch[1].toUpperCase());
                    setShowScanner(false);
                    // Auto-search after scanning
                    setTimeout(() => {
                      const searchBtn = document.querySelector('[data-search-btn]') as HTMLButtonElement;
                      searchBtn?.click();
                    }, 100);
                  } else {
                    // Maybe the QR code is just the code itself
                    const plainCode = scannedUrl.match(/^[A-Z0-9]{6}$/i);
                    if (plainCode) {
                      setCode(plainCode[0].toUpperCase());
                      setShowScanner(false);
                      setTimeout(() => {
                        const searchBtn = document.querySelector('[data-search-btn]') as HTMLButtonElement;
                        searchBtn?.click();
                      }, 100);
                    }
                  }
                }
              }}
              styles={{
                container: { height: '250px' },
                video: { objectFit: 'cover' },
              }}
            />
            <p className="text-center text-cinema-400 text-sm py-2 bg-cinema-900/80">
              Point camera at team QR code
            </p>
          </div>
        )}

        {/* Code Input */}
        <div>
          <label className="block text-sm font-medium text-cinema-300 mb-2">
            Team Code
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                setPreviewTeam(null);
                setError(null);
              }}
              placeholder="e.g., HG4X9K"
              maxLength={6}
              className="flex-1 px-4 py-3 rounded-xl bg-cinema-50/10 border border-cinema-200 text-cinema-100 placeholder-cinema-500 focus:border-primary focus:outline-none transition font-mono text-lg tracking-wider text-center uppercase"
            />
            <button
              onClick={() => setShowScanner(true)}
              className="px-3 py-3 rounded-xl bg-cinema-50/20 border border-cinema-200 text-cinema-300 hover:border-primary hover:text-primary transition"
              title="Scan QR Code"
            >
              <Camera className="w-5 h-5" />
            </button>
            <button
              onClick={handleSearch}
              disabled={searching || !code.trim()}
              data-search-btn
              className="px-4 py-3 rounded-xl bg-cinema-50/20 border border-cinema-200 text-cinema-300 hover:border-primary hover:text-primary transition disabled:opacity-50"
            >
              {searching ? '...' : 'Find'}
            </button>
          </div>
        </div>

        {/* Team Preview */}
        {previewTeam && (
          <div className="space-y-4">
            <TeamCardPreview team={previewTeam.team} />

            {previewTeam.team.member_count < previewTeam.team.settings.max_members && (
              <button
                onClick={handleJoin}
                disabled={joining}
                className="w-full rounded-xl bg-primary px-4 py-3 text-cinema font-bold shadow-glow-lg active:scale-[0.99] transition disabled:opacity-50"
              >
                {joining ? 'Joining...' : 'Join Team'}
              </button>
            )}
          </div>
        )}

        {error && (
          <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-sm">
            {error}
          </div>
        )}
      </section>
    </div>
  );
}

// ============================================
// Team Detail Page
// ============================================

export function TeamDetail() {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isTestMode = useIsTestMode();
  const { userProfile } = useUser();
  const { team: userTeam } = useUserTeam({ isTestMode });
  const { team, membersList, loading, error } = useTeam(teamId || null, { isTestMode });

  const [showSettings, setShowSettings] = useState(searchParams.get('settings') === 'true');
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showDisbandConfirm, setShowDisbandConfirm] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Settings state
  const [editName, setEditName] = useState('');
  const [editMaxMembers, setEditMaxMembers] = useState(8);
  const [editTopContributors, setEditTopContributors] = useState(5);

  const isOwner = userTeam?.role === 'owner' && userTeam?.team_id === teamId;
  const isMember = userTeam?.team_id === teamId;

  // Initialize edit values when team loads
  useEffect(() => {
    if (team) {
      setEditName(team.name);
      setEditMaxMembers(team.settings.max_members);
      setEditTopContributors(team.settings.top_contributors);
    }
  }, [team]);

  const handleLeave = async () => {
    if (!userProfile?.uid) return;

    setActionLoading(true);
    setActionError(null);

    const result = await leaveTeam(userProfile.uid, isTestMode);

    setActionLoading(false);

    if (result.success) {
      navigate(getTestAwareUrl('/teams', isTestMode));
    } else {
      setActionError(result.error || 'Failed to leave team');
      setShowLeaveConfirm(false);
    }
  };

  const handleDisband = async () => {
    if (!userProfile?.uid || !teamId) return;

    setActionLoading(true);
    setActionError(null);

    const result = await disbandTeam(userProfile.uid, teamId, isTestMode);

    setActionLoading(false);

    if (result.success) {
      navigate(getTestAwareUrl('/teams', isTestMode));
    } else {
      setActionError(result.error || 'Failed to disband team');
      setShowDisbandConfirm(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!userProfile?.uid || !teamId || !team) return;

    setActionLoading(true);
    setActionError(null);

    // Update name if changed
    if (editName !== team.name) {
      const nameResult = await updateTeamName(teamId, userProfile.uid, editName, isTestMode);
      if (!nameResult.success) {
        setActionError(nameResult.error || 'Failed to update name');
        setActionLoading(false);
        return;
      }
    }

    // Update settings if changed
    if (
      editMaxMembers !== team.settings.max_members ||
      editTopContributors !== team.settings.top_contributors
    ) {
      const settingsResult = await updateTeamSettings(teamId, userProfile.uid, {
        max_members: editMaxMembers,
        top_contributors: editTopContributors,
      }, isTestMode);
      if (!settingsResult.success) {
        setActionError(settingsResult.error || 'Failed to update settings');
        setActionLoading(false);
        return;
      }
    }

    setActionLoading(false);
    setShowSettings(false);
  };

  const handleRemoveMember = async (uid: string, displayName: string) => {
    if (!userProfile?.uid || !teamId) return;
    if (!confirm(`Remove ${displayName} from the team?`)) return;

    setActionLoading(true);
    const result = await removeMember(teamId, userProfile.uid, uid, isTestMode);
    setActionLoading(false);

    if (!result.success) {
      setActionError(result.error || 'Failed to remove member');
    }
  };

  const handleTransferOwnership = async (uid: string, displayName: string) => {
    if (!userProfile?.uid || !teamId) return;
    if (!confirm(`Transfer team ownership to ${displayName}? This cannot be undone.`)) return;

    setActionLoading(true);
    const result = await transferOwnership(teamId, userProfile.uid, uid, isTestMode);
    setActionLoading(false);

    if (!result.success) {
      setActionError(result.error || 'Failed to transfer ownership');
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-md flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !team) {
    return (
      <div className="mx-auto max-w-md space-y-6">
        <Link
          to={getTestAwareUrl('/teams', isTestMode)}
          className="inline-flex items-center gap-2 text-cinema-400 hover:text-cinema-200 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Teams</span>
        </Link>

        <section className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-red-500/20 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-cinema-100">Team Not Found</h1>
          <p className="text-cinema-400">This team may have been disbanded or doesn't exist.</p>
        </section>
      </div>
    );
  }

  // Settings View
  if (showSettings && isOwner) {
    return (
      <div className="mx-auto max-w-md space-y-6">
        {isTestMode && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-300 text-sm">
            <FlaskConical className="w-4 h-4" />
            <span>Test Mode</span>
          </div>
        )}

        <button
          onClick={() => setShowSettings(false)}
          className="inline-flex items-center gap-2 text-cinema-400 hover:text-cinema-200 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Team</span>
        </button>

        <section className="text-center space-y-2">
          <div className="w-16 h-16 mx-auto rounded-full bg-primary/20 flex items-center justify-center">
            <Settings className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-cinema-100">Team Settings</h1>
        </section>

        <section className="space-y-4">
          {/* Team Name */}
          <div>
            <label className="block text-sm font-medium text-cinema-300 mb-2">Team Name</label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              maxLength={30}
              className="w-full px-4 py-3 rounded-xl bg-cinema-50/10 border border-cinema-200 text-cinema-100 focus:border-primary focus:outline-none transition"
            />
          </div>

          {/* Max Members */}
          <div>
            <label className="block text-sm text-cinema-400 mb-2">
              Maximum Members: <span className="text-primary font-bold">{editMaxMembers}</span>
            </label>
            <input
              type="range"
              min={Math.max(2, team.member_count)}
              max="20"
              value={editMaxMembers}
              onChange={(e) => setEditMaxMembers(parseInt(e.target.value))}
              className="w-full accent-primary"
            />
          </div>

          {/* Top Contributors */}
          <div>
            <label className="block text-sm text-cinema-400 mb-2">
              Top Scores Count: <span className="text-primary font-bold">{editTopContributors}</span>
            </label>
            <input
              type="range"
              min="1"
              max="10"
              value={editTopContributors}
              onChange={(e) => setEditTopContributors(parseInt(e.target.value))}
              className="w-full accent-primary"
            />
          </div>

          {actionError && (
            <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-sm">
              {actionError}
            </div>
          )}

          <button
            onClick={handleSaveSettings}
            disabled={actionLoading}
            className="w-full rounded-xl bg-primary px-4 py-3 text-cinema font-bold transition disabled:opacity-50"
          >
            {actionLoading ? 'Saving...' : 'Save Changes'}
          </button>

          <hr className="border-cinema-200" />

          {/* Danger Zone */}
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 space-y-3">
            <h3 className="text-red-300 font-semibold">Danger Zone</h3>
            <button
              onClick={() => setShowDisbandConfirm(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/50 text-red-300 hover:bg-red-500/30 transition"
            >
              <Trash2 className="w-4 h-4" />
              <span>Disband Team</span>
            </button>
          </div>
        </section>

        {/* Disband Confirmation Modal */}
        {showDisbandConfirm && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="bg-cinema rounded-2xl p-6 max-w-sm w-full space-y-4">
              <h3 className="text-lg font-bold text-cinema-100">Disband Team?</h3>
              <p className="text-cinema-400 text-sm">
                This will permanently delete the team and remove all members. This cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDisbandConfirm(false)}
                  className="flex-1 px-4 py-2 rounded-lg border border-cinema-200 text-cinema-300 hover:bg-cinema-50/10 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDisband}
                  disabled={actionLoading}
                  className="flex-1 px-4 py-2 rounded-lg bg-red-500 text-white font-semibold hover:bg-red-600 transition disabled:opacity-50"
                >
                  {actionLoading ? '...' : 'Disband'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Main Team View
  return (
    <div className="mx-auto max-w-md space-y-6">
      {isTestMode && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-300 text-sm">
          <FlaskConical className="w-4 h-4" />
          <span>Test Mode - Data isolated from production</span>
        </div>
      )}

      <Link
        to={getTestAwareUrl('/teams', isTestMode)}
        className="inline-flex items-center gap-2 text-cinema-400 hover:text-cinema-200 transition"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Teams</span>
      </Link>

      {/* Team Header */}
      <section className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-cinema-100">{team.name}</h1>
        <p className="text-cinema-400">
          {team.member_count} / {team.settings.max_members} members
        </p>
      </section>

      {/* QR Code for sharing */}
      <TeamQRCode teamCode={team.code} teamName={team.name} size={160} showCode={true} />

      {/* Members */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-cinema-100">Members</h2>
        <TeamMemberList
          members={membersList}
          currentUserId={userProfile?.uid}
          isOwner={isOwner}
          onRemoveMember={isOwner ? handleRemoveMember : undefined}
          onTransferOwnership={isOwner ? handleTransferOwnership : undefined}
        />
      </section>

      {/* Actions */}
      {isMember && (
        <section className="space-y-3">
          {isOwner && (
            <button
              onClick={() => setShowSettings(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-cinema-50/20 border border-cinema-200 text-cinema-300 hover:border-primary hover:text-primary transition"
            >
              <Settings className="w-5 h-5" />
              <span>Team Settings</span>
            </button>
          )}

          {!isOwner && (
            <button
              onClick={() => setShowLeaveConfirm(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-500/20 border border-red-500/50 text-red-300 hover:bg-red-500/30 transition"
            >
              <LogOut className="w-5 h-5" />
              <span>Leave Team</span>
            </button>
          )}
        </section>
      )}

      {actionError && (
        <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-sm">
          {actionError}
        </div>
      )}

      {/* Leave Confirmation Modal */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-cinema rounded-2xl p-6 max-w-sm w-full space-y-4">
            <h3 className="text-lg font-bold text-cinema-100">Leave Team?</h3>
            <p className="text-cinema-400 text-sm">
              You can rejoin later if the team still has space.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLeaveConfirm(false)}
                className="flex-1 px-4 py-2 rounded-lg border border-cinema-200 text-cinema-300 hover:bg-cinema-50/10 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleLeave}
                disabled={actionLoading}
                className="flex-1 px-4 py-2 rounded-lg bg-red-500 text-white font-semibold hover:bg-red-600 transition disabled:opacity-50"
              >
                {actionLoading ? '...' : 'Leave'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
