import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { onValue, ref } from 'firebase/database';
import { auth, db } from '../lib/firebase';
import { ShowMeta } from '../types/firebaseContract';
import { AlertCircle, Sparkles, UserPlus } from 'lucide-react';
import { getShowBasePath, getTestShowBasePath } from '../lib/mode';
import { useUser } from '../contexts/UserContext';
import EmailLinkSignIn from '../features/auth/EmailLinkSignIn';
import { signInWithGoogle } from '../lib/auth';

interface LiveShow {
  showId: string;
  meta: ShowMeta;
  startedAt: number;
  isTestShow: boolean;
}

export default function JoinCurrentShow() {
  const navigate = useNavigate();
  const { canUseTestMode, isRegistered } = useUser();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liveShows, setLiveShows] = useState<LiveShow[]>([]);
  const [signingIn, setSigningIn] = useState(false);
  void setError; // Suppress unused warning - error state used in JSX

  const isGoogleUser = !auth.currentUser?.isAnonymous && Boolean(auth.currentUser?.email);
  const needsSignIn = !isGoogleUser && !isRegistered;

  // Helper to extract live shows from snapshot data
  const extractLiveShows = (data: any, isTestShow: boolean): LiveShow[] => {
    if (!data) return [];

    const MAX_STALE_MS = 30 * 60 * 1000; // 30 minutes
    const now = Date.now();

    return Object.entries(data).flatMap(([showId, showData]: [string, any]) => {
      const meta = showData?.meta as ShowMeta | undefined;
      const liveTrivia = showData?.live?.trivia;
      const phase = liveTrivia?.phase as string | undefined;

      // Check timestamps for staleness
      const triviaUpdatedAt = liveTrivia?.updatedAt as number | undefined;
      const triviaStartedAt = typeof liveTrivia?.startedAt === 'number' ? liveTrivia.startedAt : 0;
      const triviaTimestamp = triviaUpdatedAt || triviaStartedAt;
      const isTriviaStale = !triviaTimestamp || (now - triviaTimestamp) > MAX_STALE_MS;

      const triviaActive = Boolean(phase && phase !== 'idle' && !isTriviaStale);

      const liveActivity = showData?.live?.activity;
      const activityUpdatedAt = liveActivity?.updatedAt as number | undefined;
      const activityStartedAt = typeof liveActivity?.startedAt === 'number' ? liveActivity.startedAt : 0;
      const activityTimestamp = activityUpdatedAt || activityStartedAt;
      const isActivityStale = !activityTimestamp || (now - activityTimestamp) > MAX_STALE_MS;

      const activityActive = liveActivity?.status === 'active' && !isActivityStale;

      if (!meta || !meta.title) return [];
      if (!triviaActive && !activityActive) return [];

      const startedAt = Math.max(
        triviaActive ? triviaStartedAt : 0,
        activityActive ? activityStartedAt : 0
      );
      return [{ showId, meta, startedAt, isTestShow }];
    });
  };

  useEffect(() => {
    const unsubscribes: (() => void)[] = [];
    let prodShows: LiveShow[] = [];
    let testShows: LiveShow[] = [];
    let prodLoaded = false;
    let testLoaded = !canUseTestMode; // Skip test if user can't use test mode

    const updateLiveShows = () => {
      if (!prodLoaded || !testLoaded) return;

      // Combine and sort by startedAt, prioritizing test shows
      const allShows = [...testShows, ...prodShows];
      allShows.sort((a, b) => b.startedAt - a.startedAt);
      setLiveShows(allShows);
      setLoading(false);
    };

    // Listen to production shows
    const prodRef = ref(db, getShowBasePath());
    const prodUnsub = onValue(
      prodRef,
      (snapshot) => {
        prodShows = extractLiveShows(snapshot.val(), false);
        prodLoaded = true;
        updateLiveShows();
      },
      (err) => {
        console.warn('Error loading production shows:', err);
        prodLoaded = true;
        updateLiveShows();
      }
    );
    unsubscribes.push(prodUnsub);

    // Listen to test shows (if user has access)
    if (canUseTestMode) {
      const testRef = ref(db, getTestShowBasePath());
      const testUnsub = onValue(
        testRef,
        (snapshot) => {
          testShows = extractLiveShows(snapshot.val(), true);
          testLoaded = true;
          updateLiveShows();
        },
        (err) => {
          console.warn('Error loading test shows:', err);
          testLoaded = true;
          updateLiveShows();
        }
      );
      unsubscribes.push(testUnsub);
    }

    return () => unsubscribes.forEach(unsub => unsub());
  }, [canUseTestMode]);

  const primaryLiveShow = useMemo(() => liveShows[0] ?? null, [liveShows]);

  useEffect(() => {
    if (loading) return;
    if (!primaryLiveShow) return;
    const testQuery = primaryLiveShow.isTestShow ? '?test=true' : '';
    navigate(`/shows/${primaryLiveShow.showId}/join${testQuery}`, { replace: true });
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
            When the DJ starts a show, you'll be able to join here.
          </p>
        </div>

        {/* Sign-up shortcut — visible whenever the visitor isn't signed in.
            Means anyone who scans a Hollywood Groove QR code while the show
            hasn't started yet can still set up their account ahead of time. */}
        {needsSignIn && (
          <div className="card-cinema p-5 space-y-4">
            <div className="flex items-start gap-3">
              <span className="w-9 h-9 rounded-full bg-primary/15 text-primary flex items-center justify-center flex-shrink-0">
                <UserPlus className="w-4 h-4" />
              </span>
              <div>
                <p className="text-sm font-bold text-cinema-900">Get ready for the next show</p>
                <p className="text-xs text-cinema-600 mt-0.5">
                  Sign up now so you can jump straight in when the DJ starts.
                </p>
              </div>
            </div>

            <button
              onClick={async () => {
                setSigningIn(true);
                try {
                  await signInWithGoogle();
                } finally {
                  setSigningIn(false);
                }
              }}
              disabled={signingIn}
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-300 bg-white text-gray-700 font-semibold hover:border-primary/60 hover:shadow-md transition flex items-center justify-center gap-3 disabled:opacity-50"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              {signingIn ? 'Signing in...' : 'Sign in with Google'}
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-cinema-200"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-2 bg-cinema-50 text-cinema-500">or use any email</span>
              </div>
            </div>

            <EmailLinkSignIn />

            <Link
              to="/signup"
              className="block text-center text-xs text-cinema-600 underline-offset-2 hover:underline"
            >
              Or fill out the full signup form
            </Link>
          </div>
        )}

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
