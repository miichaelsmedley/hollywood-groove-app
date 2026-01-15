import { Link } from 'react-router-dom';
import { Calendar, MapPin, ExternalLink, Users } from 'lucide-react';

interface ShowCardProps {
  showId: string;
  title: string;
  startDate: string;
  venueName: string;
  venueAddress?: string;
  ticketUrl?: string;
  capacity?: number;
  isLive?: boolean;
}

export default function ShowCard({
  showId,
  title,
  startDate,
  venueName,
  venueAddress,
  ticketUrl,
  capacity,
  isLive = false,
}: ShowCardProps) {
  const startDateTime = new Date(startDate);
  const isUpcoming = startDateTime > new Date();

  return (
    <Link
      to={`/shows/${showId}`}
      className="block bg-gray-900 rounded-lg p-6 border-2 border-gray-800 hover:border-primary transition-all transform hover:scale-[1.02] relative overflow-hidden"
    >
      {/* Live Badge */}
      {isLive && (
        <div className="absolute top-0 right-0 bg-gradient-to-br from-red-500 to-primary px-4 py-1 rounded-bl-lg">
          <div className="flex items-center space-x-2">
            <div className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
            </div>
            <span className="text-xs font-bold text-white uppercase tracking-wide">LIVE NOW</span>
          </div>
        </div>
      )}

      {/* Show Title */}
      <h2 className="text-xl font-bold mb-4 pr-20">{title}</h2>

      {/* Details */}
      <div className="space-y-3 text-sm">
        {/* Date/Time */}
        <div className="flex items-start space-x-3">
          <Calendar className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-gray-300 font-medium">
              {startDateTime.toLocaleDateString('en-AU', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </div>
            <div className="text-gray-400 text-xs">
              {startDateTime.toLocaleTimeString('en-AU', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
          </div>
        </div>

        {/* Venue */}
        <div className="flex items-start space-x-3">
          <MapPin className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-gray-300 font-medium">{venueName}</div>
            {venueAddress && (
              <div className="text-gray-400 text-xs">{venueAddress}</div>
            )}
          </div>
        </div>

        {/* Capacity */}
        {capacity && (
          <div className="flex items-center space-x-3">
            <Users className="w-5 h-5 text-primary flex-shrink-0" />
            <span className="text-gray-400 text-xs">
              Capacity: {capacity.toLocaleString()} guests
            </span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-6 pt-4 border-t border-gray-800 flex items-center justify-between">
        <div>
          {isUpcoming ? (
            <span className="text-xs text-green-400 font-medium">Upcoming Event</span>
          ) : (
            <span className="text-xs text-gray-500 font-medium">Past Event</span>
          )}
        </div>

        {ticketUrl && isUpcoming && (
          <a
            href={ticketUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center space-x-1 text-primary text-sm font-medium hover:text-primary/80 transition"
          >
            <ExternalLink className="w-4 h-4" />
            <span>Buy Tickets</span>
          </a>
        )}
      </div>
    </Link>
  );
}
