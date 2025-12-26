import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { auth } from './lib/firebase';
import { UserProvider } from './contexts/UserContext';

import Layout from './components/Layout';
import Home from './pages/Home';
import ShowsPage from './features/shows/ShowsPage';
import ShowDetail from './pages/ShowDetail';
import JoinShow from './pages/JoinShow';
import Trivia from './pages/Trivia';
import Activity from './pages/Activity';
import FirebaseTest from './pages/FirebaseTest';
import JoinCurrentShow from './pages/JoinCurrentShow';
import Scores from './pages/Scores';
import Leaderboard from './pages/Leaderboard';
import Profile from './pages/Profile';
import { IS_TEST_MODE } from './lib/mode';

export default function App() {
  // Auto sign-in anonymously for Firebase RTDB access
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        try {
          await signInAnonymously(auth);
        } catch (error) {
          console.error('Firebase auth error:', error);
        }
      }
    });

    return () => unsubscribe();
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
            <Route path="shows/:id" element={<ShowDetail />} />
            {IS_TEST_MODE && (
              <>
                <Route path="firebase-test" element={<FirebaseTest />} />
                <Route path="__testing/firebase" element={<FirebaseTest />} />
              </>
            )}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
          {/* Full-screen pages (no layout) */}
          <Route path="shows/:id/join" element={<JoinShow />} />
          <Route path="shows/:id/trivia" element={<Trivia />} />
          <Route path="shows/:id/activity" element={<Activity />} />
        </Routes>
      </UserProvider>
    </BrowserRouter>
  );
}
