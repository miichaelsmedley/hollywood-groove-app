import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { auth } from './lib/firebase';
import { handleRedirectResult, isGoogleAuthInProgress } from './lib/auth';
import { UserProvider } from './contexts/UserContext';

import Layout from './components/Layout';
import ShowLayout from './layouts/ShowLayout';
import AdminRoute from './components/AdminRoute';
import Home from './pages/Home';
import ShowsPage from './features/shows/ShowsPage';
import ShowDetail from './pages/ShowDetail';
import JoinShow from './pages/JoinShow';
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
import { IS_TEST_MODE } from './lib/mode';

// TEMPORARY: Mobile debugging console - remove after fixing auth
if (typeof window !== 'undefined') {
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/eruda';
  document.body.appendChild(script);
  script.onload = () => {
    (window as any).eruda?.init();
    console.log('📱 Mobile console loaded - tap the icon to view logs');
  };
}

export default function App() {
  // Handle auth initialization: redirect result first, then anonymous sign-in
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let isMounted = true;
    let hasProcessedInitialAuth = false;

    (async () => {
      // First, check for redirect result (Google sign-in completion)
      // This returns true if a redirect was processed (user is now signed in with Google)
      let redirectProcessed = false;
      try {
        redirectProcessed = await handleRedirectResult();
        console.log('Redirect result processed:', redirectProcessed);
      } catch (error) {
        console.error('Error handling redirect:', error);
      }

      // Only set up auth listener if component is still mounted
      if (!isMounted) return;

      // Set up auth state listener for anonymous sign-in fallback
      // But skip anonymous sign-in if we just processed a redirect or Google auth is in progress
      unsubscribe = onAuthStateChanged(auth, async (user) => {
        console.log('onAuthStateChanged fired:', user ? {
          uid: user.uid,
          isAnonymous: user.isAnonymous,
          email: user.email,
          providerData: user.providerData?.map(p => p.providerId),
        } : 'null');

        // Skip processing if we already handled the initial auth state
        if (hasProcessedInitialAuth && user) {
          console.log('Already processed initial auth, skipping');
          return;
        }

        if (!user) {
          // If Google auth is in progress, don't force anonymous sign-in
          if (isGoogleAuthInProgress()) {
            console.log('No user but Google auth in progress, skipping anonymous sign-in');
            return;
          }

          if (!redirectProcessed) {
            try {
              console.log('No user, signing in anonymously...');
              await signInAnonymously(auth);
            } catch (error) {
              console.error('Firebase auth error:', error);
            }
          }
        } else {
          hasProcessedInitialAuth = true;
          console.log('User signed in:', {
            uid: user.uid,
            isAnonymous: user.isAnonymous,
            email: user.email,
            providerData: user.providerData,
          });
        }
      });
    })();

    return () => {
      isMounted = false;
      unsubscribe?.();
    };
  }, []);

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
