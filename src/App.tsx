import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { UserProvider } from './contexts/UserContext';

import Layout from './components/Layout';
import ShowLayout from './layouts/ShowLayout';
import AdminRoute from './components/AdminRoute';
import { clearStoredAuthAttempt, useAuthBootstrap } from './hooks/useAuthBootstrap';
import { IS_TEST_MODE } from './lib/mode';

const Home = lazy(() => import('./pages/Home'));
const ShowsPage = lazy(() => import('./features/shows/ShowsPage'));
const ShowDetail = lazy(() => import('./pages/ShowDetail'));
const JoinShow = lazy(() => import('./pages/JoinShow'));
const Signup = lazy(() => import('./pages/Signup'));
const Trivia = lazy(() => import('./pages/Trivia'));
const Activity = lazy(() => import('./pages/Activity'));
const Activities = lazy(() => import('./pages/Activities'));
const ActivityDetail = lazy(() => import('./pages/ActivityDetail'));
const GlobalActivities = lazy(() => import('./pages/GlobalActivities'));
const FirebaseTest = lazy(() => import('./pages/FirebaseTest'));
const JoinCurrentShow = lazy(() => import('./pages/JoinCurrentShow'));
const Scores = lazy(() => import('./pages/Scores'));
const Leaderboard = lazy(() => import('./pages/Leaderboard'));
const Profile = lazy(() => import('./pages/Profile'));
const Play = lazy(() => import('./pages/Play'));
const Score = lazy(() => import('./pages/Score'));
const TeamsHub = lazy(() => import('./pages/Teams').then((module) => ({ default: module.TeamsHub })));
const CreateTeam = lazy(() => import('./pages/Teams').then((module) => ({ default: module.CreateTeam })));
const JoinTeam = lazy(() => import('./pages/Teams').then((module) => ({ default: module.JoinTeam })));
const TeamDetail = lazy(() => import('./pages/Teams').then((module) => ({ default: module.TeamDetail })));
const Test = lazy(() => import('./pages/Test'));

function LoadingScreen({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="min-h-screen bg-cinema-900 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-cinema-400">{label}</p>
      </div>
    </div>
  );
}

export default function App() {
  const { authReady, authError, showErrorBanner, clearAuthError } = useAuthBootstrap();

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
                  clearStoredAuthAttempt();
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
                clearAuthError();
              }}
              className="text-white/80 hover:text-white"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        <Suspense fallback={<LoadingScreen />}>
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
            <Route path="shows/:id/join" element={<JoinShow />} />
            <Route path="signup" element={<Signup />} />

            <Route path="shows/:id" element={<ShowLayout />}>
              <Route path="trivia" element={<Trivia />} />
              <Route path="activity" element={<Activity />} />
              <Route path="activities" element={<Activities />} />
              <Route path="activities/:activityId" element={<ActivityDetail />} />
            </Route>
          </Routes>
        </Suspense>
      </UserProvider>
    </BrowserRouter>
  );
}
