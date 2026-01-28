import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, signInAnonymously, onIdTokenChanged } from 'firebase/auth';
import { auth, authPersistenceReady } from './lib/firebase';
import { handleRedirectResult, isGoogleAuthInProgress, clearAllPendingAuth, RedirectResult } from './lib/auth';
import { UserProvider } from './contexts/UserContext';

import Layout from './components/Layout';
import ShowLayout from './layouts/ShowLayout';
import AdminRoute from './components/AdminRoute';
import Home from './pages/Home';
import ShowsPage from './features/shows/ShowsPage';
import ShowDetail from './pages/ShowDetail';
import JoinShow from './pages/JoinShow';
import Signup from './pages/Signup';
import Trivia from './pages/Trivia';
import Activity from './pages/Activity';
import Activities from './pages/Activities';
import ActivityDetail from './pages/ActivityDetail';
import GlobalActivities from './pages/GlobalActivities';
import FirebaseTest from './pages/FirebaseTest';
import JoinCurrentShow from './pages/JoinCurrentShow';
import Scores from './pages/Scores';
import Leaderboard from './pages/Leaderboard';
import Profile from './pages/Profile';
import Play from './pages/Play';
import Score from './pages/Score';
import { TeamsHub, CreateTeam, JoinTeam, TeamDetail } from './pages/Teams';
import Test from './pages/Test';
import { IS_TEST_MODE } from './lib/mode';

// TEMPORARY: Mobile debugging console - remove after fixing auth
// Uncomment if you need to debug on mobile
// if (typeof window !== 'undefined') {
//   const script = document.createElement('script');
//   script.src = 'https://cdn.jsdelivr.net/npm/eruda';
//   document.body.appendChild(script);
//   script.onload = () => {
//     (window as any).eruda?.init();
//     console.log('📱 Mobile console loaded - tap the icon to view logs');
//   };
// }

