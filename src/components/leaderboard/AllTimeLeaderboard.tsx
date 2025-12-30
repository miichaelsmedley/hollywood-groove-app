import { Trophy } from 'lucide-react';
import { useAllTimeLeaderboard } from '../../hooks/useAllTimeLeaderboard';
import LeaderboardEntry from './LeaderboardEntry';

interface AllTimeLeaderboardProps {
  currentUserId?: string | null;
}

export default function AllTimeLeaderboard({ currentUserId }: AllTimeLeaderboardProps) {
  const { entries, updatedAt, isLoading, error } = useAllTimeLeaderboard();

  if (isLoading) {
    return (
      <div className="bg-cinema-50 border border-cinema-200 rounded-2xl p-6 text-center">
        <div className="flex items-center justify-center gap-2 text-cinema-500">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
          <span className="text-sm">Loading leaderboard...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-cinema-50 border border-cinema-200 rounded-2xl p-6 text-center">
        <p className="text-accent-red font-semibold">Can’t load leaderboard</p>
        <p className="text-cinema-500 text-sm mt-1">{error}</p>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="bg-cinema-50 border border-cinema-200 rounded-2xl p-6 text-center">
        <p className="text-cinema-500 text-sm">No leaderboard entries yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-cinema-50 border border-cinema-200 rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-cinema-200 flex items-center justify-between text-sm font-semibold text-cinema-800">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-primary" />
          <span>All-time leaderboard</span>
        </div>
        {updatedAt ? (
          <span className="text-xs text-cinema-500">
            Updated {new Date(updatedAt).toLocaleTimeString()}
          </span>
        ) : null}
      </div>
      <ol className="divide-y divide-cinema-200">
        {entries.map((entry, index) => (
          <LeaderboardEntry
            key={entry.member_id}
            rank={index + 1}
            displayName={entry.display_name}
            tier={entry.tier ?? undefined}
            score={entry.stars}
            scoreSuffix="stars"
            isCurrentUser={entry.member_id === currentUserId}
          />
        ))}
      </ol>
    </div>
  );
}
