import { Link } from 'react-router-dom';
import { Trophy } from 'lucide-react';

export default function Leaderboard() {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="w-16 h-16 rounded-2xl bg-cinema-50 border border-cinema-200 flex items-center justify-center mx-auto">
          <Trophy className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold">All-time leaderboard</h1>
        <p className="text-cinema-500 text-sm">
          Coming soon. This will show the top players across all shows.
        </p>
      </div>

      <div className="space-y-3">
        <Link to="/scores" className="block w-full btn-primary text-center">
          View show scores
        </Link>
        <Link
          to="/shows"
          className="block w-full px-6 py-3 rounded-xl border border-cinema-200 bg-cinema-50 text-cinema-900 font-semibold hover:border-primary/60 transition text-center"
        >
          Browse shows
        </Link>
      </div>
    </div>
  );
}