export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [showErrorBanner, setShowErrorBanner] = useState(false);

  // Handle error banner display - auto-dismiss after 10 seconds
  useEffect(() => {
    if (authError && authReady) {
      setShowErrorBanner(true);
      const timer = setTimeout(() => setShowErrorBanner(false), 10000);
      return () => clearTimeout(timer);
    }
  }, [authError, authReady]);

  // Handle auth initialization: redirect result first, then anonymous sign-in
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let tokenUnsubscribe: (() => void) | undefined;
    let isMounted = true;

    (async () => {
      // Wait for auth persistence to be configured first
      console.log('⏳ Waiting for auth persistence to be configured...');
      await authPersistenceReady;

      // Handle redirect result FIRST - this is critical for mobile auth
      // handleRedirectResult now waits for auth state to stabilize internally
      let redirectResult: RedirectResult;
      let hadAuthAttempt = false; // Track if user was trying to sign in

      try {
        console.log('🔐 Processing redirect result...');
        redirectResult = await handleRedirectResult();
        console.log('📋 Redirect result:', redirectResult);

        // Track if there was an auth attempt (redirect or popup pending)
        hadAuthAttempt = redirectResult.wasRedirectPending;

        // Show error to user if redirect failed
        if (!redirectResult.success && redirectResult.error) {
          console.error('❌ Auth redirect failed:', redirectResult.error);
          // Clear all pending state to prevent loops
          clearAllPendingAuth();
          setAuthError('Sign-in failed. Please try again.');
        }
      } catch (error) {
        console.error('❌ Error handling redirect:', error);
        clearAllPendingAuth();
        redirectResult = {
          success: false,
          userSignedInWithGoogle: false,
          wasRedirectPending: false,
          error: error instanceof Error ? error : new Error(String(error)),
        };
      }

      // Only set up auth listener if component is still mounted
      if (!isMounted) return;

      // Set up token refresh listener to maintain session across long periods
      tokenUnsubscribe = onIdTokenChanged(auth, async (user) => {
        if (user) {
          // Store last token refresh time for debugging
          localStorage.setItem('hg_last_token_refresh', new Date().toISOString());
          console.log('🔄 Auth token refreshed for:', user.uid);
        }
      });

      // If user is already signed in with Google, we're done - don't set up anonymous fallback
      if (redirectResult.userSignedInWithGoogle) {
        console.log('✅ User is signed in with Google, auth initialization complete');
        setAuthReady(true);

        // Still set up the listener for future state changes, but don't do anonymous sign-in
        unsubscribe = onAuthStateChanged(auth, (user) => {
          console.log('🔄 Auth state changed:', user ? {
            uid: user.uid,
            isAnonymous: user.isAnonymous,
            email: user.email,
          } : 'null');
        });
        return;
      }

      // CRITICAL: Wait for auth state to be fully restored from localStorage
      // This is essential because onAuthStateChanged fires immediately with null
      // before the persisted auth state is loaded
      console.log('⏳ Waiting for auth state to be fully ready...');
      await auth.authStateReady();
      console.log('✅ Auth state ready, current user:', auth.currentUser ? {
        uid: auth.currentUser.uid,
        isAnonymous: auth.currentUser.isAnonymous,
        email: auth.currentUser.email,
        providers: auth.currentUser.providerData?.map(p => p.providerId),
      } : 'null');

      // Check if we already have a user after auth state is ready
      if (auth.currentUser) {
        console.log('✅ User already signed in after auth state ready');
        setAuthReady(true);

        // Set up listener for future changes only
        unsubscribe = onAuthStateChanged(auth, (user) => {
          console.log('🔄 Auth state changed:', user ? {
            uid: user.uid,
            isAnonymous: user.isAnonymous,
            email: user.email,
          } : 'null');
        });
        return;
      }

      // No user after auth state is ready - need to handle anonymous sign-in
      // But first check if Google auth is in progress
      if (isGoogleAuthInProgress()) {
        console.log('⏳ No user but Google auth in progress, waiting...');
        setAuthReady(true);

        unsubscribe = onAuthStateChanged(auth, (user) => {
          console.log('🔄 Auth state changed (waiting for Google):', user ? {
            uid: user.uid,
            isAnonymous: user.isAnonymous,
          } : 'null');
        });
        return;
      }

      // IMPORTANT: If we just came from a failed auth attempt, DON'T auto-sign-in anonymously
      // Let the user see the error and try again manually
      if (hadAuthAttempt && !redirectResult.success) {
        console.log('⚠️ Auth attempt failed, not auto-signing in anonymously');
        setAuthReady(true);

        unsubscribe = onAuthStateChanged(auth, (user) => {
          console.log('🔄 Auth state changed (after failed attempt):', user ? {
            uid: user.uid,
            isAnonymous: user.isAnonymous,
          } : 'null');
        });
        return;
      }

      // Truly no user and no pending auth - sign in anonymously
      try {
        console.log('👤 No user found, signing in anonymously...');
        await signInAnonymously(auth);
        console.log('✅ Anonymous sign-in complete');
      } catch (error) {
        console.error('Firebase auth error:', error);
        setAuthError('Authentication failed. Please refresh the page.');
      }

      // Mark auth as ready
      setAuthReady(true);

      // Set up listener for future changes
      unsubscribe = onAuthStateChanged(auth, (user) => {
        console.log('🔄 Auth state changed:', user ? {
          uid: user.uid,
          isAnonymous: user.isAnonymous,
          email: user.email,
        } : 'null');
      });
    })();

    return () => {
      isMounted = false;
      unsubscribe?.();
      tokenUnsubscribe?.();
    };
  }, []);

  // Show loading state while auth is initializing
  if (!authReady) {
    return (
      <div className="min-h-screen bg-cinema-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-cinema-400">Loading...</p>
          {authError && (
            <div className="mt-4">
              <p className="text-red-400 text-sm mb-3">{authError}</p>
              <button
                onClick={() => {
                  // Clear any stuck auth state and reload
                  localStorage.removeItem('hg_google_auth_redirect_pending');
                  localStorage.removeItem('hg_google_auth_redirect_timestamp');
                  localStorage.removeItem('hg_google_auth_popup_pending');
                  window.location.reload();
                }}
                className="px-4 py-2 bg-primary text-cinema rounded-lg text-sm font-medium hover:bg-primary/90"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <UserProvider>
        {/* Auth error banner */}
        {showErrorBanner && authError && (
          <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white px-4 py-3 flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="font-medium">{authError}</span>
            </div>
            <button
              onClick={() => {
                setShowErrorBanner(false);
                setAuthError(null);
                // Clear stuck auth state and allow retry
                clearAllPendingAuth();
              }}
              className="text-white/80 hover:text-white"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="shows" element={<ShowsPage mode="all" />} />
            <Route path="upcoming" element={<ShowsPage mode="upcoming" />} />
            <Route path="join" element={<JoinCurrentShow />} />
            <Route path="scores" element={<Scores />} />
            <Route path="leaderboard" element={<Leaderboard />} />
            <Route path="profile" element={<Profile />} />
            <Route path="activities" element={<GlobalActivities />} />
            <Route path="play" element={<Play />} />
            <Route path="score" element={<Score />} />
            <Route path="teams" element={<TeamsHub />} />
            <Route path="teams/create" element={<CreateTeam />} />
            <Route path="teams/join" element={<JoinTeam />} />
            <Route path="teams/:teamId" element={<TeamDetail />} />
            <Route path="test" element={<Test />} />
            <Route path="shows/:id" element={<ShowDetail />} />
            {IS_TEST_MODE && (
              <>
                <Route path="firebase-test" element={<AdminRoute><FirebaseTest /></AdminRoute>} />
                <Route path="__testing/firebase" element={<AdminRoute><FirebaseTest /></AdminRoute>} />
              </>
            )}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
          {/* Full-screen pages (no main layout) */}
          <Route path="shows/:id/join" element={<JoinShow />} />
          <Route path="signup" element={<Signup />} />

          {/* Show pages with FAB overlay */}
          <Route path="shows/:id" element={<ShowLayout />}>
            <Route path="trivia" element={<Trivia />} />
            <Route path="activity" element={<Activity />} />
            <Route path="activities" element={<Activities />} />
            <Route path="activities/:activityId" element={<ActivityDetail />} />
          </Route>
        </Routes>
      </UserProvider>
    </BrowserRouter>
  );
}
