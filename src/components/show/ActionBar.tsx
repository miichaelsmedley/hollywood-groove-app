import { useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Coffee, Mic, Trophy, Vote, Users, List, Music } from 'lucide-react';
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
 * - Top row: Trivia button (if live) + Live activity button (if active) + Take a Break button
 * - Bottom row: Activities list button
 *
 * The "Take a Break" button opens a modal where user can choose break type.
 * All break types auto-claim dance points.
 */
export default function ActionBar() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    dancingEnabled,
    currentMedian,
    canClaimDance,
    cooldownRemaining,
    isOnBreak,
    breakMode,
    pointsEarnedOnBreak,
    enterBreakMode,
    exitBreakMode,
    claimDancePoints,
    liveActivity,
  } = useShow();

  const [showBreakMenu, setShowBreakMenu] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [justClaimed, setJustClaimed] = useState(false);

  // Format cooldown time as M:SS
  const formatCooldown = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

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

  // Quick dance claim (without entering break mode)
  const handleQuickDanceClaim = async () => {
    if (!canClaimDance || isClaiming) return;
    setIsClaiming(true);
    try {
      const success = await claimDancePoints();
      if (success) {
        setJustClaimed(true);
        setTimeout(() => setJustClaimed(false), 2000);
      }
    } finally {
      setIsClaiming(false);
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
  const isOnCooldown = cooldownRemaining > 0;

  // Don't render if nothing to show
  if (!dancingEnabled && !hasNonDanceActivity) {
    return null;
  }

  return (
    <>
      <div className="bg-cinema-900/95 backdrop-blur-sm border-t border-cinema-700 px-3 py-2">
        <div className="flex flex-col gap-2 max-w-lg mx-auto">
          {/* Top row: Trivia + Activity + Dance/Break */}
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

            {/* Dance/Break Button - Combined UX */}
            {dancingEnabled && (
              isOnBreak && breakMode !== 'off' ? (
                // On break - show status and return button
                <button
                  onClick={handleReturnFromBreak}
                  className="flex-1 flex flex-col items-center justify-center gap-0.5 px-3 py-2 rounded-lg bg-amber-500/20 border border-amber-500/50 text-amber-400 hover:bg-amber-500/30 transition-all"
                >
                  <Coffee className="w-4 h-4" />
                  <span className="text-xs font-semibold">On Break ({BREAK_MODE_LABELS[breakMode]})</span>
                  {pointsEarnedOnBreak > 0 && (
                    <span className="text-[10px] text-accent-green font-semibold">+{pointsEarnedOnBreak} pts earned</span>
                  )}
                  <span className="text-[10px] opacity-75">Tap to return</span>
                </button>
              ) : justClaimed ? (
                // Just claimed animation
                <button
                  disabled
                  className="flex-1 flex flex-col items-center justify-center gap-0.5 px-3 py-2 rounded-lg bg-accent-green/20 border border-accent-green/50 text-accent-green animate-pulse"
                >
                  <Music className="w-4 h-4" />
                  <span className="text-xs font-semibold">+{currentMedian} pts!</span>
                </button>
              ) : isOnCooldown ? (
                // On cooldown - show timer and break option
                <button
                  onClick={() => setShowBreakMenu(true)}
                  className="flex-1 flex flex-col items-center justify-center gap-0.5 px-3 py-2 rounded-lg bg-cinema-800/80 border border-cinema-700 text-cinema-400 hover:border-cinema-600 transition-all"
                >
                  <Coffee className="w-4 h-4" />
                  <span className="text-xs font-semibold">Take a Break</span>
                  <span className="text-[10px] opacity-75">Dance in {formatCooldown(cooldownRemaining)}</span>
                </button>
              ) : (
                // Ready to claim - tap to claim, long press for break menu
                <div className="flex-1 flex gap-1">
                  <button
                    onClick={handleQuickDanceClaim}
                    disabled={isClaiming}
                    className="flex-1 flex flex-col items-center justify-center gap-0.5 px-3 py-2 rounded-lg bg-primary/20 border border-primary text-primary hover:bg-primary/30 transition-all active:scale-95 disabled:opacity-50"
                  >
                    <Music className="w-4 h-4" />
                    <span className="text-xs font-bold">Dance!</span>
                    <span className="text-[10px] opacity-80">~{currentMedian} pts</span>
                  </button>
                  <button
                    onClick={() => setShowBreakMenu(true)}
                    className="flex flex-col items-center justify-center gap-0.5 px-2 py-2 rounded-lg bg-cinema-800 border border-cinema-600 text-cinema-400 hover:border-cinema-500 hover:text-cinema-300 transition-all"
                    title="Take a break (auto-claims)"
                  >
                    <Coffee className="w-4 h-4" />
                    <span className="text-[10px]">Break</span>
                  </button>
                </div>
              )
            )}
          </div>

          {/* Bottom row: Activities list button */}
          <div className="flex items-stretch gap-2">
            <button
              onClick={handleActivitiesClick}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-cinema-800 border border-cinema-600 text-cinema-300 hover:border-primary/50 hover:text-white transition-all"
            >
              <List className="w-4 h-4" />
              <span className="text-xs font-semibold">See All Activities</span>
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
