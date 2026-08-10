import { useCallback, useMemo, useRef, useState } from 'react';
import { ExternalLink, Music, Play, RotateCcw, Tv, UsersRound } from 'lucide-react';
import { useParams, useSearchParams } from 'react-router-dom';
import EpisodeAnswerPad from './EpisodeAnswerPad';
import EpisodeResults from './EpisodeResults';
import YouTubeEpisodePlayer, { type YouTubeEpisodePlayerHandle } from './YouTubeEpisodePlayer';
import WeeklySetup from './WeeklySetup';
import {
  getWeeklyEpisode,
  isWeeklyEpisodePlayable,
  WEEKLY_PREVIEW_ENABLED,
} from './episodeCatalog';
import type { WeeklyAttempt, WeeklyEpisode, WeeklyPlayMode, WeeklyWatchMode } from './types';
import {
  clearWeeklyAttempt,
  createWeeklyAttempt,
  loadLastTable,
  loadWeeklyAttempt,
  saveLastTable,
  saveWeeklyAttempt,
} from './weeklySession';

type ExperienceView = 'setup' | 'resume' | 'playing' | 'results';
type QuestionPhase = 'waiting' | 'open' | 'revealed';

function getQuestionIndexForPlayback(episode: WeeklyEpisode, seconds: number): number {
  let activeIndex = 0;
  episode.questions.forEach((question, index) => {
    if (seconds >= question.opensAtSeconds) activeIndex = index;
  });
  return activeIndex;
}

function formatPlaybackTime(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  return `${minutes}:${String(safeSeconds % 60).padStart(2, '0')}`;
}

function sanitiseChallengeName(value: string | null): string | null {
  if (!value) return null;
  const clean = value.trim().replace(/\s+/g, ' ').slice(0, 32);
  return clean.length >= 2 ? clean : null;
}

