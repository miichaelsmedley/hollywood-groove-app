import { Link } from 'react-router-dom';
import { Sparkles, List, FlaskConical, Brain, Users, UserPlus, PlayCircle } from 'lucide-react';
import { IS_TEST_MODE } from '../lib/mode';
import { useUser } from '../contexts/UserContext';
import { useTriviaHome } from '../lib/triviaLibraryService';
import { useActiveShows } from '../lib/showIndex';
import { getLatestWeeklyEpisode, isWeeklyEpisodePlayable } from '../features/weekly/episodeCatalog';

export default function Home() {
  const { canUseTestMode } = useUser();
  const { schedule, remaining, availableQuestions, loading: triviaLoading } = useTriviaHome();
  const { shows: activeTestShows, loading: checkingTestShow } = useActiveShows({
    includeProd: false,
    includeTest: canUseTestMode,
    enabled: canUseTestMode,
  });
  const activeTestShow = activeTestShows[0] ?? null;
  const weeklyEpisode = getLatestWeeklyEpisode();
  const weeklyEpisodePlayable = isWeeklyEpisodePlayable(weeklyEpisode);

  const handleEnableTestMode = () => {
    // Set test mode in localStorage and reload
    localStorage.setItem('hg_test_mode', 'true');
    window.location.href = '/';
  };

  return (
    <div className="mx-auto max-w-md space-y-6">
      {/* Welcome Heading - Two lines, properly aligned */}
      <section className="text-center space-y-1">
        <div className="text-base text-cinema-400 font-medium">Welcome to</div>
        <h1 className="text-3xl sm:text-4xl font-bold font-display text-primary">
          Hollywood Groove
        </h1>
      </section>

      <section className="space-y-3">
        {/* Weekly Watch & Play - Primary audience-growth CTA. A normal anchor
            reloads into the backend-free weekly application shell. */}
        {weeklyEpisodePlayable ? (
          <a
            href="/weekly"
            className="block min-h-20 w-full rounded-xl bg-gradient-to-r from-primary to-primary-400 px-4 py-3 text-cinema font-bold shadow-glow-lg transition hover:shadow-glow active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-cinema"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-lg leading-tight">Weekly Watch &amp; Play</div>
                <div className="text-sm font-semibold opacity-80">Play solo or gather a table</div>
              </div>
              <PlayCircle className="h-7 w-7" aria-hidden="true" />
            </div>
          </a>
        ) : (
          <div className="min-h-20 w-full rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-cinema-800">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-lg font-bold leading-tight text-primary">Weekly Watch &amp; Play</div>
                <div className="text-sm text-cinema-600">Episode 1 video coming soon</div>
              </div>
              <PlayCircle className="h-7 w-7 text-primary" aria-hidden="true" />
            </div>
          </div>
        )}

        {/* Join Current Show */}
        <Link
          to="/join"
          className="block w-full rounded-xl border border-cinema-200 bg-cinema-50 px-4 py-3 font-bold text-cinema-900 transition hover:border-primary/60 active:scale-[0.99]"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-lg leading-tight">Join current show</div>
              <div className="text-sm font-semibold opacity-80">Play trivia and see your score</div>
            </div>
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
        </Link>

        {/* Daily Trivia Button */}
        <Link
          to="/play"
          className={`block w-full rounded-xl px-4 py-3 text-white font-bold shadow-lg active:scale-[0.99] transition ${
            !triviaLoading && availableQuestions === 0
              ? 'bg-gradient-to-r from-gray-600 to-gray-500'
              : 'bg-gradient-to-r from-purple-600 to-pink-600'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-lg leading-tight">Daily Trivia</div>
              <div className="text-sm font-semibold opacity-80">
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
                <div className="text-xs opacity-70 mt-0.5">
                  {remaining} question{remaining !== 1 ? 's' : ''} left today
                </div>
              )}
              {!triviaLoading && availableQuestions > 0 && remaining === 0 && (
                <div className="text-xs opacity-70 mt-0.5">
                  Come back tomorrow for more!
                </div>
              )}
              {!triviaLoading && availableQuestions === 0 && (
                <div className="text-xs opacity-70 mt-0.5">
                  Check back later for new questions
                </div>
              )}
            </div>
            <Brain className="h-6 w-6" />
          </div>
        </Link>

        {/* Teams Section - Two-column grid */}
        <div className="grid grid-cols-2 gap-2">
          <Link
            to="/teams/create"
            className="block rounded-xl bg-cinema-50 border border-cinema-200 px-4 py-3 font-semibold text-cinema-900 hover:border-primary/60 transition"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="text-base leading-tight">Create Team</div>
              <Users className="h-5 w-5 text-primary flex-shrink-0" />
            </div>
          </Link>
          <Link
            to="/teams/join"
            className="block rounded-xl bg-cinema-50 border border-cinema-200 px-4 py-3 font-semibold text-cinema-900 hover:border-primary/60 transition"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="text-base leading-tight">Join Team</div>
              <UserPlus className="h-5 w-5 text-primary flex-shrink-0" />
            </div>
          </Link>
        </div>

        {/* Activities */}
        <Link
          to="/activities"
          className="block w-full rounded-xl bg-cinema-50 border border-cinema-200 px-4 py-3 font-semibold text-cinema-900 hover:border-primary/60 transition"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-base leading-tight">Activities</div>
              <div className="text-sm text-cinema-500">Trivia, polls, and more</div>
            </div>
            <List className="h-5 w-5 text-primary" />
          </div>
        </Link>

        {/* Tester Mode Entry Point - Only shows when test show is active */}
        {canUseTestMode && !checkingTestShow && activeTestShow && (
          !IS_TEST_MODE ? (
            <button
              onClick={handleEnableTestMode}
              className="block w-full rounded-xl bg-purple-500/20 border border-purple-500/50 px-4 py-3 font-semibold text-purple-200 hover:border-purple-400/60 hover:bg-purple-500/30 transition text-left"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-base leading-tight">Join Test Show</div>
                  <div className="text-sm text-purple-300/80">{activeTestShow.title}</div>
                </div>
                <FlaskConical className="h-5 w-5 text-purple-300" />
              </div>
            </button>
          ) : (
            <Link
              to={`/shows/${activeTestShow.showId}/join?test=true`}
              className="block w-full rounded-xl bg-purple-600 px-4 py-3 text-white font-bold shadow-lg active:scale-[0.99] transition"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-base leading-tight">Join Test Show</div>
                  <div className="text-sm font-semibold opacity-80">{activeTestShow.title}</div>
                </div>
                <FlaskConical className="h-5 w-5" />
              </div>
            </Link>
          )
        )}

        {/* Debug: Tester status indicator - shows for testers */}
        {canUseTestMode && (
          <div className="mt-2 p-2 bg-purple-900/30 border border-purple-700/50 rounded-lg text-xs text-purple-300">
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
