import { useMemo, useState } from 'react';
import { Check, Copy, RotateCcw, Share2, Ticket, UsersRound } from 'lucide-react';
import type { WeeklyAttempt, WeeklyEpisode } from './types';
import { scoreWeeklyAttempt } from './weeklySession';

interface EpisodeResultsProps {
  episode: WeeklyEpisode;
  attempt: WeeklyAttempt;
  onRememberTable: () => boolean;
  onPlayAgain: () => void;
}

export default function EpisodeResults({
  episode,
  attempt,
  onRememberTable,
  onPlayAgain,
}: EpisodeResultsProps) {
  const [copied, setCopied] = useState(false);
  const [remembered, setRemembered] = useState(false);
  const [rememberError, setRememberError] = useState(false);
  const nativeShare = Reflect.get(navigator, 'share') as ((data: ShareData) => Promise<void>) | undefined;
  const score = scoreWeeklyAttempt(episode, attempt.answers);
  const scoreRatio = episode.questions.length > 0 ? score / episode.questions.length : 0;
  const subject = attempt.mode === 'table' ? attempt.teamName ?? 'Our team' : 'I';
  const resultUrl = useMemo(() => {
    const url = new URL(`/weekly/${episode.slug}`, window.location.origin);
    url.searchParams.set('challenge', subject);
    return url.toString();
  }, [episode.slug, subject]);
  const shareText = `${subject} scored ${score}/${episode.questions.length} on Hollywood Groove’s ${episode.title} quiz. Can you beat that?`;

  const handleShare = async () => {
    try {
      if (typeof nativeShare === 'function') {
        await nativeShare.call(navigator, {
          title: `${episode.title} team challenge`,
          text: shareText,
          url: resultUrl,
        });
        return;
      }
      await navigator.clipboard.writeText(`${shareText} ${resultUrl}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      try {
        await navigator.clipboard.writeText(`${shareText} ${resultUrl}`);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2500);
      } catch {
        setCopied(false);
      }
    }
  };

  const handleRemember = () => {
    const saved = onRememberTable();
    setRemembered(saved);
    setRememberError(!saved);
  };

  return (
    <section className="mx-auto w-full max-w-xl space-y-5" aria-labelledby="weekly-result-heading">
      <div className="overflow-hidden rounded-3xl border border-primary/40 bg-gradient-to-b from-primary/20 to-cinema-50 shadow-glow-lg">
        <div className="p-6 text-center sm:p-8">
          {attempt.mode === 'table' && (
            <div className="mx-auto flex w-fit items-center gap-2 rounded-full border border-primary/30 bg-cinema/70 px-3 py-1.5 text-sm font-bold text-primary">
              <UsersRound className="h-4 w-4" aria-hidden="true" />
              {attempt.teamName}
            </div>
          )}
          <p className="mt-5 text-sm font-bold uppercase tracking-[0.2em] text-cinema-600">Final score</p>
          <h1 id="weekly-result-heading" className="mt-1 text-6xl font-black text-white sm:text-7xl">
            {score}<span className="text-3xl text-primary">/{episode.questions.length}</span>
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-base text-cinema-700">
            {scoreRatio >= 0.8
              ? 'That table knows its movie music. Send the challenge before the confidence wears off.'
              : scoreRatio >= 0.5
                ? 'A respectable result with plenty to debate on the way home.'
                : 'The comeback starts next week. Choose the strongest soundtrack expert as captain.'}
          </p>
          {attempt.mode === 'table' && (
            <p className="mt-2 text-sm text-cinema-500">
              {attempt.playerCount} players, one shared answer pad
            </p>
          )}
        </div>

        <div className="grid gap-3 border-t border-cinema-200 bg-cinema/40 p-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => void handleShare()}
            className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-4 font-black text-cinema transition-colors hover:bg-primary-400 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {copied ? <Check className="h-5 w-5" aria-hidden="true" /> : typeof nativeShare === 'function' ? <Share2 className="h-5 w-5" aria-hidden="true" /> : <Copy className="h-5 w-5" aria-hidden="true" />}
            {copied ? 'Challenge copied' : attempt.mode === 'table' ? 'Challenge another team' : 'Share my score'}
          </button>
          <button
            type="button"
            onClick={onPlayAgain}
            className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-cinema-200 px-4 font-bold text-cinema-800 transition-colors hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <RotateCcw className="h-5 w-5" aria-hidden="true" />
            Play again for practice
          </button>
        </div>
      </div>

      {attempt.mode === 'table' && (
        <div>
          <button
            type="button"
            onClick={handleRemember}
            disabled={remembered}
            className="min-h-12 w-full cursor-pointer rounded-xl border border-primary/50 bg-primary/10 px-4 font-bold text-primary transition-colors hover:bg-primary/15 focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-default disabled:border-emerald-500/40 disabled:bg-emerald-500/10 disabled:text-emerald-300"
          >
            {remembered ? 'Crew saved for next week' : 'Keep this crew for next week'}
          </button>
          {rememberError && (
            <p role="status" className="mt-2 text-center text-sm text-amber-200">
              This browser could not save your crew, but your result is still here.
            </p>
          )}
        </div>
      )}

      <a
        href="/shows"
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-cinema-200 bg-cinema-50 px-4 font-bold text-cinema-800 transition-colors hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
      >
        <Ticket className="h-5 w-5 text-primary" aria-hidden="true" />
        Bring the team to a live Hollywood Groove night
      </a>

      <p className="text-center text-xs leading-relaxed text-cinema-500">
        This is a casual play-at-home score saved on this device. The video can be paused or replayed, so there are no prizes or official rankings.
      </p>
    </section>
  );
}
