import { Link } from 'react-router-dom';
import { Music, Sparkles, List, FlaskConical, Brain, ClipboardCheck } from 'lucide-react';
import { IS_TEST_MODE } from '../lib/mode';
import { useEffect, useState } from 'react';
import { useUser } from '../contexts/UserContext';
import { useUserRole } from '../hooks/useUserRole';
import { useTriviaHome } from '../lib/triviaLibraryService';
import { onValue, ref } from 'firebase/database';
import { db } from '../lib/firebase';
import { ShowMeta } from '../types/firebaseContract';
import ShareButton from '../components/ShareButton';

interface ActiveTestShow {
  showId: string;
  title: string;
}

export default function Home() {
  const { canUseTestMode } = useUser();
  const { canScoreActivities } = useUserRole();
  const { schedule, remaining, availableQuestions, loading: triviaLoading } = useTriviaHome();
  const [activeTestShow, setActiveTestShow] = useState<ActiveTestShow | null>(null);
  const [checkingTestShow, setCheckingTestShow] = useState(true);

  // Check for active test shows (only if user can use test mode)
  useEffect(() => {
    console.log('🧪 Home: canUseTestMode =', canUseTestMode);

    if (!canUseTestMode) {
      console.log('🧪 Home: User cannot use test mode, skipping test show check');
      setCheckingTestShow(false);
      return;
    }

    // Listen to test shows path for active test shows
    const showsRef = ref(db, 'test/shows');
    console.log('🧪 Home: Listening to test/shows for active test shows');

    const unsubscribe = onValue(
      showsRef,
      (snapshot) => {
        setCheckingTestShow(false);
        const data = snapshot.val();
        console.log('🧪 Home: Received test/shows data:', data);

        if (!data) {
          console.log('🧪 Home: No test shows data found');
          setActiveTestShow(null);
          return;
        }

        // Find any test show with actively running trivia or activity
        // Must have explicit active states AND recent updates (within last 30 minutes)
        const MAX_STALE_MS = 30 * 60 * 1000; // 30 minutes
        const now = Date.now();

        for (const [showId, showData] of Object.entries(data) as [string, any][]) {
          const meta = showData?.meta as ShowMeta | undefined;
          const liveTrivia = showData?.live?.trivia;
          const phase = liveTrivia?.phase as string | undefined;

          // Check timestamps - prefer updatedAt, fall back to startedAt
          const triviaUpdatedAt = liveTrivia?.updatedAt as number | undefined;
          const triviaStartedAt = liveTrivia?.startedAt as number | undefined;
          const triviaTimestamp = triviaUpdatedAt || triviaStartedAt;

          // Check if trivia data is stale (older than 30 minutes)
          const isTriviaStale = !triviaTimestamp || (now - triviaTimestamp) > MAX_STALE_MS;

          // Trivia is active when in question or answer phases AND not stale
          // Per firebaseContract.ts: TriviaPhase = 'idle' | 'question' | 'answer'
          const activeTriviaPhases = ['question', 'answer'];
          const triviaActive = Boolean(
            phase &&
            activeTriviaPhases.includes(phase) &&
            !isTriviaStale
          );

          const liveActivity = showData?.live?.activity;
          const activityUpdatedAt = liveActivity?.updatedAt as number | undefined;
          const activityStartedAt = liveActivity?.startedAt as number | undefined;
          const activityTimestamp = activityUpdatedAt || activityStartedAt;
          const isActivityStale = !activityTimestamp || (now - activityTimestamp) > MAX_STALE_MS;
          const activityActive = liveActivity?.status === 'active' && !isActivityStale;

          console.log(`🧪 Home: Show ${showId} check:`, {
            meta,
            phase,
            triviaTimestamp,
            isTriviaStale,
            triviaActive,
            activityActive,
            hasTitle: Boolean(meta?.title),
          });

          if (meta?.title && (triviaActive || activityActive)) {
            console.log(`🧪 Home: Found active test show: ${showId} - ${meta.title}`);
            setActiveTestShow({ showId, title: meta.title });
            return;
          }
        }

        console.log('🧪 Home: No active test shows found (all either missing title, inactive, or stale)');
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
      <section className="text-center space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold">
          Welcome to <span className="text-primary font-display">Hollywood Groove</span>
        </h1>
      </section>

      <section className="space-y-2">
        <Link
          to="/join"
          className="block w-full rounded-xl bg-primary px-4 py-2.5 text-cinema font-bold shadow-glow-lg active:scale-[0.99] transition"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-base leading-tight">Join current show</div>
              <div className="text-xs font-semibold opacity-80">Play trivia and see your score</div>
            </div>
            <Sparkles className="h-5 w-5" />
          </div>
        </Link>

        <Link
          to="/shows"
          className="block w-full rounded-xl bg-cinema-50 border border-cinema-200 px-4 py-2.5 font-semibold text-cinema-900 hover:border-primary/60 transition"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-base leading-tight">Shows</div>
              <div className="text-xs text-cinema-500">All shows (past and upcoming)</div>
            </div>
            <Music className="h-5 w-5 text-primary" />
          </div>
        </Link>

        <Link
          to="/activities"
          className="block w-full rounded-xl bg-cinema-50 border border-cinema-200 px-4 py-2.5 font-semibold text-cinema-900 hover:border-primary/60 transition"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-base leading-tight">Activities</div>
              <div className="text-xs text-cinema-500">Trivia, polls, and more</div>
            </div>
            <List className="h-5 w-5 text-primary" />
          </div>
        </Link>

        {/* Daily Trivia Button */}
        <Link
          to="/play"
          className={`block w-full rounded-xl px-4 py-2.5 text-white font-bold shadow-lg active:scale-[0.99] transition ${
            !triviaLoading && availableQuestions === 0
              ? 'bg-gradient-to-r from-gray-600 to-gray-500'
              : 'bg-gradient-to-r from-purple-600 to-pink-600'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-base leading-tight">Daily Trivia</div>
              <div className="text-xs font-semibold opacity-80">
                {triviaLoading ? (
                  'Loading...'
                ) : availableQuestions === 0 ? (
                  'No trivia scheduled today'
                ) : schedule ? (
                  `Today: ${schedule.theme_name}`
                ) : (
                  'Test your knowledge'
                )}
              </div>
              {!triviaLoading && availableQuestions > 0 && remaining !== null && remaining > 0 && (
                <div className="text-[10px] opacity-70 mt-0.5">
                  {remaining} question{remaining !== 1 ? 's' : ''} left today
                </div>
              )}
              {!triviaLoading && availableQuestions > 0 && remaining === 0 && (
                <div className="text-[10px] opacity-70 mt-0.5">
                  Come back tomorrow for more!
                </div>
              )}
              {!triviaLoading && availableQuestions === 0 && (
                <div className="text-[10px] opacity-70 mt-0.5">
                  Check back later for new questions
                </div>
              )}
            </div>
            <Brain className="h-5 w-5" />
          </div>
        </Link>

        {/* Share a Moment - Photo sharing for stars */}
        <ShareButton
          variant="inline"
          showName="Hollywood Groove"
          shareType="show_moment"
        />

        {/* Tester Mode Entry Point - Only shows when test show is active */}
        {canUseTestMode && !checkingTestShow && activeTestShow && (
          !IS_TEST_MODE ? (
            <button
              onClick={handleEnableTestMode}
              className="block w-full rounded-xl bg-purple-500/20 border border-purple-500/50 px-4 py-2.5 font-semibold text-purple-200 hover:border-purple-400/60 hover:bg-purple-500/30 transition text-left"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-base leading-tight">Join Test Show</div>
                  <div className="text-xs text-purple-300/80">{activeTestShow.title}</div>
                </div>
                <FlaskConical className="h-5 w-5 text-purple-300" />
              </div>
            </button>
          ) : (
            <Link
              to={`/shows/${activeTestShow.showId}/join?test=true`}
              className="block w-full rounded-xl bg-purple-600 px-4 py-2.5 text-white font-bold shadow-lg active:scale-[0.99] transition"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-base leading-tight">Join Test Show</div>
                  <div className="text-xs font-semibold opacity-80">{activeTestShow.title}</div>
                </div>
                <FlaskConical className="h-5 w-5" />
              </div>
            </Link>
          )
        )}

        {/* Scorer Mode Entry Point - Only shows for scorers/admins */}
        {canScoreActivities && (
          <Link
            to="/score"
            className="block w-full rounded-xl bg-emerald-500/20 border border-emerald-500/50 px-4 py-2.5 font-semibold text-emerald-200 hover:border-emerald-400/60 hover:bg-emerald-500/30 transition"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-base leading-tight">Score Activities</div>
                <div className="text-xs text-emerald-300/80">Judge participant submissions</div>
              </div>
              <ClipboardCheck className="h-5 w-5 text-emerald-300" />
            </div>
          </Link>
        )}

        {/* Debug: Tester status indicator - shows for testers */}
        {canUseTestMode && (
          <div className="mt-4 p-2 bg-purple-900/30 border border-purple-700/50 rounded-lg text-xs text-purple-300">
            <div className="flex items-center gap-2">
              <FlaskConical className="h-3 w-3" />
              <span>Tester Mode: {activeTestShow ? `Active (${activeTestShow.title})` : checkingTestShow ? 'Checking...' : 'No active test show'}</span>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
