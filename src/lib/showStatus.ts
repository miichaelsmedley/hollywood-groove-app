import type { LiveActivityState, LiveTriviaState, ShowMeta, TriviaPhase } from '../types/firebaseContract';

const ACTIVE_TRIVIA_PHASES: TriviaPhase[] = ['question', 'answer'];
export const LIVE_STATE_MAX_AGE_MS = 30 * 60 * 1000;

type TimestampedTriviaState = LiveTriviaState & {
  updatedAt?: number;
  timestamp?: number;
};

type TimestampedActivityState = LiveActivityState & {
  updatedAt?: number;
  timestamp?: number;
};

export interface ShowRecordSnapshot {
  meta?: ShowMeta;
  live?: {
    trivia?: TimestampedTriviaState;
    activity?: TimestampedActivityState;
  };
}

function getLiveTimestamp(state?: { updatedAt?: number; timestamp?: number; startedAt?: number }): number | null {
  const timestamp = state?.updatedAt ?? state?.timestamp ?? state?.startedAt;
  return typeof timestamp === 'number' && Number.isFinite(timestamp) ? timestamp : null;
}

function isFreshLiveState(timestamp: number | null, now: number): boolean {
  return timestamp !== null && now - timestamp <= LIVE_STATE_MAX_AGE_MS;
}

export function isShowLive(showData: ShowRecordSnapshot | null | undefined, now = Date.now()): boolean {
  const liveTrivia = showData?.live?.trivia;
  const triviaTimestamp = getLiveTimestamp(liveTrivia);
  const triviaActive = Boolean(
    liveTrivia?.phase &&
    ACTIVE_TRIVIA_PHASES.includes(liveTrivia.phase) &&
    isFreshLiveState(triviaTimestamp, now)
  );

  const liveActivity = showData?.live?.activity;
  const activityTimestamp = getLiveTimestamp(liveActivity);
  const activityActive = Boolean(
    liveActivity?.status === 'active' &&
    isFreshLiveState(activityTimestamp, now)
  );

  return triviaActive || activityActive;
}
