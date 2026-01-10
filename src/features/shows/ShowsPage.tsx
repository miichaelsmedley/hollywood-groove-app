import { useState, useEffect } from 'react';
import { onValue, ref } from 'firebase/database';
import { db } from '../../lib/firebase';
import { ShowMeta } from '../../types/firebaseContract';
import ShowCard from './ShowCard';
import { Calendar, AlertCircle } from 'lucide-react';

interface ShowData {
  showId: string;
  meta: ShowMeta;
  isLive: boolean;
}

type ShowsPageMode = 'all' | 'upcoming';

export default function ShowsPage({ mode = 'upcoming' }: { mode?: ShowsPageMode }) {
  const [shows, setShows] = useState<ShowData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Listen to all shows in Firebase
    const showsRef = ref(db, 'shows');

    const unsubscribe = onValue(
      showsRef,
      (snapshot) => {
        setLoading(false);
        setError(null);

        const data = snapshot.val();

        if (!data) {
          setShows([]);
          return;
        }

        // Convert Firebase object to array
        const showsArray: ShowData[] = Object.entries(data).map(([showId, showData]: [string, any]) => {
          // Check if show is live
          const liveTrivia = showData.live?.trivia;
          const isLive = liveTrivia && liveTrivia.phase !== 'idle';

          return {
            showId,
            meta: showData.meta as ShowMeta,
            isLive,
          };
        });

        // Filter shows that have meta data
        const validShows = showsArray.filter((show) => show.meta && show.meta.title);

        const now = Date.now();
        const filteredShows =
          mode === 'upcoming'
            ? validShows.filter((show) => {
                const startTime = new Date(show.meta.startDate).getTime();
                const isUpcoming = Number.isFinite(startTime) ? startTime >= now : false;
                return show.isLive || isUpcoming;
              })
            : validShows;

        // Sort by start date; keep live show(s) first
        filteredShows.sort((a, b) => {
          if (a.isLive && !b.isLive) return -1;
          if (!a.isLive && b.isLive) return 1;

          const dateA = new Date(a.meta.startDate).getTime();
          const dateB = new Date(b.meta.startDate).getTime();
          if (!Number.isFinite(dateA) || !Number.isFinite(dateB)) return 0;

          return mode === 'upcoming' ? dateA - dateB : dateB - dateA;
        });

        setShows(filteredShows);
      },
      (err) => {
        setLoading(false);
        setError(err.message);
        console.error('Firebase read error:', err);
      }
    );

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-gray-400">Loading shows from Firebase...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4 max-w-md">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto" />
          <h3 className="text-xl font-semibold text-red-400">Firebase Error</h3>
          <p className="text-gray-400">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-gray-900 font-semibold rounded-lg hover:bg-primary-600 transition-colors"
          >
            Retry
          </button>
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
              // These fields might not be in ShowMeta yet - extend the type if needed
              // venueAddress=""
              // ticketUrl=""
              // capacity={0}
            />
          ))}
        </div>
      )}
    </div>
  );
}
