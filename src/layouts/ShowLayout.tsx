import { Outlet, useParams, useSearchParams } from 'react-router-dom';
import { ShowProvider } from '../contexts/ShowContext';

/**
 * Layout wrapper for show-related pages (Trivia, Activity).
 * Provides ShowContext. Individual pages render their own ActionBar.
 */
export default function ShowLayout() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const showId = id ? Number(id) : null;
  const isTestShow = searchParams.get('test') === 'true';

  if (!showId || isNaN(showId)) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center">
        <p className="text-gray-400">Invalid show ID</p>
      </div>
    );
  }

  return (
    <ShowProvider showId={showId} isTestShow={isTestShow}>
      <Outlet />
    </ShowProvider>
  );
}
