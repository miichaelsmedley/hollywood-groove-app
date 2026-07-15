import { useEffect, useState } from 'react';
import { Mic2, X } from 'lucide-react';
import { auth } from '../../lib/firebase';
import { useShow } from '../../contexts/ShowContext';

export default function CallupTakeover() {
  const { liveCallup } = useShow();
  const [dismissedCallupId, setDismissedCallupId] = useState<string | null>(null);

  const currentUid = auth.currentUser?.uid ?? null;
  const isMine = Boolean(
    liveCallup?.notifyPunter &&
    liveCallup.uid === currentUid &&
    liveCallup.callupId !== dismissedCallupId
  );

  useEffect(() => {
    if (!isMine || !liveCallup?.callupId) return;
    if ('vibrate' in navigator) {
      navigator.vibrate([220, 90, 220, 90, 420]);
    }
  }, [isMine, liveCallup?.callupId]);

  useEffect(() => {
    if (!liveCallup) {
      setDismissedCallupId(null);
    }
  }, [liveCallup]);

  if (!isMine || !liveCallup) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black px-5 text-white">
      <button
        type="button"
        onClick={() => setDismissedCallupId(liveCallup.callupId)}
        className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
        aria-label="Dismiss callup"
      >
        <X className="h-5 w-5" />
      </button>

      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full border border-primary/70 bg-primary/20 shadow-glow">
          <Mic2 className="h-12 w-12 text-primary" />
        </div>

        <p className="text-sm font-bold uppercase tracking-[0.24em] text-primary">You're up</p>
        <h1 className="mt-3 text-5xl font-black leading-none sm:text-6xl">Get to the stage</h1>
        <p className="mt-5 text-lg font-semibold text-white/90">{liveCallup.activityTitle}</p>
        <p className="mt-2 text-sm text-white/60">The band is ready for you now.</p>
      </div>
    </div>
  );
}
