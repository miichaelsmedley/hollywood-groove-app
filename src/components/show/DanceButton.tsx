import { useState } from 'react';
import { Music } from 'lucide-react';
import { useShow } from '../../contexts/ShowContext';

interface DanceButtonProps {
  onClaimSuccess?: () => void;
}

export default function DanceButton({ onClaimSuccess }: DanceButtonProps) {
  const {
    currentMedian,
    canClaimDance,
    cooldownRemaining,
    claimDancePoints,
  } = useShow();

  const [isClaiming, setIsClaiming] = useState(false);
  const [justClaimed, setJustClaimed] = useState(false);

  // Format cooldown time as M:SS
  const formatCooldown = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleClick = async () => {
    if (!canClaimDance || isClaiming) return;

    setIsClaiming(true);
    try {
      const success = await claimDancePoints();
      if (success) {
        setJustClaimed(true);
        onClaimSuccess?.();
        setTimeout(() => setJustClaimed(false), 2000);
      }
    } finally {
      setIsClaiming(false);
    }
  };

  const isOnCooldown = cooldownRemaining > 0;

  if (justClaimed) {
    return (
      <button
        disabled
        className="flex-1 flex flex-col items-center justify-center gap-0.5 px-3 py-2 rounded-lg bg-accent-green/20 border border-accent-green/50 text-accent-green animate-pulse"
      >
        <Music className="w-4 h-4" />
        <span className="text-xs font-semibold">+{currentMedian} pts!</span>
      </button>
    );
  }

  if (isOnCooldown) {
    return (
      <button
        disabled
        className="flex-1 flex flex-col items-center justify-center gap-0.5 px-3 py-2 rounded-lg bg-cinema-800/80 border border-cinema-700 text-cinema-500 cursor-not-allowed"
      >
        <Music className="w-4 h-4" />
        <span className="text-xs font-semibold tabular-nums">{formatCooldown(cooldownRemaining)}</span>
        <span className="text-[10px] opacity-75">cooldown</span>
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={isClaiming}
      className="flex-1 flex flex-col items-center justify-center gap-0.5 px-3 py-2 rounded-lg bg-primary/20 border border-primary text-primary hover:bg-primary/30 transition-all active:scale-95 disabled:opacity-50"
    >
      <Music className="w-4 h-4" />
      <span className="text-xs font-bold">Dance Break</span>
      <span className="text-[10px] opacity-80">~{currentMedian} pts avg</span>
    </button>
  );
}
