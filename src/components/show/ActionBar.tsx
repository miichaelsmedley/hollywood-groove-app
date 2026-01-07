import { useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Coffee, Mic, Trophy, Vote, Users, List, ArrowLeft } from 'lucide-react';
import { useShow } from '../../contexts/ShowContext';
import DanceButton from './DanceButton';
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
 * Shows concurrent activities + persistent break/dance button.
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

  const handleBreakSelect = async (mode: Exclude<BreakMode, 'off'>) => {
    setShowBreakMenu(false);
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
      <div className="bg-cinema-900/95 backdrop-blur-sm border-t border-cinema-700 px-3 py-2">
        <div className="flex flex-col gap-2 max-w-lg mx-auto">
          {/* Top row: Live activities + Dance/Trivia buttons */}
          <div className="flex items-stretch gap-2">
            {/* Trivia Button (if trivia is live and not on trivia page) */}
            <TriviaButton />

            {/* Activity Button (if non-dance activity is live and not on activity page) */}
            {hasNonDanceActivity && !isOnActivityPage && (
              <button
                onClick={() => navigate(`/shows/${id}/activity`)}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 px-3 py-2 rounded-lg bg-accent-green/20 border border-accent-green/50 text-accent-green hover:bg-accent-green/30 transition-all"
              >
                <ActivityIcon className="w-4 h-4" />
                <span className="text-xs font-semibold">Join Activity</span>
                {liveActivity.fixedPoints && (
                  <span className="text-[10px] opacity-75">+{liveActivity.fixedPoints} pts</span>
                )}
              </button>
            )}

            {/* Dance Button (only when not on break) */}
            {dancingEnabled && !isOnBreak && (
              <DanceButton />
            )}

            {/* On Break indicator (replaces dance button when on break) */}
            {dancingEnabled && isOnBreak && breakMode !== 'off' && (
              <button
                onClick={handleReturnFromBreak}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 px-3 py-2 rounded-lg bg-amber-500/20 border border-amber-500/50 text-amber-400 hover:bg-amber-500/30 transition-all"
              >
                <Coffee className="w-4 h-4" />
                <span className="text-xs font-semibold">On Break ({BREAK_MODE_LABELS[breakMode]})</span>
                {pointsEarnedOnBreak > 0 && (
                  <span className="text-[10px] text-accent-green font-semibold">+{pointsEarnedOnBreak} pts earned</span>
                )}
              </button>
            )}
          </div>

          {/* Bottom row: Break button + Activities list */}
          <div className="flex items-stretch gap-2">
            {/* Break/Return Button */}
            {dancingEnabled && (
              isOnBreak ? (
                <button
                  onClick={handleReturnFromBreak}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-cinema-800 border border-cinema-600 text-cinema-300 hover:border-cinema-500 hover:text-white transition-all"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="text-xs font-semibold">Return to Trivia/Activity</span>
                </button>
              ) : (
                <button
                  onClick={() => setShowBreakMenu(true)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-cinema-800 border border-cinema-600 text-cinema-300 hover:border-primary/50 hover:text-white transition-all"
                >
                  <Coffee className="w-4 h-4" />
                  <span className="text-xs font-semibold">Having a Dance / Taking a Break</span>
                </button>
              )
            )}

            {/* See Activities Button */}
            <button
              onClick={handleActivitiesClick}
              className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-cinema-800 border border-cinema-600 text-cinema-300 hover:border-primary/50 hover:text-white transition-all"
            >
              <List className="w-4 h-4" />
              <span className="text-xs font-semibold">Activities</span>
            </button>
          </div>
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
