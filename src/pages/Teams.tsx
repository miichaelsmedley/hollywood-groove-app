import { Link, useParams } from 'react-router-dom';
import { Users, UserPlus, ArrowLeft, Trophy, Star } from 'lucide-react';

/**
 * Teams Hub Page
 * Shows team options: Create or Join
 */
export function TeamsHub() {
  return (
    <div className="mx-auto max-w-md space-y-6">
      <section className="text-center space-y-2">
        <div className="w-16 h-16 mx-auto rounded-full bg-primary/20 flex items-center justify-center">
          <Users className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-cinema-100">Teams</h1>
        <p className="text-cinema-400">
          Compete together with friends and family
        </p>
      </section>

      <section className="space-y-3">
        <Link
          to="/teams/create"
          className="block w-full rounded-xl bg-primary px-4 py-4 text-cinema font-bold shadow-glow-lg active:scale-[0.99] transition"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-lg leading-tight">Create a Team</div>
              <div className="text-sm font-semibold opacity-80">Start a new team and invite members</div>
            </div>
            <Users className="h-6 w-6" />
          </div>
        </Link>

        <Link
          to="/teams/join"
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
            <span>Combine scores with teammates for team leaderboards</span>
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

/**
 * Create Team Page
 */
export function CreateTeam() {
  return (
    <div className="mx-auto max-w-md space-y-6">
      <Link
        to="/teams"
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
        <p className="text-cinema-400">
          Set up your team and invite members
        </p>
      </section>

      <section className="p-6 bg-cinema-50/10 rounded-xl border border-cinema-200 text-center">
        <div className="text-6xl mb-4">🚧</div>
        <h2 className="text-xl font-semibold text-cinema-100 mb-2">Coming Soon</h2>
        <p className="text-cinema-400">
          Team creation is being built. Check back soon!
        </p>
      </section>
    </div>
  );
}

/**
 * Join Team Page
 */
export function JoinTeam() {
  return (
    <div className="mx-auto max-w-md space-y-6">
      <Link
        to="/teams"
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
        <p className="text-cinema-400">
          Enter a team code to join an existing team
        </p>
      </section>

      <section className="p-6 bg-cinema-50/10 rounded-xl border border-cinema-200 text-center">
        <div className="text-6xl mb-4">🚧</div>
        <h2 className="text-xl font-semibold text-cinema-100 mb-2">Coming Soon</h2>
        <p className="text-cinema-400">
          Team joining is being built. Check back soon!
        </p>
      </section>
    </div>
  );
}

/**
 * Team Detail Page
 */
export function TeamDetail() {
  const { teamId } = useParams<{ teamId: string }>();

  return (
    <div className="mx-auto max-w-md space-y-6">
      <Link
        to="/teams"
        className="inline-flex items-center gap-2 text-cinema-400 hover:text-cinema-200 transition"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Teams</span>
      </Link>

      <section className="text-center space-y-2">
        <div className="w-16 h-16 mx-auto rounded-full bg-primary/20 flex items-center justify-center">
          <Users className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-cinema-100">Team Details</h1>
        <p className="text-cinema-400">
          Team ID: {teamId}
        </p>
      </section>

      <section className="p-6 bg-cinema-50/10 rounded-xl border border-cinema-200 text-center">
        <div className="text-6xl mb-4">🚧</div>
        <h2 className="text-xl font-semibold text-cinema-100 mb-2">Coming Soon</h2>
        <p className="text-cinema-400">
          Team details page is being built. Check back soon!
        </p>
      </section>
    </div>
  );
}
