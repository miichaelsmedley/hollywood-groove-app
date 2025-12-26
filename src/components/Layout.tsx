import { Link, NavLink, Outlet } from 'react-router-dom';
import { Calendar, Music, Sparkles, BarChart3, Trophy, User } from 'lucide-react';

export default function Layout() {
  return (
    <div className="min-h-screen bg-cinema text-cinema-900">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-cinema/90 backdrop-blur border-b border-cinema-200">
        <div className="max-w-3xl mx-auto px-4 pt-4 pb-3">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <Music className="w-7 h-7 text-primary" />
              <span className="text-lg font-bold font-display">Hollywood Groove</span>
            </Link>
          </div>

          <nav className="mt-3 grid grid-cols-3 gap-2">
            <NavLink
              to="/shows"
              className={({ isActive }) =>
                [
                  'flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold border transition',
                  isActive
                    ? 'bg-primary text-cinema border-primary shadow-glow'
                    : 'bg-cinema-50 text-cinema-800 border-cinema-200 hover:border-primary/60',
                ].join(' ')
              }
            >
              <Music className="w-4 h-4" />
              <span>Shows</span>
            </NavLink>

            <NavLink
              to="/upcoming"
              className={({ isActive }) =>
                [
                  'flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold border transition',
                  isActive
                    ? 'bg-primary text-cinema border-primary shadow-glow'
                    : 'bg-cinema-50 text-cinema-800 border-cinema-200 hover:border-primary/60',
                ].join(' ')
              }
            >
              <Calendar className="w-4 h-4" />
              <span>Upcoming</span>
            </NavLink>

            <NavLink
              to="/join"
              className={({ isActive }) =>
                [
                  'flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold border transition',
                  isActive
                    ? 'bg-primary text-cinema border-primary shadow-glow'
                    : 'bg-cinema-50 text-cinema-800 border-cinema-200 hover:border-primary/60',
                ].join(' ')
              }
            >
              <Sparkles className="w-4 h-4" />
              <span>Join</span>
            </NavLink>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 py-6 pb-24">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-cinema/95 backdrop-blur border-t border-cinema-200 pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-3xl mx-auto px-4">
          <div className="grid grid-cols-3 gap-2 py-2">
            <NavLink
              to="/scores"
              className={({ isActive }) =>
                [
                  'flex flex-col items-center justify-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold border transition',
                  isActive
                    ? 'bg-primary text-cinema border-primary shadow-glow'
                    : 'bg-cinema-50 text-cinema-800 border-cinema-200 hover:border-primary/60',
                ].join(' ')
              }
            >
              <BarChart3 className="w-5 h-5" />
              <span>Scores</span>
            </NavLink>

            <NavLink
              to="/leaderboard"
              className={({ isActive }) =>
                [
                  'flex flex-col items-center justify-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold border transition',
                  isActive
                    ? 'bg-primary text-cinema border-primary shadow-glow'
                    : 'bg-cinema-50 text-cinema-800 border-cinema-200 hover:border-primary/60',
                ].join(' ')
              }
            >
              <Trophy className="w-5 h-5" />
              <span>Leaderboard</span>
            </NavLink>

            <NavLink
              to="/profile"
              className={({ isActive }) =>
                [
                  'flex flex-col items-center justify-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold border transition',
                  isActive
                    ? 'bg-primary text-cinema border-primary shadow-glow'
                    : 'bg-cinema-50 text-cinema-800 border-cinema-200 hover:border-primary/60',
                ].join(' ')
              }
            >
              <User className="w-5 h-5" />
              <span>Profile</span>
            </NavLink>
          </div>
        </div>
      </nav>
    </div>
  );
}
