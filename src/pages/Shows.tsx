import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, MapPin, ExternalLink } from 'lucide-react';

// Placeholder for WordPress API integration
interface Show {
  id: number;
  title: string;
  startDate: string;
  venueName: string;
  venueAddress?: string;
  ticketUrl?: string;
  capacity?: number;
}

export default function Shows() {
  const [shows, setShows] = useState<Show[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Fetch from WordPress REST API
    // For now, using mock data
    setTimeout(() => {
      setShows([
        {
          id: 101,
          title: 'The Adele Show - New Year Bash',
          startDate: '2025-12-31T20:00:00',
          venueName: 'The Grand Ballroom',
          venueAddress: 'Melbourne, VIC',
          ticketUrl: 'https://hollywoodgroove.com.au/tickets',
          capacity: 500,
        },
        {
          id: 102,
          title: 'Summer Vibes DJ Night',
          startDate: '2026-01-15T19:30:00',
          venueName: 'Beach Club',
          venueAddress: 'St Kilda, VIC',
          capacity: 300,
        },
      ]);
      setLoading(false);
    }, 500);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-gray-400">Loading shows...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Upcoming Shows</h1>
      </div>

      {shows.length === 0 ? (
        <div className="text-center py-12">
          <Calendar className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-400 mb-2">No shows scheduled</h3>
          <p className="text-gray-500">Check back soon for upcoming events!</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {shows.map((show) => (
            <Link
              key={show.id}
              to={`/shows/${show.id}`}
              className="bg-gray-900 rounded-lg p-6 border border-gray-800 hover:border-primary transition-colors"
            >
              <h2 className="text-xl font-semibold mb-4">{show.title}</h2>

              <div className="space-y-2 text-sm text-gray-400">
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4" />
                  <span>{new Date(show.startDate).toLocaleDateString('en-AU', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}</span>
                </div>

                <div className="flex items-center space-x-2">
                  <MapPin className="w-4 h-4" />
                  <span>
                    {show.venueName}
                    {show.venueAddress && ` • ${show.venueAddress}`}
                  </span>
                </div>

                {show.capacity && (
                  <div className="text-xs text-gray-500">
                    Capacity: {show.capacity} guests
                  </div>
                )}
              </div>

              {show.ticketUrl && (
                <div className="mt-4 pt-4 border-t border-gray-800">
                  <span className="inline-flex items-center space-x-1 text-primary text-sm font-medium">
                    <ExternalLink className="w-4 h-4" />
                    <span>Get Tickets</span>
                  </span>
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
