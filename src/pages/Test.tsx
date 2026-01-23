import { Link } from 'react-router-dom';
import { FlaskConical, Play, Settings, AlertTriangle } from 'lucide-react';
import { useUser } from '../contexts/UserContext';
import { useEffect, useState } from 'react';
import { onValue, ref } from 'firebase/database';
import { db } from '../lib/firebase';
import { ShowMeta } from '../types/firebaseContract';

interface TestShow {
  showId: string;
  title: string;
  isActive: boolean;
}

/**
 * Tester Dashboard
 * Central hub for testers to access test shows and testing tools
 */
export default function Test() {
  const { canUseTestMode } = useUser();
  const [testShows, setTestShows] = useState<TestShow[]>([]);
  const [loading, setLoading] = useState(true);

  // Listen to test shows
  useEffect(() => {
    if (!canUseTestMode) {
      setLoading(false);
      return;
    }

    const showsRef = ref(db, 'test/shows');
    const unsubscribe = onValue(
      showsRef,
      (snapshot) => {
        setLoading(false);
        const data = snapshot.val();

        if (!data) {
          setTestShows([]);
          return;
        }

        const MAX_STALE_MS = 30 * 60 * 1000;
        const now = Date.now();

        const shows: TestShow[] = [];
        for (const [showId, showData] of Object.entries(data) as [string, any][]) {
          const meta = showData?.meta as ShowMeta | undefined;
          if (!meta?.title) continue;

          const liveTrivia = showData?.live?.trivia;
          const triviaTimestamp = liveTrivia?.updatedAt || liveTrivia?.startedAt;
          const triviaActive = liveTrivia?.phase && ['question', 'answer'].includes(liveTrivia.phase) &&
            triviaTimestamp && (now - triviaTimestamp) < MAX_STALE_MS;

          const liveActivity = showData?.live?.activity;
          const activityTimestamp = liveActivity?.updatedAt || liveActivity?.startedAt;
          const activityActive = liveActivity?.status === 'active' &&
            activityTimestamp && (now - activityTimestamp) < MAX_STALE_MS;

          shows.push({
            showId,
            title: meta.title,
            isActive: Boolean(triviaActive || activityActive),
          });
        }

        setTestShows(shows);
      },
      (err) => {
        console.warn('Failed to load test shows:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [canUseTestMode]);

  if (!canUseTestMode) {
    return (
      <div className="mx-auto max-w-md space-y-6">
        <section className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-red-500/20 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-cinema-100">Access Denied</h1>
          <p className="text-cinema-400">
            You don't have tester permissions. Contact an admin if you need access.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <section className="text-center space-y-2">
        <div className="w-16 h-16 mx-auto rounded-full bg-purple-500/20 flex items-center justify-center">
          <FlaskConical className="w-8 h-8 text-purple-400" />
        </div>
        <h1 className="text-2xl font-bold text-cinema-100">Tester Dashboard</h1>
        <p className="text-cinema-400">
          Test shows and features before they go live
        </p>
      </section>

      {/* Test Shows */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-cinema-100">Test Shows</h2>

        {loading ? (
          <div className="p-4 bg-cinema-50/10 rounded-xl border border-cinema-200 text-center">
            <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-cinema-400 mt-2">Loading test shows...</p>
          </div>
        ) : testShows.length === 0 ? (
          <div className="p-4 bg-cinema-50/10 rounded-xl border border-cinema-200 text-center">
            <p className="text-cinema-400">No test shows available</p>
            <p className="text-cinema-500 text-sm mt-1">
              Start a test show from the Mac Controller
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {testShows.map((show) => (
              <Link
                key={show.showId}
                to={`/shows/${show.showId}/join?test=true`}
                className={`block w-full rounded-xl px-4 py-3 font-semibold transition ${
                  show.isActive
                    ? 'bg-purple-600 text-white shadow-lg active:scale-[0.99]'
                    : 'bg-purple-500/20 border border-purple-500/50 text-purple-200 hover:bg-purple-500/30'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-base leading-tight">{show.title}</div>
                    <div className={`text-sm ${show.isActive ? 'opacity-80' : 'text-purple-300/80'}`}>
                      {show.isActive ? '● Live now' : 'Not active'}
                    </div>
                  </div>
                  <Play className="h-5 w-5" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Testing Tools */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-cinema-100">Testing Tools</h2>

        <div className="p-4 bg-cinema-50/10 rounded-xl border border-cinema-200">
          <div className="flex items-center gap-3 mb-3">
            <Settings className="w-5 h-5 text-purple-400" />
            <span className="font-medium text-cinema-100">Coming Soon</span>
          </div>
          <p className="text-cinema-400 text-sm">
            Additional testing tools will be added here, including:
          </p>
          <ul className="text-cinema-500 text-sm mt-2 space-y-1">
            <li>• Mock scorer simulation</li>
            <li>• Activity type testing</li>
            <li>• Full show rehearsal mode</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
