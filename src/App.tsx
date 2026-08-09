import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import LoadingScreen from './components/ui/LoadingScreen';
import { getLatestWeeklyEpisode } from './features/weekly/episodeCatalog';

const AuthenticatedApp = lazy(() => import('./AuthenticatedApp'));
const WeeklyEpisodePage = lazy(() => import('./features/weekly/WeeklyEpisodePage'));

const latestEpisodePath = `/weekly/${getLatestWeeklyEpisode().slug}`;

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Suspense fallback={<LoadingScreen />}>
          <Routes>
            <Route path="weekly" element={<Navigate to={latestEpisodePath} replace />} />
            <Route path="weekly/:slug" element={<WeeklyEpisodePage />} />
            <Route path="watch/:slug" element={<WeeklyEpisodePage />} />
            <Route path="*" element={<AuthenticatedApp />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
