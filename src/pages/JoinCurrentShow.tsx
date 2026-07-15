import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { auth } from '../lib/firebase';
import { AlertCircle, Sparkles, UserPlus } from 'lucide-react';
import { useUser } from '../contexts/UserContext';
import { signInWithGoogle } from '../lib/auth';
import { useActiveShows } from '../lib/showIndex';
import GoogleSignInButton from '../components/ui/GoogleSignInButton';

const LIVE_SHOWS_WATCHDOG_MS = 10000;

export default function JoinCurrentShow() {
  const navigate = useNavigate();
  const { canUseTestMode, isRegistered } = useUser();
  const [error, setError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  const isGoogleUser = !auth.currentUser?.isAnonymous && Boolean(auth.currentUser?.email);
  const needsSignIn = !isGoogleUser && !isRegistered;

  const handleActiveShowsError = useCallback((activeShowsError: unknown) => {
    console.error('Failed to check live shows:', activeShowsError);
    setError('We couldn’t check the live show list. Check your connection and tap Retry.');
  }, []);

  const { shows: liveShows, loading: liveShowsLoading } = useActiveShows({
    includeProd: true,
    includeTest: canUseTestMode,
    onError: handleActiveShowsError,
  });

  const loading = liveShowsLoading && !error;

  useEffect(() => {
    if (!liveShowsLoading || error) return;

    const watchdogId = window.setTimeout(() => {
      setError('Still looking for the live show. If you’re at the venue now, check your connection and tap Retry.');
    }, LIVE_SHOWS_WATCHDOG_MS);

    return () => window.clearTimeout(watchdogId);
  }, [error, liveShowsLoading]);

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

            <GoogleSignInButton
              onClick={async () => {
                setSigningIn(true);
                try {
                  await signInWithGoogle();
                } finally {
                  setSigningIn(false);
                }
              }}
              disabled={signingIn}
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-300 bg-white text-gray-700 font-semibold hover:border-primary/60 hover:shadow-md transition disabled:opacity-50"
            >
              {signingIn ? 'Signing in...' : 'Sign in with Google'}
            </GoogleSignInButton>

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
