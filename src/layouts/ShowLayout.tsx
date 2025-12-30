import { Outlet, useParams } from 'react-router-dom';
import { ShowProvider } from '../contexts/ShowContext';
import ShowFAB from '../components/show/ShowFAB';

/**
 * Layout wrapper for show-related pages (Trivia, Activity).
 * Provides ShowContext and renders floating action buttons.
 */
export default function ShowLayout() {
  const { id } = useParams<{ id: string }>();
  const showId = id ? Number(id) : null;

  if (!showId || isNaN(showId)) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center">
        <p className="text-gray-400">Invalid show ID</p>
      </div>
    );
  }

  return (
    <ShowProvider showId={showId}>
      <Outlet />
      <ShowFAB />
    </ShowProvider>
  );
}
