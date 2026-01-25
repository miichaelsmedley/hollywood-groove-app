import { useState, useEffect } from 'react';
import { Link, NavLink, Outlet, useSearchParams } from 'react-router-dom';
import { Ticket, Music, Sparkles, BarChart3, Trophy, User, Home, Camera, ClipboardCheck, FlaskConical } from 'lucide-react';
import { ref, onValue } from 'firebase/database';
import { db } from '../lib/firebase';
import { useUser } from '../contexts/UserContext';
import { useUserRole } from '../hooks/useUserRole';
import ShareMoment from './ShareMoment';

interface ActiveTestShow {
  showId: string;
  title: string;
}

export default function Layout() {
  const [searchParams] = useSearchParams();
  const isTestMode = searchParams.get('test') === 'true';
  const { canUseTestMode } = useUser();
  const { canScoreActivities } = useUserRole();
  const [showShareModal, setShowShareModal] = useState(false);
  const [activeTestShow, setActiveTestShow] = useState<ActiveTestShow | null>(null);

  // Listen for active test shows
  useEffect(() => {
    if (!canUseTestMode) {
      setActiveTestShow(null);
      return;
    }

    const showsRef = ref(db, 'test/shows');
    const unsubscribe = onValue(showsRef, (snapshot) => {
      if (!snapshot.exists()) {
        setActiveTestShow(null);
        return;
      }

      const shows = snapshot.val();
      const now = Date.now();
      const thirtyMinutesAgo = now - 30 * 60 * 1000;

      // Find an active test show (trivia or activity updated recently)
      for (const [showId, showData] of Object.entries(shows)) {
        const show = showData as Record<string, unknown>;
        const meta = show.meta as Record<string, unknown> | undefined;
        const live = show.live as Record<string, unknown> | undefined;

        if (!meta?.title) continue;

        // Check if trivia is active
        const trivia = live?.trivia as Record<string, unknown> | undefined;
        if (trivia?.phase && trivia?.timestamp) {
          const timestamp = trivia.timestamp as number;
          if ((trivia.phase === 'question' || trivia.phase === 'answer') && timestamp > thirtyMinutesAgo) {
            setActiveTestShow({ showId, title: meta.title as string });
            return;
          }
        }

        // Check if activity is active
        const activity = live?.activity as Record<string, unknown> | undefined;
        if (activity?.status === 'active' && activity?.timestamp) {
          const timestamp = activity.timestamp as number;
          if (timestamp > thirtyMinutesAgo) {
            setActiveTestShow({ showId, title: meta.title as string });
            return;
          }
        }
      }

      setActiveTestShow(null);
    });

    return () => unsubscribe();
  }, [canUseTestMode]);

  // Helper to append test param to navigation paths
  const withTestParam = (path: string) => (isTestMode ? `${path}?test=true` : path);

  // Show permission row if user has scorer access OR there's an active test show
  const showPermissionRow = canScoreActivities || (canUseTestMode && activeTestShow);

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

      {/* Main Content - extra padding for permission row when visible */}
      <main className={`max-w-3xl mx-auto px-4 py-4 ${showPermissionRow ? 'pb-32' : 'pb-24'}`}>
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-cinema/95 backdrop-blur border-t border-cinema-200 pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-3xl mx-auto px-4">
          {/* Permission Row - conditional */}
          {showPermissionRow && (
            <div className="flex gap-1 py-1.5 border-b border-cinema-200">
              {/* Scorer button */}
              {canScoreActivities && (
                <NavLink
                  to={withTestParam('/score')}
                  className={({ isActive }) =>
                    [
                      'flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[9px] font-semibold border transition min-w-0',
                      isActive
                        ? 'bg-emerald-500 text-white border-emerald-500'
                        : 'bg-emerald-500/20 border-emerald-500/50 text-emerald-200 hover:bg-emerald-500/30',
                    ].join(' ')
                  }
                >
                  <ClipboardCheck className="w-3 h-3 shrink-0" />
                  <span className="truncate">Scorer</span>
                </NavLink>
              )}

              {/* Test Show button - only shows when there's an active test show */}
              {canUseTestMode && activeTestShow && (
                <Link
                  to={`/shows/${activeTestShow.showId}/join?test=true`}
                  className="flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[9px] font-semibold border transition bg-purple-500/20 border-purple-500/50 text-purple-200 hover:bg-purple-500 hover:text-white hover:border-purple-500 animate-pulse min-w-0"
                >
                  <FlaskConical className="w-3 h-3 shrink-0" />
                  <span className="truncate">Test Show</span>
                </Link>
              )}
            </div>
          )}

          {/* Main Navigation Row */}
          <div className="relative flex items-center justify-between py-1.5">
            {/* Left side: Home, Leaderboard */}
            <div className="flex gap-1 flex-1 min-w-0">
              <NavLink
                to={withTestParam('/')}
                end
                className={({ isActive }) =>
                  [
                    'flex flex-col items-center justify-center gap-0.5 rounded-lg px-1.5 py-1.5 text-[9px] font-semibold border transition flex-1 min-w-0',
                    isActive
                      ? 'bg-primary text-cinema border-primary shadow-glow'
                      : 'bg-cinema-50 text-cinema-800 border-cinema-200 hover:border-primary/60',
                  ].join(' ')
                }
              >
                <Home className="w-4 h-4 shrink-0" />
                <span className="truncate">Home</span>
              </NavLink>

              <NavLink
                to={withTestParam('/leaderboard')}
                className={({ isActive }) =>
                  [
                    'flex flex-col items-center justify-center gap-0.5 rounded-lg px-1.5 py-1.5 text-[9px] font-semibold border transition flex-1 min-w-0',
                    isActive
                      ? 'bg-primary text-cinema border-primary shadow-glow'
                      : 'bg-cinema-50 text-cinema-800 border-cinema-200 hover:border-primary/60',
                  ].join(' ')
                }
              >
                <Trophy className="w-4 h-4 shrink-0" />
                <span className="truncate">Ranks</span>
              </NavLink>
            </div>

            {/* Center: Share FAB */}
            <div className="relative mx-1 shrink-0">
              <button
                onClick={() => setShowShareModal(true)}
                className="w-12 h-12 -mt-3 rounded-full flex flex-col items-center justify-center bg-gradient-to-r from-primary to-pink-500 text-white shadow-lg shadow-primary/30 hover:scale-105 active:scale-95 transition-transform"
              >
                <Camera className="w-5 h-5" />
                <span className="text-[7px] font-bold mt-0.5">Share</span>
              </button>
            </div>

            {/* Right side: Scores, Profile */}
            <div className="flex gap-1 flex-1 min-w-0">
              <NavLink
                to={withTestParam('/scores')}
                className={({ isActive }) =>
                  [
                    'flex flex-col items-center justify-center gap-0.5 rounded-lg px-1.5 py-1.5 text-[9px] font-semibold border transition flex-1 min-w-0',
                    isActive
                      ? 'bg-primary text-cinema border-primary shadow-glow'
                      : 'bg-cinema-50 text-cinema-800 border-cinema-200 hover:border-primary/60',
                  ].join(' ')
                }
              >
                <BarChart3 className="w-4 h-4 shrink-0" />
                <span className="truncate">Scores</span>
              </NavLink>

              <NavLink
                to={withTestParam('/profile')}
                className={({ isActive }) =>
                  [
                    'flex flex-col items-center justify-center gap-0.5 rounded-lg px-1.5 py-1.5 text-[9px] font-semibold border transition flex-1 min-w-0',
                    isActive
                      ? 'bg-primary text-cinema border-primary shadow-glow'
                      : 'bg-cinema-50 text-cinema-800 border-cinema-200 hover:border-primary/60',
                  ].join(' ')
                }
              >
                <User className="w-4 h-4 shrink-0" />
                <span className="truncate">Profile</span>
              </NavLink>
            </div>
          </div>
        </div>
      </nav>

      {/* Share Modal */}
      {showShareModal && (
        <ShareMoment
          showName="Hollywood Groove"
          onClose={() => setShowShareModal(false)}
          onShareComplete={() => setShowShareModal(false)}
        />
      )}
    </div>
  );
}
