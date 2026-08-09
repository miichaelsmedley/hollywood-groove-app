export type WeeklyPlayMode = 'solo' | 'table';

export type WeeklyWatchMode = 'embedded' | 'companion';

export interface WeeklyQuestion {
  id: string;
  prompt: string;
  options: readonly string[];
  correctOptionIndex: number;
  reveal: string;
  opensAtSeconds: number;
  revealAtSeconds: number;
}

export interface WeeklyEpisode {
  slug: string;
  version: number;
  episodeNumber: number;
  title: string;
  strapline: string;
  youtubeVideoId: string | null;
  questions: readonly WeeklyQuestion[];
}

export interface WeeklyLockedAnswer {
  optionIndex: number;
  lockedAtVideoSeconds: number;
  lockedAtClientMs: number;
}

export interface WeeklyAttempt {
  schemaVersion: 1;
  attemptId: string;
  episodeSlug: string;
  episodeVersion: number;
  mode: WeeklyPlayMode;
  watchMode: WeeklyWatchMode;
  teamName: string | null;
  playerCount: number;
  answers: Record<string, WeeklyLockedAnswer>;
  currentQuestionIndex: number;
  playbackSeconds: number;
  furthestPlaybackSeconds: number;
  startedAt: string;
  completedAt: string | null;
}

export interface SavedTable {
  teamName: string;
  playerCount: number;
}
