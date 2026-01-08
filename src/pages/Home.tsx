import { Link, useSearchParams } from 'react-router-dom';
import { Music, Sparkles, List, FlaskConical, X } from 'lucide-react';
import { IS_TEST_MODE } from '../lib/mode';
import { useEffect, useState } from 'react';
import { useUser } from '../contexts/UserContext';

export default function Home() {
  const [searchParams] = useSearchParams();
  const [showTestBanner, setShowTestBanner] = useState(false);
  const { canUseTestMode } = useUser();

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

        {/* Tester Mode Entry Point */}
        {!IS_TEST_MODE && canUseTestMode && (
          <button
            onClick={handleEnableTestMode}
            className="block w-full rounded-2xl bg-purple-500/10 border border-purple-500/30 px-5 py-4 font-semibold text-purple-300 hover:border-purple-400/60 hover:bg-purple-500/20 transition text-left"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-lg leading-tight">Join as Tester</div>
                <div className="text-sm text-purple-400/80">Access test shows for demo purposes</div>
              </div>
              <FlaskConical className="h-6 w-6 text-purple-400" />
            </div>
          </button>
        )}
      </section>
    </div>
  );
}
