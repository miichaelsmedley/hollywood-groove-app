import { useMemo } from 'react';
import { Calendar } from 'lucide-react';
import ShowCard from './ShowCard';
import { useUpcomingShows } from '../../lib/useUpcomingShows';

type ShowsPageMode = 'all' | 'upcoming';

// Events list. Backed by the unified feed (useUpcomingShows) so ticketed gigs
// that live only in the Firestore ticketing ledger appear here too — not just
// shows published to RTDB from the Mac Controller.
export default function ShowsPage({ mode = 'upcoming' }: { mode?: ShowsPageMode }) {
  const { rows, loading } = useUpcomingShows();

  const shows = useMemo(() => {
    const now = Date.now();
    const filtered =
      mode === 'upcoming'
        ? rows.filter(
            (row) => row.isLive || (row.startDate ? row.startDate.getTime() >= now : false),
          )
        : rows;

    if (mode === 'all') {
      // Most-recent first for the full archive view.
      return [...filtered].sort((a, b) => {
        if (a.isLive && !b.isLive) return -1;
        if (!a.isLive && b.isLive) return 1;
        const aT = a.startDate ? a.startDate.getTime() : 0;
        const bT = b.startDate ? b.startDate.getTime() : 0;
        return bT - aT;
      });
    }
    // 'upcoming' is already live-first then soonest-first from the hook.
    return filtered;
  }, [rows, mode]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-gray-400">Loading shows…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{mode === 'upcoming' ? 'Upcoming events' : 'Shows'}</h1>
          <p className="text-cinema-500 mt-1 text-sm">
            {shows.length} {shows.length === 1 ? 'show' : 'shows'}
          </p>
        </div>
      </div>

      {/* Shows Grid */}
      {shows.length === 0 ? (
        <div className="text-center py-16">
          <Calendar className="w-16 h-16 text-cinema-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-cinema-800 mb-2">
            {mode === 'upcoming' ? 'No upcoming events' : 'No shows yet'}
          </h3>
          <p className="text-cinema-500 mb-6 text-sm">
            Shows will appear here once they're published from the Mac Controller.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {shows.map((show) => (
            <ShowCard
              key={show.showId}
              showId={show.showId}
              title={show.meta.title}
              startDate={show.meta.startDate}
              venueName={show.meta.venueName}
              isLive={show.isLive}
              ticketUrl={show.meta.ticketUrl}
            />
          ))}
        </div>
      )}
    </div>
  );
}
