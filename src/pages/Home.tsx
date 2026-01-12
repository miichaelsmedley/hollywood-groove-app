import { Link } from 'react-router-dom';
import { Music, Sparkles, List, FlaskConical, Brain } from 'lucide-react';
import { IS_TEST_MODE } from '../lib/mode';
import { useEffect, useState } from 'react';
import { useUser } from '../contexts/UserContext';
import { useTriviaHome } from '../lib/triviaLibraryService';
import { onValue, ref } from 'firebase/database';
import { db } from '../lib/firebase';
import { ShowMeta } from '../types/firebaseContract';

interface ActiveTestShow {
  showId: string;
  title: string;
}

export default function Home() {
  const { canUseTestMode } = useUser();
  const { schedule, remaining, loading: triviaLoading } = useTriviaHome();
  const [activeTestShow, setActiveTestShow] = useState<ActiveTestShow | null>(null);
  const [checkingTestShow, setCheckingTestShow] = useState(true);

  // Check for active test shows (only if user can use test mode)
  useEffect(() => {
    if (!canUseTestMode) {
      setCheckingTestShow(false);
      return;
    }

    // Listen to test shows path for active test shows
    const showsRef = ref(db, 'test/shows');

    const unsubscribe = onValue(
      showsRef,
      (snapshot) => {
        setCheckingTestShow(false);
        const data = snapshot.val();
        if (!data) {
          setActiveTestShow(null);
          return;
        }

        // Find any test show with actively running trivia or activity
        // Must have explicit active states - not just "not idle"
        for (const [showId, showData] of Object.entries(data) as [string, any][]) {
          const meta = showData?.meta as ShowMeta | undefined;
          const liveTrivia = showData?.live?.trivia;
          const phase = liveTrivia?.phase as string | undefined;
          // Trivia is active when in question, reveal, or countdown phases
          const activeTriviaPhases = ['question', 'reveal', 'countdown', 'answering'];
          const triviaActive = Boolean(phase && activeTriviaPhases.includes(phase));

          const liveActivity = showData?.live?.activity;
          const activityActive = liveActivity?.status === 'active';

          if (meta?.title && (triviaActive || activityActive)) {
            setActiveTestShow({ showId, title: meta.title });
            return;
          }
        }

        setActiveTestShow(null);
      },
      (err) => {
        console.warn('Failed to check for active test shows:', err);
        setCheckingTestShow(false);
        setActiveTestShow(null);
      }
    );

    return () => unsubscribe();
  }, [canUseTestMode]);

  const handleEnableTestMode = () => {
    // Set test mode in localStorage and reload
    localStorage.setItem('hg_test_mode', 'true');
    window.location.href = '/';
  };

  return (
    <div className="mx-auto max-w-md space-y-6">
      <section className="text-center space-y-3">
        <h1 className="text-4xl sm:text-5xl font-bold">
          Welcome to <span className="text-primary font-display">Hollywood Groove</span>
        </h1>
      </section>

      <section className="space-y-3">
        <Link
          to="/join"
          className="block w-full rounded-2xl bg-primary px-5 py-4 text-cinema font-bold shadow-glow-lg active:scale-[0.99] transition"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-lg leading-tight">Join current show</div>
              <div className="text-sm font-semibold opacity-80">Play trivia and see your score</div>
            </div>
            <Sparkles className="h-6 w-6" />
          </div>
        </Link>

        <Link
          to="/shows"
          className="block w-full rounded-2xl bg-cinema-50 border border-cinema-200 px-5 py-4 font-semibold text-cinema-900 hover:border-primary/60 transition"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-lg leading-tight">Shows</div>
              <div className="text-sm text-cinema-500">All shows (past and upcoming)</div>
            </div>
            <Music className="h-6 w-6 text-primary" />
          </div>
        </Link>

        <Link
          to="/activities"
          className="block w-full rounded-2xl bg-cinema-50 border border-cinema-200 px-5 py-4 font-semibold text-cinema-900 hover:border-primary/60 transition"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-lg leading-tight">Activities</div>
              <div className="text-sm text-cinema-500">Trivia, polls, and more</div>
            </div>
            <List className="h-6 w-6 text-primary" />
          </div>
        </Link>

        {/* Daily Trivia Button */}
        <Link
          to="/play"
          className="block w-full rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-4 text-white font-bold shadow-lg active:scale-[0.99] transition"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-lg leading-tight">Daily Trivia</div>
              <div className="text-sm font-semibold opacity-80">
                {triviaLoading ? (
                  'Loading...'
                ) : schedule ? (
                  `Today: ${schedule.theme_name}`
                ) : (
                  'Test your knowledge'
                )}
              </div>
              {!triviaLoading && remaining !== null && remaining > 0 && (
                <div className="text-xs opacity-70 mt-1">
                  {remaining} question{remaining !== 1 ? 's' : ''} left today
                </div>
              )}
              {!triviaLoading && remaining === 0 && (
                <div className="text-xs opacity-70 mt-1">
                  Come back tomorrow for more!
                </div>
              )}
            </div>
            <Brain className="h-6 w-6" />
          </div>
        </Link>

        {/* Tester Mode Entry Point - Only shows when test show is active */}
        {canUseTestMode && !checkingTestShow && activeTestShow && (
          !IS_TEST_MODE ? (
            <button
              onClick={handleEnableTestMode}
              className="block w-full rounded-2xl bg-purple-500/20 border border-purple-500/50 px-5 py-4 font-semibold text-purple-200 hover:border-purple-400/60 hover:bg-purple-500/30 transition text-left"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-lg leading-tight">Join Test Show</div>
                  <div className="text-sm text-purple-300/80">{activeTestShow.title}</div>
                </div>
                <FlaskConical className="h-6 w-6 text-purple-300" />
              </div>
            </button>
          ) : (
            <Link
              to={`/shows/${activeTestShow.showId}/join?test=true`}
              className="block w-full rounded-2xl bg-purple-600 px-5 py-4 text-white font-bold shadow-lg active:scale-[0.99] transition"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-lg leading-tight">Join Test Show</div>
                  <div className="text-sm font-semibold opacity-80">{activeTestShow.title}</div>
                </div>
                <FlaskConical className="h-6 w-6" />
              </div>
            </Link>
          )
        )}
      </section>
    </div>
  );
}
