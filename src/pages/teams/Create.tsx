import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Check, FlaskConical, Users } from "lucide-react";
import { useUser } from "../../contexts/UserContext";
import { useUserTeam } from "../../hooks/useUserTeam";
import TeamQRCode from "../../components/teams/TeamQRCode";
import { createTeam } from "../../lib/teamService";
import { getTestAwareUrl, useIsTestMode } from "../../lib/testMode";

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
            className="w-full px-4 py-3 rounded-xl bg-cinema-50/10 border border-cinema-200 text-cinema-800 placeholder-cinema-500 focus:border-primary focus:outline-none transition"
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

export default CreateTeam;
