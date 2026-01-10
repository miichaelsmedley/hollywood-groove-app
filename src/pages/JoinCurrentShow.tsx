import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { onValue, ref } from 'firebase/database';
import { db } from '../lib/firebase';
import { ShowMeta } from '../types/firebaseContract';
import { AlertCircle, Sparkles } from 'lucide-react';

interface LiveShow {
  showId: string;
  meta: ShowMeta;
  startedAt: number;
}

export default function JoinCurrentShow() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liveShows, setLiveShows] = useState<LiveShow[]>([]);

  useEffect(() => {
    const showsRef = ref(db, 'shows');

    const unsubscribe = onValue(
      showsRef,
      (snapshot) => {
        setLoading(false);
        setError(null);

        const data = snapshot.val();
        if (!data) {
          setLiveShows([]);
          return;
        }

        const lives: LiveShow[] = Object.entries(data).flatMap(([showId, showData]: [string, any]) => {
          const meta = showData?.meta as ShowMeta | undefined;
          const liveTrivia = showData?.live?.trivia;
          const phase = liveTrivia?.phase as string | undefined;
          const triviaActive = Boolean(phase && phase !== 'idle');
          const triviaStartedAt = typeof liveTrivia?.startedAt === 'number' ? liveTrivia.startedAt : 0;

          const liveActivity = showData?.live?.activity;
          const activityActive = liveActivity?.status === 'active';
          const activityStartedAt = typeof liveActivity?.startedAt === 'number' ? liveActivity.startedAt : 0;

          if (!meta || !meta.title) return [];
          if (!triviaActive && !activityActive) return [];

          const startedAt = Math.max(
            triviaActive ? triviaStartedAt : 0,
            activityActive ? activityStartedAt : 0
          );
          return [{ showId, meta, startedAt }];
        });

        lives.sort((a, b) => b.startedAt - a.startedAt);
        setLiveShows(lives);
      },
      (err) => {
        setLoading(false);
        setError(err.message);
      }
    );

    return () => unsubscribe();
  }, []);

  const primaryLiveShow = useMemo(() => liveShows[0] ?? null, [liveShows]);

  useEffect(() => {
    if (loading) return;
    if (!primaryLiveShow) return;
    navigate(`/shows/${primaryLiveShow.showId}/join`, { replace: true });
  }, [loading, navigate, primaryLiveShow]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[55vh]">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-cinema-500 font-medium">Looking for a live show…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[55vh]">
        <div className="text-center space-y-4 max-w-md">
          <AlertCircle className="w-12 h-12 text-accent-red mx-auto" />
          <h2 className="text-xl font-bold">Can’t check live shows</h2>
          <p className="text-cinema-500 text-sm">{error}</p>
          <div className="flex gap-3 justify-center pt-2">
            <button
              onClick={() => window.location.reload()}
              className="btn-primary"
            >
              Retry
            </button>
            <Link
              to="/shows"
              className="px-6 py-3 rounded-xl border border-cinema-200 bg-cinema-50 text-cinema-900 font-semibold hover:border-primary/60 transition"
            >
              Browse shows
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!primaryLiveShow) {
    return (
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-cinema-50 border border-cinema-200 flex items-center justify-center mx-auto">
            <Sparkles className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">No live show right now</h1>
          <p className="text-cinema-500 text-sm">
            When the DJ starts a show, you’ll be able to join here.
          </p>
        </div>

        <div className="space-y-3">
          <Link to="/upcoming" className="block w-full btn-primary text-center">
            View upcoming events
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

  return null;
}
