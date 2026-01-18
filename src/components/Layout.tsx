import { Link, NavLink, Outlet, useSearchParams } from 'react-router-dom';
import { Ticket, Music, Sparkles, BarChart3, Trophy, User } from 'lucide-react';

export default function Layout() {
  const [searchParams] = useSearchParams();
  const isTestMode = searchParams.get('test') === 'true';

  // Helper to append test param to navigation paths
  const withTestParam = (path: string) => (isTestMode ? `${path}?test=true` : path);

  return (
    <div className="min-h-screen bg-cinema text-cinema-900">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-cinema/90 backdrop-blur border-b border-cinema-200">
        <div className="max-w-3xl mx-auto px-4 pt-3 pb-2">
          {/* Logo Bar - subtle grey background, clickable to home */}
          <Link
            to="/"
            className="flex items-center justify-center gap-2 py-2 -mx-4 px-4 bg-cinema-50/20 hover:bg-cinema-50/30 transition"
          >
            <Music className="w-9 h-9 text-primary" />
            <span className="text-xl font-bold font-display">Hollywood Groove</span>
          </Link>

          <nav className="mt-2 grid grid-cols-3 gap-1.5">
            <NavLink
              to={withTestParam('/shows')}
              className={({ isActive }) =>
                [
                  'flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold border transition',
                  isActive
                    ? 'bg-primary text-cinema border-primary shadow-glow'
                    : 'bg-cinema-50 text-cinema-800 border-cinema-200 hover:border-primary/60',
                ].join(' ')
              }
            >
              <Music className="w-3.5 h-3.5" />
              <span>Shows</span>
            </NavLink>

            <NavLink
              to={withTestParam('/upcoming')}
              className={({ isActive }) =>
                [
                  'flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold border transition',
                  isActive
                    ? 'bg-primary text-cinema border-primary shadow-glow'
                    : 'bg-cinema-50 text-cinema-800 border-cinema-200 hover:border-primary/60',
                ].join(' ')
              }
            >
              <Ticket className="w-3.5 h-3.5" />
              <span>Tickets</span>
            </NavLink>

            <NavLink
              to={withTestParam('/join')}
              className={({ isActive }) =>
                [
                  'flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold border transition',
                  isActive
                    ? 'bg-primary text-cinema border-primary shadow-glow'
                    : 'bg-cinema-50 text-cinema-800 border-cinema-200 hover:border-primary/60',
                ].join(' ')
              }
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Join</span>
            </NavLink>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 py-4 pb-20">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-cinema/95 backdrop-blur border-t border-cinema-200 pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-3xl mx-auto px-4">
          <div className="grid grid-cols-3 gap-1.5 py-1.5">
            <NavLink
              to={withTestParam('/scores')}
              className={({ isActive }) =>
                [
                  'flex flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-1.5 text-[10px] font-semibold border transition',
                  isActive
                    ? 'bg-primary text-cinema border-primary shadow-glow'
                    : 'bg-cinema-50 text-cinema-800 border-cinema-200 hover:border-primary/60',
                ].join(' ')
              }
            >
              <BarChart3 className="w-4 h-4" />
              <span>Scores</span>
            </NavLink>

            <NavLink
              to={withTestParam('/leaderboard')}
              className={({ isActive }) =>
                [
                  'flex flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-1.5 text-[10px] font-semibold border transition',
                  isActive
                    ? 'bg-primary text-cinema border-primary shadow-glow'
                    : 'bg-cinema-50 text-cinema-800 border-cinema-200 hover:border-primary/60',
                ].join(' ')
              }
            >
              <Trophy className="w-4 h-4" />
              <span>Leaderboard</span>
            </NavLink>

            <NavLink
              to={withTestParam('/profile')}
              className={({ isActive }) =>
                [
                  'flex flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-1.5 text-[10px] font-semibold border transition',
                  isActive
                    ? 'bg-primary text-cinema border-primary shadow-glow'
                    : 'bg-cinema-50 text-cinema-800 border-cinema-200 hover:border-primary/60',
                ].join(' ')
              }
            >
              <User className="w-4 h-4" />
              <span>Profile</span>
            </NavLink>
          </div>
        </div>
      </nav>
    </div>
  );
}
