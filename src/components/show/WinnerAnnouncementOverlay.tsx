import { useEffect, useMemo, useState } from 'react';
import { X, Trophy } from 'lucide-react';
import { useShow } from '../../contexts/ShowContext';
import { WinnerResult } from '../../types/firebaseContract';
import { getShowPath, getTestShowPath } from '../../lib/mode';
import { useRtdbValue } from '../../hooks/useRtdbValue';

type Announcement = {
  id: string;
  title: string;
  displayName: string;
  points: number;
  computedAt: number;
};

function latestSetWinner(winners: Record<string, WinnerResult> | null): Announcement | null {
  if (!winners) return null;
  return Object.entries(winners)
    .map(([setNumber, winner]) => {
      if (!winner || winner.noWinner || !winner.uid || !winner.displayName) return null;
      const computedAt = winner.computedAt ?? winner.closedAt ?? 0;
      return {
        id: `set-${setNumber}-${computedAt}`,
        title: `Set ${winner.setNumber ?? Number(setNumber)} Winner`,
        displayName: winner.displayName,
        points: winner.points,
        computedAt,
      };
    })
    .filter((item): item is Announcement => item !== null)
    .sort((a, b) => b.computedAt - a.computedAt)[0] ?? null;
}

export default function WinnerAnnouncementOverlay() {
  const { showId, isTestShow } = useShow();
  const showKey = showId ? String(showId) : null;
  const showPath = useMemo(() => {
    if (!showKey) return null;
    return (suffix: string) => isTestShow ? getTestShowPath(showKey, suffix) : getShowPath(showKey, suffix);
  }, [isTestShow, showKey]);

  const { value: setWinners } = useRtdbValue<Record<string, WinnerResult>>(
    showPath ? showPath('set_winners') : null
  );
  const { value: nightWinner } = useRtdbValue<WinnerResult>(
    showPath ? showPath('night_winner') : null
  );

  const announcement = useMemo<Announcement | null>(() => {
    const latestSet = latestSetWinner(setWinners);
    const nightComputedAt = nightWinner?.computedAt ?? nightWinner?.closedAt ?? 0;
    const night = nightWinner && !nightWinner.noWinner && nightWinner.uid && nightWinner.displayName
      ? {
          id: `night-${nightComputedAt}`,
          title: 'Night Winner',
          displayName: nightWinner.displayName,
          points: nightWinner.points,
          computedAt: nightComputedAt,
        }
      : null;
    if (night && (!latestSet || night.computedAt >= latestSet.computedAt)) return night;
    return latestSet;
  }, [nightWinner, setWinners]);

  const [visible, setVisible] = useState<Announcement | null>(null);
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!announcement || seenIds.has(announcement.id)) return;
    setSeenIds((current) => new Set(current).add(announcement.id));
    setVisible(announcement);
    const timer = window.setTimeout(() => {
      setVisible((current) => current?.id === announcement.id ? null : current);
    }, 12000);
    return () => window.clearTimeout(timer);
  }, [announcement, seenIds]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 px-4">
      <button
        type="button"
        onClick={() => setVisible(null)}
        className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
        aria-label="Dismiss winner announcement"
      >
        <X className="h-5 w-5" />
      </button>

      <div className="w-full max-w-sm text-center text-white">
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full border border-primary/60 bg-primary/20 shadow-glow">
          <Trophy className="h-10 w-10 text-primary" />
        </div>
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">{visible.title}</p>
        <h2 className="mt-2 text-4xl font-black leading-tight">{visible.displayName}</h2>
        <p className="mt-3 text-xl font-bold text-white/90">{visible.points.toLocaleString()} pts</p>
      </div>
    </div>
  );
}
