import { Link, Outlet, useParams, useSearchParams } from 'react-router-dom';
import { ShowProvider } from '../contexts/ShowContext';
import MomentOverlay from '../components/show/MomentOverlay';
import RealtimeConnectionPill from '../components/show/RealtimeConnectionPill';
import WinnerAnnouncementOverlay from '../components/show/WinnerAnnouncementOverlay';
import ShowOfferRewards from '../components/offers/ShowOfferRewards';
import DanceWindowBanner from '../components/show/DanceWindowBanner';
import CallupTakeover from '../components/show/CallupTakeover';

/**
 * Layout wrapper for show-related pages (Trivia, Activity).
 * Provides ShowContext. Individual pages render their own ActionBar.
 */
export default function ShowLayout() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const showId = id?.trim() || null;
  const isTestShow = searchParams.get('test') === 'true';

  if (!showId) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center">
        <div className="space-y-4 text-center">
          <p className="text-gray-400">Invalid show ID</p>
          <Link to="/shows" className="inline-flex rounded-lg bg-primary px-4 py-2 font-semibold text-cinema">
            Back to shows
          </Link>
        </div>
      </div>
    );
  }

  return (
    <ShowProvider showId={showId} isTestShow={isTestShow}>
      <RealtimeConnectionPill />
      <Outlet />
      <DanceWindowBanner />
      <ShowOfferRewards showId={showId} isTestShow={isTestShow} floating />
      <CallupTakeover />
      <MomentOverlay />
      <WinnerAnnouncementOverlay />
    </ShowProvider>
  );
}
