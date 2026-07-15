import { useEffect, useMemo, useState } from 'react';
import { Lightbulb, Music2, Sparkles, X } from 'lucide-react';
import { useShow } from '../../contexts/ShowContext';
import { getShowPath, getTestShowPath } from '../../lib/mode';
import { useRtdbValue } from '../../hooks/useRtdbValue';
import { useAuthUser } from '../../features/auth/useAuthUser';
import type { DanceWindowAward } from '../../types/firebaseContract';

function formatRemaining(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function DanceWindowBanner() {
  const { showId, isTestShow, liveDanceWindow } = useShow();
  const authUser = useAuthUser();
  const [now, setNow] = useState(() => Date.now());
  const [dismissedWindowId, setDismissedWindowId] = useState<string | null>(null);
  const [flashAwardAt, setFlashAwardAt] = useState<number | null>(null);
  const [seenSpotlightAt, setSeenSpotlightAt] = useState<number | null>(null);

  const isOpen = Boolean(
    liveDanceWindow?.status === 'open' &&
    typeof liveDanceWindow.endsAt === 'number' &&
    liveDanceWindow.endsAt > now
  );
  const windowId = isOpen ? liveDanceWindow?.windowId ?? null : null;
  const showKey = showId ? String(showId) : null;

  const awardPath = useMemo(() => {
    if (!showKey || !windowId || !authUser?.uid) return null;
    const suffix = `dance_window_awards/${windowId}/${authUser.uid}`;
    return isTestShow ? getTestShowPath(showKey, suffix) : getShowPath(showKey, suffix);
  }, [authUser?.uid, isTestShow, showKey, windowId]);

  const { value: award } = useRtdbValue<DanceWindowAward>(awardPath);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!windowId) return;
    setDismissedWindowId(null);
    if ('vibrate' in navigator) {
      navigator.vibrate?.([120, 70, 120]);
    }
  }, [windowId]);

  useEffect(() => {
    const awardedAt = award?.spotlightAwardedAt;
    if (!awardedAt || awardedAt === seenSpotlightAt) return;
    setSeenSpotlightAt(awardedAt);
    setFlashAwardAt(awardedAt);
    if ('vibrate' in navigator) {
      navigator.vibrate?.([80, 40, 80, 40, 160]);
    }
    const timer = window.setTimeout(() => setFlashAwardAt(null), 4200);
    return () => window.clearTimeout(timer);
  }, [award?.spotlightAwardedAt, seenSpotlightAt]);

  const remaining = liveDanceWindow?.endsAt ? liveDanceWindow.endsAt - now : 0;
  const dismissed = windowId && dismissedWindowId === windowId;

  return (
    <>
      {isOpen && !dismissed && liveDanceWindow && (
        <section className="fixed inset-x-3 top-3 z-40 mx-auto max-w-lg rounded-2xl border border-primary/70 bg-cinema-900/95 p-4 text-white shadow-glow backdrop-blur">
          <button
            type="button"
            onClick={() => setDismissedWindowId(liveDanceWindow.windowId)}
            className="absolute right-2 top-2 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-primary"
            aria-label="Dismiss dance window banner"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-start gap-3 pr-8">
            <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-primary text-cinema">
              <Music2 className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black uppercase tracking-wide text-primary">Dance Window</p>
              <h2 className="mt-1 text-lg font-black leading-tight">
                On the floor now: +{liveDanceWindow.participationPoints ?? 100}
              </h2>
              <p className="mt-1 text-sm text-white/75">
                Spotlight could drop any second (+{liveDanceWindow.spotlightPoints ?? 150}).
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-bold">
                <span className="rounded-full bg-white px-2.5 py-1 text-cinema tabular-nums">
                  {formatRemaining(remaining)}
                </span>
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-white">
                  {liveDanceWindow.dancerCount ?? 0} on the floor
                </span>
                <span className="truncate rounded-full bg-primary/20 px-2.5 py-1 text-primary">
                  {liveDanceWindow.songTitle}
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      {flashAwardAt && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center bg-white text-cinema">
          <div className="px-6 text-center">
            <div className="mx-auto mb-5 flex h-24 w-24 animate-ping items-center justify-center rounded-full bg-primary/40" />
            <Lightbulb className="mx-auto -mt-28 mb-8 h-20 w-20 text-primary" />
            <p className="text-sm font-black uppercase tracking-wide text-cinema-500">Spotlight</p>
            <h2 className="mt-2 text-5xl font-black leading-none">+{award?.spotlightPoints ?? 150}</h2>
            <p className="mt-3 inline-flex items-center gap-2 text-lg font-bold">
              <Sparkles className="h-5 w-5 text-primary" />
              You were on the floor
            </p>
          </div>
        </div>
      )}
    </>
  );
}
