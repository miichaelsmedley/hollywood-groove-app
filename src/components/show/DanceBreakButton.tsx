import { useState } from 'react';
import { Music, Coffee } from 'lucide-react';
import { useShow } from '../../contexts/ShowContext';

export default function DanceBreakButton() {
  const {
    dancingEnabled,
    currentMedian,
    canClaimDance,
    cooldownRemaining,
    isOnBreak,
    setIsOnBreak,
    claimDancePoints,
  } = useShow();

  const [isClaiming, setIsClaiming] = useState(false);
  const [justClaimed, setJustClaimed] = useState(false);

  // Don't render if dancing is disabled
  if (!dancingEnabled) {
    return null;
  }

  const handleDanceClick = async () => {
    if (isOnBreak) {
      // Toggle off break mode
      setIsOnBreak(false);
      return;
    }

    if (!canClaimDance || isClaiming) return;

    setIsClaiming(true);
    try {
      const success = await claimDancePoints();
      if (success) {
        setJustClaimed(true);
        // Reset the "just claimed" state after animation
        setTimeout(() => setJustClaimed(false), 2000);
      }
    } finally {
      setIsClaiming(false);
    }
  };

  const handleBreakClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOnBreak(!isOnBreak);
  };

  // Format cooldown time as M:SS
  const formatCooldown = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Determine button state and appearance
  const isOnCooldown = cooldownRemaining > 0;

  if (isOnBreak) {
    return (
      <button
        onClick={handleDanceClick}
        className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-cinema-800 border border-cinema-600 text-cinema-400 shadow-lg transition-all hover:border-cinema-500"
      >
        <Coffee className="w-5 h-5" />
        <span className="font-semibold">On Break</span>
      </button>
    );
  }

  if (justClaimed) {
    return (
      <button
        disabled
        className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-accent-green/20 border border-accent-green/50 text-accent-green shadow-lg animate-pulse"
      >
        <Music className="w-5 h-5" />
        <span className="font-semibold">+{currentMedian} pts!</span>
      </button>
    );
  }

  if (isOnCooldown) {
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          disabled
          className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-cinema-800/80 border border-cinema-700 text-cinema-500 shadow-lg cursor-not-allowed"
        >
          <Music className="w-5 h-5" />
          <span className="font-semibold">{formatCooldown(cooldownRemaining)}</span>
        </button>
        <button
          onClick={handleBreakClick}
          className="text-xs text-cinema-500 hover:text-cinema-300 transition-colors px-2"
        >
          Take a break
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleDanceClick}
        disabled={isClaiming}
        className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-primary/20 border-2 border-primary text-primary shadow-glow hover:bg-primary/30 hover:shadow-glow-lg transition-all active:scale-95 disabled:opacity-50"
      >
        <Music className="w-5 h-5" />
        <div className="flex flex-col items-start">
          <span className="font-bold">Dance</span>
          <span className="text-xs opacity-80">{currentMedian} pts</span>
        </div>
      </button>
      <button
        onClick={handleBreakClick}
        className="text-xs text-cinema-500 hover:text-cinema-300 transition-colors px-2"
      >
        Take a break
      </button>
    </div>
  );
}
