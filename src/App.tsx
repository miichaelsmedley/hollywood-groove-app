import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, signInAnonymously, onIdTokenChanged } from 'firebase/auth';
import { auth, authPersistenceReady } from './lib/firebase';
import { handleRedirectResult, isGoogleAuthInProgress, RedirectResult } from './lib/auth';
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
      try {
        console.log('🔐 Processing redirect result...');
        redirectResult = await handleRedirectResult();
        console.log('📋 Redirect result:', redirectResult);

        // Show error to user if redirect failed
        if (!redirectResult.success && redirectResult.error) {
          console.error('❌ Auth redirect failed:', redirectResult.error);
          setAuthError('Sign-in failed. Please try again.');
        }
      } catch (error) {
        console.error('❌ Error handling redirect:', error);
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

      // Set up auth state listener for anonymous sign-in fallback
      // This only runs if user is NOT already signed in with Google
      unsubscribe = onAuthStateChanged(auth, async (user) => {
        console.log('onAuthStateChanged fired:', user ? {
          uid: user.uid,
          isAnonymous: user.isAnonymous,
          email: user.email,
          providerData: user.providerData?.map(p => p.providerId),
        } : 'null');

        if (!user) {
          // CRITICAL: Don't sign in anonymously if Google auth might be in progress
          if (isGoogleAuthInProgress()) {
            console.log('⏳ No user but Google auth in progress, waiting...');
            setAuthReady(true);
            return;
          }

          // Double-check: if we just returned from a redirect, wait a bit more
          // Auth state restoration can be delayed on some mobile browsers
          if (redirectResult.wasRedirectPending) {
            console.log('⏳ Redirect was pending, giving extra time for auth restoration...');
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Recheck after delay
            if (auth.currentUser) {
              console.log('✅ User appeared after delay:', auth.currentUser.uid);
              setAuthReady(true);
              return;
            }
          }

          // No user and no redirect in progress - sign in anonymously
          try {
            console.log('👤 No user, signing in anonymously...');
            await signInAnonymously(auth);
          } catch (error) {
            console.error('Firebase auth error:', error);
            setAuthError('Authentication failed. Please refresh the page.');
          }
        } else {
          console.log('✅ User signed in:', {
            uid: user.uid,
            isAnonymous: user.isAnonymous,
            email: user.email,
            providerData: user.providerData,
          });
        }

        // Mark auth as ready once we have a user or have processed the state
        setAuthReady(true);
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
            <p className="text-red-400 mt-4 text-sm">{authError}</p>
          )}
        </div>
      </div>
    );
  }

  // If there's an auth error but we're ready, show it briefly then continue
  // The error will clear when user successfully authenticates

  return (
    <BrowserRouter>
      <UserProvider>
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
