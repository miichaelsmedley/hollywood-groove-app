import type {
  SavedTable,
  WeeklyAttempt,
  WeeklyEpisode,
  WeeklyLockedAnswer,
  WeeklyPlayMode,
  WeeklyWatchMode,
} from './types';

const ATTEMPT_STORAGE_PREFIX = 'hg:weekly-attempt:v1:';
const LAST_TABLE_STORAGE_KEY = 'hg:weekly:last-table:v1';

function storageAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return typeof window.localStorage !== 'undefined';
  } catch {
    return false;
  }
}

function makeAttemptId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `attempt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function clampPlayerCount(value: number): number {
  if (!Number.isFinite(value)) return 2;
  return Math.min(12, Math.max(2, Math.round(value)));
}

function attemptStorageKey(episodeSlug: string): string {
  return `${ATTEMPT_STORAGE_PREFIX}${episodeSlug}`;
}

function isValidDateString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && Number.isFinite(Date.parse(value));
}

export function createWeeklyAttempt(options: {
  episode: WeeklyEpisode;
  mode: WeeklyPlayMode;
  watchMode: WeeklyWatchMode;
  teamName?: string;
  playerCount?: number;
}): WeeklyAttempt {
  const isTable = options.mode === 'table';
  return {
    schemaVersion: 1,
    attemptId: makeAttemptId(),
    episodeSlug: options.episode.slug,
    episodeVersion: options.episode.version,
    mode: options.mode,
    watchMode: options.watchMode,
    teamName: isTable ? (options.teamName?.trim() || 'The Groove Crew') : null,
    playerCount: isTable ? clampPlayerCount(options.playerCount ?? 2) : 1,
    answers: {},
    currentQuestionIndex: 0,
    playbackSeconds: 0,
    furthestPlaybackSeconds: 0,
    startedAt: new Date().toISOString(),
    completedAt: null,
  };
}

function isWeeklyAttempt(value: unknown, episode: WeeklyEpisode): value is WeeklyAttempt {
  if (!value || typeof value !== 'object') return false;
  const attempt = value as Partial<WeeklyAttempt>;
  const validAnswers = typeof attempt.answers === 'object' && attempt.answers !== null
    ? Object.entries(attempt.answers).every(([questionId, rawAnswer]) => {
        const question = episode.questions.find((candidate) => candidate.id === questionId);
        if (!question || !rawAnswer || typeof rawAnswer !== 'object') return false;
        const answer = rawAnswer as Partial<WeeklyLockedAnswer>;
        return (
          typeof answer.optionIndex === 'number' &&
          Number.isInteger(answer.optionIndex) &&
          answer.optionIndex >= 0 &&
          answer.optionIndex < question.options.length &&
          typeof answer.lockedAtVideoSeconds === 'number' &&
          Number.isFinite(answer.lockedAtVideoSeconds) &&
          answer.lockedAtVideoSeconds >= 0 &&
          typeof answer.lockedAtClientMs === 'number' &&
          Number.isFinite(answer.lockedAtClientMs) &&
          answer.lockedAtClientMs >= 0
        );
      })
    : false;
  const validIdentity = attempt.mode === 'solo'
    ? attempt.teamName === null && attempt.playerCount === 1
    : typeof attempt.teamName === 'string' &&
      attempt.teamName.trim().length >= 2 &&
      attempt.teamName.length <= 32 &&
      typeof attempt.playerCount === 'number' &&
      Number.isInteger(attempt.playerCount) &&
      attempt.playerCount >= 2 &&
      attempt.playerCount <= 12;
  return (
    attempt.schemaVersion === 1 &&
    typeof attempt.attemptId === 'string' &&
    attempt.episodeSlug === episode.slug &&
    attempt.episodeVersion === episode.version &&
    (attempt.mode === 'solo' || attempt.mode === 'table') &&
    (attempt.watchMode === 'embedded' || attempt.watchMode === 'companion') &&
    validIdentity &&
    validAnswers &&
    typeof attempt.currentQuestionIndex === 'number' &&
    Number.isInteger(attempt.currentQuestionIndex) &&
    attempt.currentQuestionIndex >= 0 &&
    attempt.currentQuestionIndex < episode.questions.length &&
    typeof attempt.playbackSeconds === 'number' &&
    Number.isFinite(attempt.playbackSeconds) &&
    attempt.playbackSeconds >= 0 &&
    typeof attempt.furthestPlaybackSeconds === 'number' &&
    Number.isFinite(attempt.furthestPlaybackSeconds) &&
    attempt.furthestPlaybackSeconds >= attempt.playbackSeconds &&
    isValidDateString(attempt.startedAt) &&
    (attempt.completedAt === null || isValidDateString(attempt.completedAt))
  );
}

export function loadWeeklyAttempt(episode: WeeklyEpisode): WeeklyAttempt | null {
  if (!storageAvailable()) return null;
  try {
    const raw = window.localStorage.getItem(attemptStorageKey(episode.slug));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isWeeklyAttempt(parsed, episode) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveWeeklyAttempt(attempt: WeeklyAttempt): boolean {
  if (!storageAvailable()) return false;
  try {
    window.localStorage.setItem(
      attemptStorageKey(attempt.episodeSlug),
      JSON.stringify(attempt),
    );
    return true;
  } catch {
    // Private browsing and storage quotas can reject writes. The current
    // in-memory attempt remains playable even when resume is unavailable.
    return false;
  }
}

export function clearWeeklyAttempt(episodeSlug: string): void {
  if (!storageAvailable()) return;
  try {
    window.localStorage.removeItem(attemptStorageKey(episodeSlug));
  } catch {
    // Treat unavailable storage as an already-cleared session.
  }
}

export function scoreWeeklyAttempt(
  episode: WeeklyEpisode,
  answers: Record<string, WeeklyLockedAnswer>,
): number {
  return episode.questions.reduce(
    (score, question) => score + (
      answers[question.id]?.optionIndex === question.correctOptionIndex ? 1 : 0
    ),
    0,
  );
}

export function saveLastTable(table: SavedTable): boolean {
  if (!storageAvailable()) return false;
  try {
    window.localStorage.setItem(
      LAST_TABLE_STORAGE_KEY,
      JSON.stringify({
        teamName: table.teamName.trim().slice(0, 32),
        playerCount: clampPlayerCount(table.playerCount),
      }),
    );
    return true;
  } catch {
    // Remembering a table is a convenience, never a play requirement.
    return false;
  }
}

export function loadLastTable(): SavedTable | null {
  if (!storageAvailable()) return null;
  try {
    const raw = window.localStorage.getItem(LAST_TABLE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedTable>;
    if (typeof parsed.teamName !== 'string' || !parsed.teamName.trim()) return null;
    return {
      teamName: parsed.teamName.trim().slice(0, 32),
      playerCount: clampPlayerCount(parsed.playerCount ?? 2),
    };
  } catch {
    return null;
  }
}
