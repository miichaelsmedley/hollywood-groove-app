import { useEffect, useState } from 'react';
import { useShow } from '../../contexts/ShowContext';

/**
 * Full-screen overlay that renders the controller-driven rich media moment
 * (image / video / audio / map) from `shows/{showId}/live/moment`. Appears and
 * clears in lock-step with the controller; the attendee may also dismiss it
 * locally. Additive to the live contract (v2.2) — absent on older shows.
 */
export default function MomentOverlay() {
  const { liveMoment } = useShow();
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);
  const [expiredAt, setExpiredAt] = useState<number | null>(null);

  // Reset local dismissal whenever a new moment starts.
  useEffect(() => {
    setDismissedAt(null);
    setExpiredAt(null);

    if (!liveMoment?.startedAt || !liveMoment.holdSeconds || liveMoment.holdSeconds <= 0) {
      return;
    }

    const remainingMs = Math.max(0, liveMoment.startedAt + liveMoment.holdSeconds * 1000 - Date.now());
    const timer = window.setTimeout(() => setExpiredAt(liveMoment.startedAt), remainingMs);
    return () => window.clearTimeout(timer);
  }, [liveMoment?.startedAt, liveMoment?.holdSeconds]);

  if (!liveMoment || liveMoment.phase !== 'displaying') return null;
  if (liveMoment.targetDisplays === 'band') return null;
  if (dismissedAt !== null && dismissedAt === liveMoment.startedAt) return null;
  if (expiredAt !== null && expiredAt === liveMoment.startedAt) return null;

  const { kind, assetUrl, caption, title, mapPins } = liveMoment;
  const isImageLike = kind === 'image' || kind === 'gallery' || (kind === 'map' && !!assetUrl);
  const hasRenderableContent =
    !!assetUrl ||
    (kind === 'map' && !!mapPins?.length);

  if (!hasRenderableContent) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 p-4">
      <button
        onClick={() => setDismissedAt(liveMoment.startedAt)}
        className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-2xl leading-none text-white hover:bg-white/20"
        aria-label="Dismiss moment"
      >
        ×
      </button>

      {title && (
        <h2 className="mb-3 text-center text-xl font-bold text-white sm:text-2xl">{title}</h2>
      )}

      <div className="flex max-h-[75vh] w-full max-w-3xl items-center justify-center">
        {isImageLike && assetUrl && (
          <img
            src={assetUrl}
            alt={caption ?? title ?? 'Moment'}
            className="max-h-[75vh] w-auto rounded-lg object-contain"
          />
        )}

        {kind === 'video' && assetUrl && (
          // Muted autoplay keeps mobile browsers from blocking playback; the
          // stage PA carries the audio.
          <video
            src={assetUrl}
            autoPlay
            loop
            muted
            playsInline
            className="max-h-[75vh] w-auto rounded-lg"
          />
        )}

        {kind === 'audio' && assetUrl && (
          <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-2xl bg-gray-900 p-8">
            <div className="text-5xl">🎧</div>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <audio src={assetUrl} autoPlay controls className="w-full" />
          </div>
        )}

        {!assetUrl && kind === 'map' && (
          <div className="text-center text-white">
            <div className="mb-2 text-lg font-semibold">{title ?? 'Map moment'}</div>
            {(mapPins ?? []).slice(0, 5).map((p, i) => (
              <div key={i} className="text-sm text-gray-300">
                {p.label ? `${p.label}: ` : ''}
                {p.lat.toFixed(4)}, {p.lng.toFixed(4)}
              </div>
            ))}
          </div>
        )}

      </div>

      {caption && (
        <p className="mt-4 max-w-2xl text-center text-base text-gray-200">{caption}</p>
      )}
    </div>
  );
}
