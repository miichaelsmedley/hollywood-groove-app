import { Link, useSearchParams } from 'react-router-dom';
import { Music, Sparkles, List, FlaskConical, X, Brain } from 'lucide-react';
import { IS_TEST_MODE } from '../lib/mode';
import { useEffect, useState } from 'react';
import { useUser } from '../contexts/UserContext';
import { useTriviaHome } from '../lib/triviaLibraryService';

export default function Home() {
  const [searchParams] = useSearchParams();
  const [showTestBanner, setShowTestBanner] = useState(false);
  const { canUseTestMode } = useUser();
  const { schedule, remaining, loading: triviaLoading } = useTriviaHome();

  // Check if we just enabled test mode
  useEffect(() => {
    if (searchParams.get('testMode') === 'true' || IS_TEST_MODE) {
      setShowTestBanner(true);
    }
  }, [searchParams]);

  const handleEnableTestMode = () => {
    // Set test mode in localStorage and reload
    localStorage.setItem('hg_test_mode', 'true');
    window.location.href = '/';
  };

  const handleDisableTestMode = () => {
    localStorage.removeItem('hg_test_mode');
    window.location.href = '/';
  };

  return (
    <div className="mx-auto max-w-md space-y-6">
      {/* Test Mode Banner */}
      {showTestBanner && IS_TEST_MODE && (
        <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-purple-400" />
            <span className="text-sm font-medium text-purple-300">Test Mode Active</span>
          </div>
          <button
            onClick={handleDisableTestMode}
            className="p-1 hover:bg-purple-500/20 rounded transition"
          >
            <X className="w-4 h-4 text-purple-400" />
          </button>
        </div>
      )}

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

        {/* Quick Trivia Button */}
        <Link
          to="/play"
          className="block w-full rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-4 text-white font-bold shadow-lg active:scale-[0.99] transition"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-lg leading-tight">Quick Trivia</div>
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

        {/* Tester Mode Entry Point - Shows for assigned testers */}
        {canUseTestMode && (
          <>
            {!IS_TEST_MODE ? (
              <button
                onClick={handleEnableTestMode}
                className="block w-full rounded-2xl bg-purple-500/10 border border-purple-500/30 px-5 py-4 font-semibold text-purple-300 hover:border-purple-400/60 hover:bg-purple-500/20 transition text-left"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-lg leading-tight">Join Test Show</div>
                    <div className="text-sm text-purple-400/80">You're a tester - tap to access test shows</div>
                  </div>
                  <FlaskConical className="h-6 w-6 text-purple-400" />
                </div>
              </button>
            ) : (
              <Link
                to="/join"
                className="block w-full rounded-2xl bg-purple-600 px-5 py-4 text-white font-bold shadow-lg active:scale-[0.99] transition"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-lg leading-tight">Join Test Show</div>
                    <div className="text-sm font-semibold opacity-80">Test mode active - join show 101</div>
                  </div>
                  <FlaskConical className="h-6 w-6" />
                </div>
              </Link>
            )}
          </>
        )}
      </section>
    </div>
  );
}