function WeeklyEpisodeExperience({ episode }: { episode: WeeklyEpisode }) {
  const [searchParams] = useSearchParams();
  const challengeName = sanitiseChallengeName(searchParams.get('challenge'));
  const playerFixture = WEEKLY_PREVIEW_ENABLED && searchParams.get('playerFixture') === '1';
  const hasVideo = Boolean(episode.youtubeVideoId) || playerFixture;
  const initialAttempt = useMemo(() => loadWeeklyAttempt(episode), [episode]);
  const [attempt, setAttempt] = useState<WeeklyAttempt | null>(initialAttempt);
  const [view, setView] = useState<ExperienceView>(initialAttempt ? 'resume' : 'setup');
  const [draftSelections, setDraftSelections] = useState<Record<string, number>>({});
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const lastPersistedSecondRef = useRef(Math.floor(initialAttempt?.playbackSeconds ?? 0));
  const youtubePlayerRef = useRef<YouTubeEpisodePlayerHandle | null>(null);
  const [savedTable, setSavedTable] = useState(() => loadLastTable());

  const reportStorageFailure = useCallback(() => {
    setStorageWarning('Your answers will work on this screen, but this browser is blocking saved progress. Do not refresh until you finish.');
  }, []);

  const persistAttempt = useCallback((nextAttempt: WeeklyAttempt) => {
    setAttempt(nextAttempt);
    if (!saveWeeklyAttempt(nextAttempt)) reportStorageFailure();
  }, [reportStorageFailure]);

  const handleStart = ({
    mode,
    teamName,
    playerCount,
  }: {
    mode: WeeklyPlayMode;
    teamName: string;
    playerCount: number;
  }) => {
    const watchMode: WeeklyWatchMode = hasVideo ? 'embedded' : 'companion';
    const nextAttempt = createWeeklyAttempt({
      episode,
      mode,
      watchMode,
      teamName,
      playerCount,
    });
    persistAttempt(nextAttempt);
    setView('playing');
  };

  const handleStartOver = () => {
    clearWeeklyAttempt(episode.slug);
    setAttempt(null);
    setDraftSelections({});
    setVideoPlaying(false);
    setView('setup');
  };

  const handleResume = () => {
    if (!attempt) {
      setView('setup');
      return;
    }
    setView(attempt.completedAt ? 'results' : 'playing');
  };

  const handlePlaybackSeconds = useCallback((seconds: number) => {
    setAttempt((currentAttempt) => {
      if (!currentAttempt || currentAttempt.completedAt || currentAttempt.watchMode !== 'embedded') {
        return currentAttempt;
      }
      const nextQuestionIndex = getQuestionIndexForPlayback(episode, seconds);
      const nextAttempt: WeeklyAttempt = {
        ...currentAttempt,
        playbackSeconds: seconds,
        furthestPlaybackSeconds: Math.max(currentAttempt.furthestPlaybackSeconds, seconds),
        currentQuestionIndex: nextQuestionIndex,
      };
      const wholeSecond = Math.floor(seconds);
      if (wholeSecond !== lastPersistedSecondRef.current) {
        lastPersistedSecondRef.current = wholeSecond;
        if (!saveWeeklyAttempt(nextAttempt)) {
          queueMicrotask(reportStorageFailure);
        }
      }
      return nextAttempt;
    });
  }, [episode, reportStorageFailure]);

  const handleWatchModeChange = (watchMode: WeeklyWatchMode) => {
    if (!attempt || (watchMode === 'embedded' && !hasVideo)) return;
    const nextAttempt: WeeklyAttempt = {
      ...attempt,
      watchMode,
      currentQuestionIndex: watchMode === 'embedded'
        ? getQuestionIndexForPlayback(episode, attempt.playbackSeconds)
        : attempt.currentQuestionIndex,
    };
    persistAttempt(nextAttempt);
  };

  const handleSelectOption = (questionId: string, optionIndex: number) => {
    if (!attempt || attempt.answers[questionId]) return;
    setDraftSelections((selections) => ({ ...selections, [questionId]: optionIndex }));
  };

  const handleLockAnswer = (questionId: string) => {
    const optionIndex = draftSelections[questionId];
    if (typeof optionIndex !== 'number') return;
    setAttempt((currentAttempt) => {
      if (!currentAttempt || currentAttempt.answers[questionId]) return currentAttempt;
      const question = episode.questions.find((candidate) => candidate.id === questionId);
      if (!question) return currentAttempt;

      const sampledSeconds = currentAttempt.watchMode === 'embedded'
        ? youtubePlayerRef.current?.getCurrentTime() ?? currentAttempt.playbackSeconds
        : currentAttempt.playbackSeconds;
      const furthestPlaybackSeconds = Math.max(
        currentAttempt.furthestPlaybackSeconds,
        sampledSeconds,
      );
      const isOpen = currentAttempt.watchMode === 'companion'
        ? furthestPlaybackSeconds < question.revealAtSeconds
        : sampledSeconds >= question.opensAtSeconds &&
          furthestPlaybackSeconds < question.revealAtSeconds;

      if (!isOpen) {
        const progressedAttempt = {
          ...currentAttempt,
          playbackSeconds: sampledSeconds,
          furthestPlaybackSeconds,
        };
        if (!saveWeeklyAttempt(progressedAttempt)) queueMicrotask(reportStorageFailure);
        return progressedAttempt;
      }

      const nextAttempt: WeeklyAttempt = {
        ...currentAttempt,
        playbackSeconds: sampledSeconds,
        furthestPlaybackSeconds,
        answers: {
          ...currentAttempt.answers,
          [questionId]: {
            optionIndex,
            lockedAtVideoSeconds: sampledSeconds,
            lockedAtClientMs: Date.now(),
          },
        },
      };
      if (!saveWeeklyAttempt(nextAttempt)) queueMicrotask(reportStorageFailure);
      return nextAttempt;
    });
  };

  const handleQuestionMove = (direction: -1 | 1) => {
    if (!attempt || attempt.watchMode !== 'companion') return;
    const nextIndex = Math.min(
      episode.questions.length - 1,
      Math.max(0, attempt.currentQuestionIndex + direction),
    );
    persistAttempt({ ...attempt, currentQuestionIndex: nextIndex });
  };

  const handleFinish = () => {
    setAttempt((currentAttempt) => {
      if (!currentAttempt || currentAttempt.currentQuestionIndex !== episode.questions.length - 1) {
        return currentAttempt;
      }
      const finalQuestion = episode.questions[episode.questions.length - 1];
      const sampledSeconds = currentAttempt.watchMode === 'embedded'
        ? youtubePlayerRef.current?.getCurrentTime() ?? currentAttempt.playbackSeconds
        : currentAttempt.playbackSeconds;
      const furthestPlaybackSeconds = Math.max(currentAttempt.furthestPlaybackSeconds, sampledSeconds);
      if (currentAttempt.watchMode === 'embedded' && furthestPlaybackSeconds < finalQuestion.revealAtSeconds) {
        return currentAttempt;
      }
      const nextAttempt: WeeklyAttempt = {
        ...currentAttempt,
        playbackSeconds: sampledSeconds,
        furthestPlaybackSeconds,
        completedAt: currentAttempt.completedAt ?? new Date().toISOString(),
      };
      if (!saveWeeklyAttempt(nextAttempt)) queueMicrotask(reportStorageFailure);
      queueMicrotask(() => {
        setView('results');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
      return nextAttempt;
    });
  };

  const handleRememberTable = (): boolean => {
    if (!attempt?.teamName) return false;
    const table = { teamName: attempt.teamName, playerCount: attempt.playerCount };
    const saved = saveLastTable(table);
    if (saved) setSavedTable(table);
    return saved;
  };

  const currentQuestion = attempt
    ? episode.questions[Math.min(episode.questions.length - 1, Math.max(0, attempt.currentQuestionIndex))]
    : null;
  const questionPhase: QuestionPhase = !attempt || !currentQuestion
    ? 'waiting'
    : attempt.furthestPlaybackSeconds >= currentQuestion.revealAtSeconds
      ? 'revealed'
      : attempt.watchMode === 'companion'
        ? 'open'
        : attempt.playbackSeconds >= currentQuestion.opensAtSeconds
          ? 'open'
          : 'waiting';

  return (
    <div className="min-h-screen bg-cinema text-cinema-900">
      <header className="border-b border-cinema-200 bg-cinema/95 px-4 py-3 safe-area-pt">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <a href="/" className="flex min-h-11 items-center gap-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary">
            <Music className="h-8 w-8 text-primary" aria-hidden="true" />
            <span className="font-display text-lg font-bold text-white">Hollywood Groove</span>
          </a>
          <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-primary">
            Watch &amp; Play
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-6 pb-12 sm:py-8">
        <div className="mb-6 text-center">
          <p className="text-sm font-semibold text-primary">Episode {episode.episodeNumber}</p>
          <h1 className="mt-1 text-2xl font-black text-white sm:text-3xl">{episode.title}</h1>
          <p className="mt-1 text-sm text-cinema-600">{episode.strapline}</p>
        </div>

        {view === 'setup' && (
          <WeeklySetup
            episode={episode}
            savedTable={savedTable}
            challengeName={challengeName}
            onStart={handleStart}
          />
        )}

        {view === 'resume' && attempt && (
          <section className="mx-auto max-w-xl rounded-3xl border border-primary/40 bg-cinema-50 p-6 text-center shadow-glow">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-primary">
              {attempt.mode === 'table' ? <UsersRound className="h-7 w-7" aria-hidden="true" /> : <Play className="h-7 w-7" aria-hidden="true" />}
            </div>
            <h2 className="mt-4 text-2xl font-black text-white">
              {attempt.completedAt ? 'Your result is ready' : 'Continue where you left off'}
            </h2>
            <p className="mt-2 text-cinema-600">
              {attempt.mode === 'table' ? attempt.teamName : 'Solo player'} · {Object.keys(attempt.answers).length} of {episode.questions.length} answers locked
            </p>
            <button
              type="button"
              onClick={handleResume}
              className="mt-5 min-h-12 w-full cursor-pointer rounded-xl bg-primary px-4 font-black text-cinema transition-colors hover:bg-primary-400 focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {attempt.completedAt ? 'View result' : 'Resume playing'}
            </button>
            <button
              type="button"
              onClick={handleStartOver}
              className="mt-3 inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl px-4 font-semibold text-cinema-600 transition-colors hover:text-white focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Start over
            </button>
          </section>
        )}

        {view === 'playing' && attempt && currentQuestion && (
          <div className="space-y-4">
            {hasVideo && attempt.watchMode === 'embedded' ? (
              <div className="weekly-video-shell sticky top-0 z-20 -mx-2 bg-cinema/95 px-2 py-2 backdrop-blur">
                <YouTubeEpisodePlayer
                  ref={youtubePlayerRef}
                  videoId={episode.youtubeVideoId ?? 'fixture0001'}
                  title={episode.title}
                  initialSeconds={attempt.playbackSeconds}
                  onPlaybackSeconds={handlePlaybackSeconds}
                  onPlayingChange={setVideoPlaying}
                  fixtureClock={playerFixture}
                  fixtureCues={{
                    firstQuestionOpensAtSeconds: episode.questions[0].opensAtSeconds,
                    firstQuestionRevealsAtSeconds: episode.questions[0].revealAtSeconds,
                    finalQuestionNumber: episode.questions.length,
                    finalQuestionOpensAtSeconds: episode.questions[episode.questions.length - 1].opensAtSeconds,
                    finalQuestionRevealsAtSeconds: episode.questions[episode.questions.length - 1].revealAtSeconds,
                  }}
                />
                <div className="mt-2 flex items-center justify-between px-1 text-xs text-cinema-500">
                  <span>{videoPlaying ? 'Following the video' : 'Paused — answers stay in place'}</span>
                  <span>{formatPlaybackTime(attempt.playbackSeconds)}</span>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-cinema-200 bg-gradient-to-br from-cinema-50 to-cinema p-5 text-center">
                <Tv className="mx-auto h-8 w-8 text-primary" aria-hidden="true" />
                <h2 className="mt-3 font-bold text-white">
                  {hasVideo ? 'Watching on your TV?' : 'The episode video is being prepared'}
                </h2>
                <p className="mx-auto mt-1 max-w-md text-sm text-cinema-600">
                  {hasVideo
                    ? 'Keep the video on the big screen and use this device as your team answer pad.'
                    : 'The complete team answer-pad preview is ready below. Connect the YouTube ID to place the video here.'}
                </p>
                {episode.youtubeVideoId && (
                  <a
                    href={`https://www.youtube.com/watch?v=${episode.youtubeVideoId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-primary/50 px-4 py-2 font-semibold text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    Open video on YouTube
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  </a>
                )}
              </div>
            )}

            {hasVideo && (
              <div className="grid grid-cols-2 gap-2 rounded-2xl border border-cinema-200 bg-cinema-50 p-1.5" role="radiogroup" aria-label="Where the video is playing">
                <button
                  type="button"
                  role="radio"
                  aria-checked={attempt.watchMode === 'embedded'}
                  onClick={() => handleWatchModeChange('embedded')}
                  className={`min-h-11 cursor-pointer rounded-xl px-3 text-sm font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-primary ${attempt.watchMode === 'embedded' ? 'bg-primary text-cinema' : 'text-cinema-600 hover:text-white'}`}
                >
                  Video on this device
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={attempt.watchMode === 'companion'}
                  onClick={() => handleWatchModeChange('companion')}
                  className={`min-h-11 cursor-pointer rounded-xl px-3 text-sm font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-primary ${attempt.watchMode === 'companion' ? 'bg-primary text-cinema' : 'text-cinema-600 hover:text-white'}`}
                >
                  Video on the TV
                </button>
              </div>
            )}

            {storageWarning && (
              <p role="status" className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
                {storageWarning}
              </p>
            )}

            <EpisodeAnswerPad
              question={currentQuestion}
              questionIndex={attempt.currentQuestionIndex}
              questionCount={episode.questions.length}
              attempt={attempt}
              selectedOptionIndex={draftSelections[currentQuestion.id] ?? null}
              phase={questionPhase}
              companionMode={attempt.watchMode === 'companion'}
              onSelectOption={(optionIndex) => handleSelectOption(currentQuestion.id, optionIndex)}
              onLockAnswer={() => handleLockAnswer(currentQuestion.id)}
              onPrevious={() => handleQuestionMove(-1)}
              onNext={() => handleQuestionMove(1)}
              onFinish={handleFinish}
            />
          </div>
        )}

        {view === 'results' && attempt && (
          <EpisodeResults
            episode={episode}
            attempt={attempt}
            onRememberTable={handleRememberTable}
            onPlayAgain={handleStartOver}
          />
        )}
      </main>
    </div>
  );
}

export default function WeeklyEpisodePage() {
  const { slug } = useParams<{ slug: string }>();
  const episode = getWeeklyEpisode(slug);

  if (!episode) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-cinema px-4 text-center text-cinema-900">
        <div className="max-w-md rounded-3xl border border-cinema-200 bg-cinema-50 p-8">
          <Music className="mx-auto h-10 w-10 text-primary" aria-hidden="true" />
          <h1 className="mt-4 text-2xl font-black text-white">That episode is not available</h1>
          <p className="mt-2 text-cinema-600">Open the latest Hollywood Groove Watch &amp; Play episode instead.</p>
          <a href="/weekly" className="mt-5 inline-flex min-h-12 items-center rounded-xl bg-primary px-5 font-black text-cinema focus:outline-none focus:ring-2 focus:ring-primary">
            Go to the latest episode
          </a>
        </div>
      </main>
    );
  }

  if (!isWeeklyEpisodePlayable(episode)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-cinema px-4 text-center text-cinema-900">
        <div className="max-w-md rounded-3xl border border-primary/30 bg-cinema-50 p-8 shadow-cinema">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/15">
            <Tv className="h-7 w-7 text-primary" aria-hidden="true" />
          </div>
          <p className="mt-5 text-sm font-bold uppercase tracking-[0.18em] text-primary">
            Episode {episode.episodeNumber}
          </p>
          <h1 className="mt-2 text-2xl font-black text-white">The video is coming soon</h1>
          <p className="mt-2 text-cinema-600">
            {episode.title} is ready for its YouTube premiere. Watch &amp; Play will open here as soon as the episode is published.
          </p>
          <a href="/" className="mt-5 inline-flex min-h-12 items-center rounded-xl bg-primary px-5 font-black text-cinema focus:outline-none focus:ring-2 focus:ring-primary">
            Back to Hollywood Groove
          </a>
        </div>
      </main>
    );
  }

  return <WeeklyEpisodeExperience key={`${episode.slug}:${episode.version}`} episode={episode} />;
}
