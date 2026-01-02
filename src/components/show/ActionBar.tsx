import { useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Music, Coffee, Mic, Trophy, Vote, Users, HelpCircle } from 'lucide-react';
import { useShow } from '../../contexts/ShowContext';

/**
 * Action bar displayed above the bottom navigation on trivia/activity pages.
 * Replaces the floating FAB with inline, compact action buttons.
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
    setIsOnBreak,
    claimDancePoints,
    liveActivity,
    liveTrivia,
  } = useShow();

  const [isClaiming, setIsClaiming] = useState(false);
  const [justClaimed, setJustClaimed] = useState(false);

  // Format cooldown time as M:SS
  const formatCooldown = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleDanceClick = async () => {
    if (isOnBreak) {
      setIsOnBreak(false);
      return;
    }

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

  const handleBreakToggle = () => {
    setIsOnBreak(!isOnBreak);
  };

  const handleActivityClick = () => {
    if (id) {
      navigate(`/shows/${id}/activity`);
    }
  };

  const handleTriviaClick = () => {
    if (id) {
      navigate(`/shows/${id}/trivia`);
    }
  };

  // Determine if there's a non-dancing activity active
  const hasNonDanceActivity = liveActivity &&
    liveActivity.status === 'active' &&
    liveActivity.type !== 'dancing';

  // Determine if trivia is live (question or answer phase)
  const isTriviaLive = liveTrivia &&
    liveTrivia.phase !== 'idle' &&
    liveTrivia.activityId;

  // Check if we're already on the trivia page
  const isOnTriviaPage = location.pathname.endsWith('/trivia');

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
  if (!dancingEnabled && !hasNonDanceActivity && !isTriviaLive) {
    return null;
  }

  return (
    <div className="bg-cinema-900/95 backdrop-blur-sm border-t border-cinema-700 px-3 py-2">
      <div className="flex items-stretch gap-2 max-w-lg mx-auto">
        {/* Trivia Button (if trivia is live and not on trivia page) */}
        {isTriviaLive && !isOnTriviaPage && (
          <button
            onClick={handleTriviaClick}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 px-3 py-2 rounded-lg bg-primary/20 border border-primary text-primary hover:bg-primary/30 transition-all active:scale-95"
          >
            <HelpCircle className="w-4 h-4" />
            <span className="text-xs font-bold">
              {liveTrivia.phase === 'question' ? 'Answer Now!' : 'See Answer'}
            </span>
          </button>
        )}

        {/* Activity Button (if non-dance activity is live and not on activity page) */}
        {hasNonDanceActivity && !isOnActivityPage && (
          <button
            onClick={handleActivityClick}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 px-3 py-2 rounded-lg bg-accent-green/20 border border-accent-green/50 text-accent-green hover:bg-accent-green/30 transition-all"
          >
            <ActivityIcon className="w-4 h-4" />
            <span className="text-xs font-semibold">Join Activity</span>
            {liveActivity.fixedPoints && (
              <span className="text-[10px] opacity-75">+{liveActivity.fixedPoints} pts</span>
            )}
          </button>
        )}

        {/* Dance Button */}
        {dancingEnabled && (
          <>
            {isOnBreak ? (
              <button
                onClick={handleDanceClick}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 px-3 py-2 rounded-lg bg-cinema-800 border border-cinema-600 text-cinema-400 hover:border-cinema-500 transition-all"
              >
                <Coffee className="w-4 h-4" />
                <span className="text-xs font-semibold">On Break</span>
                <span className="text-[10px] opacity-75">Tap to rejoin</span>
              </button>
            ) : justClaimed ? (
              <button
                disabled
                className="flex-1 flex flex-col items-center justify-center gap-0.5 px-3 py-2 rounded-lg bg-accent-green/20 border border-accent-green/50 text-accent-green animate-pulse"
              >
                <Music className="w-4 h-4" />
                <span className="text-xs font-semibold">+{currentMedian} pts!</span>
              </button>
            ) : isOnCooldown ? (
              <div className="flex-1 flex flex-col">
                <button
                  disabled
                  className="flex-1 flex flex-col items-center justify-center gap-0.5 px-3 py-2 rounded-lg bg-cinema-800/80 border border-cinema-700 text-cinema-500 cursor-not-allowed"
                >
                  <Music className="w-4 h-4" />
                  <span className="text-xs font-semibold tabular-nums">{formatCooldown(cooldownRemaining)}</span>
                </button>
                <button
                  onClick={handleBreakToggle}
                  className="text-[10px] text-cinema-500 hover:text-cinema-300 transition-colors py-0.5"
                >
                  {isOnBreak ? 'Stop break' : 'Take a break'}
                </button>
              </div>
            ) : (
              <div className="flex-1 flex flex-col">
                <button
                  onClick={handleDanceClick}
                  disabled={isClaiming}
                  className="flex-1 flex flex-col items-center justify-center gap-0.5 px-3 py-2 rounded-lg bg-primary/20 border border-primary text-primary hover:bg-primary/30 transition-all active:scale-95 disabled:opacity-50"
                >
                  <Music className="w-4 h-4" />
                  <span className="text-xs font-bold">Dance Break</span>
                  <span className="text-[10px] opacity-80">~{currentMedian} pts avg</span>
                </button>
                <button
                  onClick={handleBreakToggle}
                  className="text-[10px] text-cinema-500 hover:text-cinema-300 transition-colors py-0.5"
                >
                  {isOnBreak ? 'Stop break' : 'Take a break'}
                </button>
              </div>
            )}
          </>
        )}

        {/* Placeholder for scope-based activities (future) */}
        {/* This could show "Song Activity (1 of 3)" when implemented */}
      </div>
    </div>
  );
}
