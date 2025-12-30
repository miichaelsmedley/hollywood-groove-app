import { Link } from 'react-router-dom';
import { Trophy } from 'lucide-react';
import { auth } from '../lib/firebase';
import AllTimeLeaderboard from '../components/leaderboard/AllTimeLeaderboard';

export default function Leaderboard() {
  const uid = auth.currentUser?.uid ?? null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">All-time leaderboard</h1>
          <p className="text-cinema-500 text-sm">
            Stars earned across all shows.
          </p>
        </div>
        <Trophy className="w-6 h-6 text-primary" />
      </div>

      <AllTimeLeaderboard currentUserId={uid} />

      <Link to="/scores" className="block w-full btn-primary text-center">
        View your score
      </Link>
    </div>
  );
}
