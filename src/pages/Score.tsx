import { Link } from 'react-router-dom';
import { ArrowLeft, ClipboardCheck, Clock } from 'lucide-react';
import { ScorerGate } from '../components/RoleGate';

function ScoreContent() {
  return (
    <div className="mx-auto max-w-md space-y-6">
      {/* Back Button */}
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-cinema-500 hover:text-cinema-300 transition"
      >
        <ArrowLeft className="h-5 w-5" />
        <span>Back to Home</span>
      </Link>

      {/* Coming Soon Card */}
      <div className="rounded-2xl bg-cinema-50 border border-cinema-200 p-8 text-center space-y-6">
        <div className="mx-auto w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center">
          <ClipboardCheck className="h-10 w-10 text-emerald-400" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-cinema-900">Activity Scoring</h1>
          <p className="text-cinema-500">
            Judge participant submissions and award points during live shows.
          </p>
        </div>

        <div className="flex items-center justify-center gap-2 text-amber-400">
          <Clock className="h-5 w-5" />
          <span className="font-semibold">Coming Soon</span>
        </div>

        <div className="pt-4 border-t border-cinema-200 space-y-3 text-sm text-cinema-500">
          <p>As a scorer, you'll be able to:</p>
          <ul className="space-y-2 text-left max-w-xs mx-auto">
            <li className="flex items-start gap-2">
              <span className="text-emerald-400 mt-0.5">•</span>
              <span>Review participant submissions in real-time</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-400 mt-0.5">•</span>
              <span>Score activities like costume contests and stage performances</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-400 mt-0.5">•</span>
              <span>Award bonus points for exceptional participation</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function Score() {
  return (
    <ScorerGate redirectTo="/">
      <ScoreContent />
    </ScorerGate>
  );
}
