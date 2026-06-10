import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  FlaskConical,
  LogOut,
  Settings,
  Trash2,
} from "lucide-react";
import { useUser } from "../../contexts/UserContext";
import { useTeam } from "../../hooks/useTeam";
import { useUserTeam } from "../../hooks/useUserTeam";
import TeamMemberList from "../../components/teams/TeamMemberList";
import TeamQRCode from "../../components/teams/TeamQRCode";
import Spinner from "../../components/ui/Spinner";
import {
  disbandTeam,
  leaveTeam,
  removeMember,
  transferOwnership,
  updateTeamName,
  updateTeamSettings,
} from "../../lib/teamService";
import { getTestAwareUrl, useIsTestMode } from "../../lib/testMode";

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
        <Spinner className="w-8 h-8 border-4 border-primary border-t-transparent" />
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
              className="w-full px-4 py-3 rounded-xl bg-cinema-50/10 border border-cinema-200 text-cinema-800 focus:border-primary focus:outline-none transition"
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

export default TeamDetail;
