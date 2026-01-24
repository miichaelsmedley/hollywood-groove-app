import { useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Mic, Trophy, Vote, Users, List, Music, ArrowLeft } from 'lucide-react';
import { useShow } from '../../contexts/ShowContext';
import TriviaButton from './TriviaButton';
import BreakMenuModal from './BreakMenuModal';
import type { BreakMode } from '../../contexts/ShowContext';

// Break mode labels for display
const BREAK_MODE_LABELS: Record<Exclude<BreakMode, 'off'>, string> = {
  dancing: 'Dancing',
  toilet: 'Quick break',
  chatting: 'Chatting',
};

/**
 * Action bar displayed above the bottom navigation on trivia/activity pages.
 * Simplified UX:
 * - Single "Dance / Take a Break" button that opens modal
 * - When on break, shows "Return to Trivia" button
 * - Activities list button at bottom
 */
export default function ActionBar() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    dancingEnabled,
    currentMedian,
    isOnBreak,
    breakMode,
    pointsEarnedOnBreak,
    enterBreakMode,
    exitBreakMode,
    liveActivity,
  } = useShow();

  const [showBreakMenu, setShowBreakMenu] = useState(false);

  const handleBreakSelect = async (mode: Exclude<BreakMode, 'off'>, customDuration?: number) => {
    setShowBreakMenu(false);
    // Note: customDuration is available if needed for future break timing logic
    await enterBreakMode(mode);
  };

  const handleReturnFromBreak = () => {
    exitBreakMode();
  };

  const handleActivitiesClick = () => {
    if (id) {
      navigate(`/shows/${id}/activities`);
    }
  };

  // Determine if there's a non-dancing activity active
  const hasNonDanceActivity = liveActivity &&
    liveActivity.status === 'active' &&
    liveActivity.type !== 'dancing';

  // Check if we're already on the activity page
  const isOnActivityPage = location.pathname.endsWith('/activity');

  // Get activity icon based on type
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'sing_signup':
      case 'backup_singer':
        return Mic;
      case 'competition':
      case 'costume_contest':
        return Trophy;
      case 'vote':
        return Vote;
      case 'stage_participation':
      case 'raffle':
      default:
        return Users;
    }
  };

  const ActivityIcon = hasNonDanceActivity ? getActivityIcon(liveActivity.type) : Users;

  // Don't render if nothing to show
  if (!dancingEnabled && !hasNonDanceActivity) {
    return null;
  }

  return (
    <>
      <div className="bg-gray-950 border-t border-gray-800 px-3 py-2 pb-4 safe-area-pb">
        <div className="flex flex-col gap-2 max-w-lg mx-auto">
          {/* Top row: Trivia + Activity + Dance/Break */}
          <div className="flex items-stretch gap-2">
            {/* Trivia Button (if trivia is live and not on trivia page) */}
            <TriviaButton />

            {/* Activity Button (if non-dance activity is live and not on activity page) */}
            {hasNonDanceActivity && !isOnActivityPage && (
              <button
                onClick={() => navigate(`/shows/${id}/activity`)}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 px-3 py-3 rounded-xl bg-green-600 text-white font-semibold shadow-lg hover:bg-green-500 transition-all active:scale-95"
              >
                <ActivityIcon className="w-5 h-5" />
                <span className="text-sm font-bold">Join Activity</span>
                {liveActivity.fixedPoints && (
                  <span className="text-xs opacity-90">+{liveActivity.fixedPoints} pts</span>
                )}
              </button>
            )}

            {/* Dance/Break Button - Single button UX */}
            {dancingEnabled && (
              isOnBreak && breakMode !== 'off' ? (
                // On break - show "Return to Trivia" button
                <button
                  onClick={handleReturnFromBreak}
                  className="flex-1 flex flex-col items-center justify-center gap-1 px-4 py-3 rounded-xl bg-amber-500 text-gray-900 font-semibold shadow-lg hover:bg-amber-400 transition-all active:scale-95"
                >
                  <div className="flex items-center gap-2">
                    <ArrowLeft className="w-5 h-5" />
                    <span className="text-sm font-bold">Return to Trivia</span>
                  </div>
                  <span className="text-xs opacity-80">
                    {BREAK_MODE_LABELS[breakMode]} • {pointsEarnedOnBreak > 0 ? `+${pointsEarnedOnBreak} pts earned` : 'Auto-claiming pts'}
                  </span>
                </button>
              ) : (
                // Not on break - show "Dance / Take a Break" button
                <button
                  onClick={() => setShowBreakMenu(true)}
                  className="flex-1 flex flex-col items-center justify-center gap-1 px-4 py-3 rounded-xl bg-primary text-gray-900 font-semibold shadow-lg hover:bg-primary-400 transition-all active:scale-95"
                >
                  <Music className="w-5 h-5" />
                  <span className="text-sm font-bold">Dance / Take a Break</span>
                  <span className="text-xs opacity-80">~{currentMedian ?? 50} pts</span>
                </button>
              )
            )}
          </div>

          {/* Bottom row: Activities list button */}
          <button
            onClick={handleActivitiesClick}
            className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white transition-all active:scale-98"
          >
            <List className="w-4 h-4" />
            <span className="text-sm font-medium">See All Activities</span>
          </button>
        </div>
      </div>

      {/* Break Menu Modal */}
      {showBreakMenu && (
        <BreakMenuModal
          onSelect={handleBreakSelect}
          onClose={() => setShowBreakMenu(false)}
          currentMedian={currentMedian}
        />
      )}
    </>
  );
}
