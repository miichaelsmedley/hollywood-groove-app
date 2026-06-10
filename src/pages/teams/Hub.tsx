import { Link } from "react-router-dom";
import { FlaskConical, Star, Trophy, UserPlus, Users } from "lucide-react";
import { useUser } from "../../contexts/UserContext";
import { useTeam } from "../../hooks/useTeam";
import { useUserTeam } from "../../hooks/useUserTeam";
import TeamCard from "../../components/teams/TeamCard";
import Spinner from "../../components/ui/Spinner";
import { getTestAwareUrl, useIsTestMode } from "../../lib/testMode";

export function TeamsHub() {
  useUser(); // For auth context
  const isTestMode = useIsTestMode();
  const { team: userTeam, loading, isInTeam } = useUserTeam({ isTestMode });
  const { team: teamDetails } = useTeam(userTeam?.team_id || null, { isTestMode });

  if (loading) {
    return (
      <div className="mx-auto max-w-md flex items-center justify-center py-12">
        <Spinner className="w-8 h-8 border-4 border-primary border-t-transparent" />
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

export default TeamsHub;
