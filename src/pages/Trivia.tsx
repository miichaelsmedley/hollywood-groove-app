import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { onValue, ref, set } from 'firebase/database';
import { ArrowLeft, Clock, Trophy, CheckCircle, Users } from 'lucide-react';
import { db } from '../lib/firebase';
import { LiveTriviaState, CrowdActivity, UserScore, UserTriviaResult } from '../types/firebaseContract';
import ActionBar from '../components/show/ActionBar';
import ShareButton from '../components/ShareButton';
import RealtimeConnectionPill from '../components/show/RealtimeConnectionPill';
import { getShowPath, getTestShowPath } from '../lib/mode';
import { getTriviaFixture, recordE2EResponse, type E2EUser } from '../lib/e2eShowFixtures';
import { useAuthUser } from '../features/auth/useAuthUser';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { useServerTimeOffset } from '../hooks/useServerTimeOffset';
import { useTeamLeaderboard, useTeamShowScore } from '../hooks/useTeamLeaderboard';
import { useUserTeam } from '../hooks/useUserTeam';

function formatOrdinal(rank: number): string {
  const suffix = rank % 100 >= 11 && rank % 100 <= 13
    ? 'th'
    : rank % 10 === 1
      ? 'st'
      : rank % 10 === 2
        ? 'nd'
        : rank % 10 === 3
          ? 'rd'
          : 'th';
  return `${rank}${suffix}`;
}

function formatPoints(points: number): string {
  return points.toLocaleString();
}

function getTriviaImageSrc(
  image: { url?: string; base64?: string; mimeType?: string } | undefined
): string | null {
  if (!image) return null;
  if (image.url?.trim()) return image.url.trim();
  if (image.base64 && image.mimeType) {
    return `data:${image.mimeType};base64,${image.base64}`;
  }
  return null;
}

interface TriviaResponse {
  optionIndex?: number;
  text?: string;
  booleanValue?: boolean;
  scaleValue?: number;
  answeredAt?: number;
  responseTime?: number;
  displayName?: string;
}

type PendingTriviaAnswer =
  | { kind: 'multi'; optionIndex: number }
  | { kind: 'freeform'; text: string }
  | { kind: 'boolean'; value: boolean }
  | { kind: 'scale'; value: number };

function responseBelongsToQuestion(
  response: TriviaResponse | null,
  startedAt: number | null
): response is TriviaResponse {
  if (!response) return false;
  if (startedAt === null || typeof response.answeredAt !== 'number') return true;
  return response.answeredAt >= startedAt;
}

export default function Trivia() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const [liveTrivia, setLiveTrivia] = useState<LiveTriviaState | null>(null);
  const [currentActivity, setCurrentActivity] = useState<CrowdActivity | null>(null);
  const [myScore, setMyScore] = useState<UserScore | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [freeformText, setFreeformText] = useState('');
  const [booleanValue, setBooleanValue] = useState<boolean | null>(null);
  const [scaleValue, setScaleValue] = useState<number | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitIsSlow, setSubmitIsSlow] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [retryAnswer, setRetryAnswer] = useState<PendingTriviaAnswer | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [myResult, setMyResult] = useState<UserTriviaResult | null>(null);
  const [isResultPending, setIsResultPending] = useState(false);
  const activityUnsubscribeRef = useRef<(() => void) | null>(null);
  const activeActivityIdRef = useRef<string | null>(null);
  const activeQuestionKeyRef = useRef<string | null>(null);
  const lastQuestionNudgeRef = useRef<string | null>(null);
  const submitSlowTimerRef = useRef<number | null>(null);
  const fixtureName = searchParams.get('fixture');
  const triviaFixture = useMemo(() => getTriviaFixture(fixtureName), [fixtureName]);

  // Check if this is a test show via query param
  const isTestShow = searchParams.get('test') === 'true';
  const searchSuffix = searchParams.toString() ? `?${searchParams.toString()}` : '';
  const authUser = useAuthUser();
  const currentUser = triviaFixture?.user ?? (authUser
    ? { uid: authUser.uid, displayName: authUser.displayName || 'Anonymous' }
    : null);
  const currentUserId = currentUser?.uid ?? null;
  const serverTimeOffset = useServerTimeOffset();

  const leaderboardState = useLeaderboard(
    triviaFixture ? null : id ?? null,
    currentUserId,
    { isTestShow }
  );
  const leaderboardEntries = triviaFixture?.leaderboard?.top ?? leaderboardState.entries;

  const { team: liveUserTeam } = useUserTeam({ isTestMode: isTestShow });
  const userTeam = triviaFixture?.team ?? liveUserTeam;
  const { score: liveTeamScore } = useTeamShowScore(
    triviaFixture ? null : id ?? null,
    userTeam?.team_id ?? null,
    { isTestShow }
  );
  const teamScore = triviaFixture?.teamScore ?? liveTeamScore;
  const { entries: liveTeamEntries } = useTeamLeaderboard(
    triviaFixture ? null : id ?? null,
    { isTestShow }
  );
  const teamEntries = triviaFixture?.teamLeaderboard?.top ?? liveTeamEntries;

  const currentUserRank = useMemo(() => {
    if (!currentUserId) return null;
    const index = leaderboardEntries.findIndex((entry) => entry.uid === currentUserId);
    return index >= 0 ? index + 1 : null;
  }, [currentUserId, leaderboardEntries]);

  const currentUserLeaderboardEntry = useMemo(() => {
    if (!currentUserId) return null;
    return leaderboardEntries.find((entry) => entry.uid === currentUserId) ?? null;
  }, [currentUserId, leaderboardEntries]);

  const nextPlayerAbove = currentUserRank && currentUserRank > 1
    ? leaderboardEntries[currentUserRank - 2] ?? null
    : null;

  const playerStandingText = (() => {
    if (currentUserRank && currentUserLeaderboardEntry) {
      if (currentUserRank === 1) {
        return `${formatOrdinal(currentUserRank)} — leading the room`;
      }

      if (nextPlayerAbove) {
        const gap = Math.max(0, nextPlayerAbove.totalScore - currentUserLeaderboardEntry.totalScore);
        return `${formatOrdinal(currentUserRank)} — ${formatPoints(gap)} pts behind ${nextPlayerAbove.displayName || 'the next player'}`;
      }

      return `${formatOrdinal(currentUserRank)} — ${formatPoints(currentUserLeaderboardEntry.totalScore)} pts`;
    }

    if (myScore) {
      return `${formatPoints(myScore.totalScore)} pts — waiting for rank`;
    }

    return 'No score yet — jump in on the next question';
  })();

  const currentTeamRank = useMemo(() => {
    if (!userTeam?.team_id) return null;
    const index = teamEntries.findIndex((entry) => entry.team_id === userTeam.team_id);
    if (index >= 0) {
      return teamEntries[index].rank ?? index + 1;
    }
    return null;
  }, [teamEntries, userTeam?.team_id]);

  const tableStandingText = (() => {
    if (!userTeam) return 'No Table yet — join one from the Teams tab';
    const score = teamScore?.combined_score;
    if (currentTeamRank && typeof score === 'number') {
      return `${formatOrdinal(currentTeamRank)} — ${formatPoints(score)} pts`;
    }
    if (typeof score === 'number') {
      return `${formatPoints(score)} pts — waiting for rank`;
    }
    return 'Table score warming up';
  })();

  const winnerDisplayName = useMemo(() => {
    const explicitName = liveTrivia?.revealedWinnerName?.trim();
    if (explicitName) return explicitName;
    const winnerUid = liveTrivia?.revealedWinnerUid;
    if (!winnerUid) return null;
    return leaderboardEntries.find((entry) => entry.uid === winnerUid)?.displayName ?? null;
  }, [leaderboardEntries, liveTrivia?.revealedWinnerName, liveTrivia?.revealedWinnerUid]);

  const isCurrentUserWinner = Boolean(
    liveTrivia?.revealedWinnerUid &&
    currentUserId &&
    liveTrivia.revealedWinnerUid === currentUserId
  );

  // Helper to get the correct path based on whether it's a test show
  const getPath = useMemo(() => {
    return (showId: string, suffix?: string) => {
      return isTestShow ? getTestShowPath(showId, suffix) : getShowPath(showId, suffix);
    };
  }, [isTestShow]);

  const clearSubmitSlowTimer = () => {
    if (submitSlowTimerRef.current !== null) {
      window.clearTimeout(submitSlowTimerRef.current);
      submitSlowTimerRef.current = null;
    }
  };

  const resetLocalAnswerState = () => {
    clearSubmitSlowTimer();
    setHasAnswered(false);
    setSubmitting(false);
    setSubmitIsSlow(false);
    setSubmitError(null);
    setRetryAnswer(null);
    setSelectedOption(null);
    setFreeformText('');
    setBooleanValue(null);
    setScaleValue(null);
  };

  useEffect(() => {
    return () => clearSubmitSlowTimer();
  }, []);

  useEffect(() => {
    if (!id) return;

    if (triviaFixture) {
      activeActivityIdRef.current = triviaFixture.live.activityId;
      activeQuestionKeyRef.current = `${triviaFixture.live.activityId}:${triviaFixture.live.startedAt ?? ''}`;
      setLiveTrivia(triviaFixture.live);
      setCurrentActivity(triviaFixture.activity);
      setMyScore(triviaFixture.score);
      setMyResult(triviaFixture.result ?? null);
      setIsResultPending(false);
      setHasAnswered(Boolean(triviaFixture.result));
      setSubmitting(false);
      setSubmitIsSlow(false);
      setSubmitError(null);
      setRetryAnswer(null);
      setSelectedOption(triviaFixture.result ? 0 : null);
      setFreeformText('');
      setBooleanValue(null);
      setScaleValue(null);
      return () => {
        activeActivityIdRef.current = null;
        activeQuestionKeyRef.current = null;
      };
    }

    const triviaPath = getPath(id, 'live/trivia');
    console.log(`📡 Trivia: Listening to ${triviaPath} (testMode=${isTestShow})`);
    const cleanupActivityListener = () => {
      if (activityUnsubscribeRef.current) {
        activityUnsubscribeRef.current();
        activityUnsubscribeRef.current = null;
      }
    };

    // Listen to live trivia state
    const unsubscribeLive = onValue(
      ref(db, triviaPath),
      (snapshot) => {
        const state = snapshot.val() as LiveTriviaState | null;
        console.log(`📡 Trivia: Received data from ${triviaPath}:`, state);
        const nextActivityId = state?.activityId ?? null;
        const previousActivityId = activeActivityIdRef.current;
        const nextQuestionKey = nextActivityId
          ? `${nextActivityId}:${state?.startedAt ?? ''}`
          : null;

        // Reset local answer state when the activity or publish time changes.
        if (nextQuestionKey !== activeQuestionKeyRef.current) {
          resetLocalAnswerState();
          activeQuestionKeyRef.current = nextQuestionKey;
          if (nextActivityId !== previousActivityId) {
            setCurrentActivity(null);
          }
        }

        // Subscribe to the current activity (and clean up prior subscription)
        if (nextActivityId !== previousActivityId) {
          cleanupActivityListener();
          activeActivityIdRef.current = nextActivityId;

          if (nextActivityId) {
            const activityRef = ref(db, getPath(id, `activities/${nextActivityId}`));
            activityUnsubscribeRef.current = onValue(activityRef, (activitySnapshot) => {
              setCurrentActivity(activitySnapshot.val() as CrowdActivity | null);
            });
          }
        }

        setLiveTrivia(state);
      }
    );

    // Listen to user's score
    let unsubscribeScore: (() => void) | null = null;
    if (currentUserId) {
      unsubscribeScore = onValue(
        ref(db, getPath(id, `scores/${currentUserId}`)),
        (snapshot) => {
          setMyScore(snapshot.val() as UserScore | null);
        }
      );
    }

    return () => {
      unsubscribeLive();
      unsubscribeScore?.();
      cleanupActivityListener();
      activeActivityIdRef.current = null;
      activeQuestionKeyRef.current = null;
    };
  }, [currentUserId, id, getPath, triviaFixture]);

  useEffect(() => {
    if (triviaFixture) {
      return;
    }

    if (!id || !currentUserId || !liveTrivia?.activityId) {
      setHasAnswered(false);
      return;
    }

    const startedAt = typeof liveTrivia.startedAt === 'number'
      ? liveTrivia.startedAt
      : null;
    const responseRef = ref(db, getPath(id, `responses/${liveTrivia.activityId}/${currentUserId}`));
    const unsubscribe = onValue(
      responseRef,
      (snapshot) => {
        const response = snapshot.val() as TriviaResponse | null;
        if (!responseBelongsToQuestion(response, startedAt)) {
          setHasAnswered(false);
          return;
        }

        clearSubmitSlowTimer();
        setSubmitting(false);
        setSubmitIsSlow(false);
        setSubmitError(null);
        setRetryAnswer(null);
        setHasAnswered(true);

        if (typeof response.optionIndex === 'number') {
          setSelectedOption(response.optionIndex);
        }
        if (typeof response.booleanValue === 'boolean') {
          setBooleanValue(response.booleanValue);
        }
        if (typeof response.scaleValue === 'number') {
          setScaleValue(response.scaleValue);
        }
      },
      (error) => {
        console.error('Failed to load trivia response:', error);
      }
    );

    return () => unsubscribe();
  }, [
    currentUserId,
    getPath,
    id,
    liveTrivia?.activityId,
    liveTrivia?.startedAt,
    triviaFixture,
  ]);

  useEffect(() => {
    if (triviaFixture) {
      setMyResult(triviaFixture.result ?? null);
      setIsResultPending(false);
      return;
    }

    if (!id || !currentUserId || liveTrivia?.phase !== 'answer' || !liveTrivia.activityId) {
      setMyResult(null);
      setIsResultPending(false);
      return;
    }

    setMyResult(null);
    setIsResultPending(true);

    let resultArrived = false;
    const pendingTimer = window.setTimeout(() => {
      if (!resultArrived) {
        setIsResultPending(false);
      }
    }, 2500);

    const resultRef = ref(db, getPath(id, `results/${liveTrivia.activityId}/${currentUserId}`));
    const unsubscribe = onValue(
      resultRef,
      (snapshot) => {
        if (snapshot.exists()) {
          resultArrived = true;
          window.clearTimeout(pendingTimer);
          setMyResult(snapshot.val() as UserTriviaResult);
          setIsResultPending(false);
        }
      },
      (error) => {
        console.error('Failed to load trivia result:', error);
        resultArrived = true;
        window.clearTimeout(pendingTimer);
        setMyResult(null);
        setIsResultPending(false);
      }
    );

    return () => {
      window.clearTimeout(pendingTimer);
      unsubscribe();
    };
  }, [
    currentUserId,
    getPath,
    id,
    liveTrivia?.activityId,
    liveTrivia?.phase,
    triviaFixture,
  ]);

  const isTriviaActivity = currentActivity?.type === 'trivia';
  const triviaData = isTriviaActivity && 'trivia' in currentActivity
    ? currentActivity.trivia
    : null;
  const triviaImageSrc = getTriviaImageSrc(triviaData?.image);
  const activityContext = (() => {
    const title = currentActivity?.title?.trim();
    if (!title) return null;
    const normalizedTitle = title.toLowerCase();
    const normalizedQuestion = (triviaData?.question ?? '').trim().toLowerCase();
    return normalizedTitle === normalizedQuestion ? null : title;
  })();

  const kindRaw = triviaData?.kind ?? null;
  const kind = kindRaw === 'text'
    ? 'freeform'
    : kindRaw === 'multiple_choice'
      ? 'multi'
      : kindRaw;
  const options = Array.isArray(triviaData?.options) ? triviaData.options : [];
  const revealedCorrectAnswer =
    typeof liveTrivia?.revealedCorrectAnswer === 'string' && liveTrivia.revealedCorrectAnswer.trim().length > 0
      ? liveTrivia.revealedCorrectAnswer.trim()
      : null;

  const scaleConfig = triviaData?.scale;
  const scaleMin = typeof scaleConfig?.min === 'number' ? scaleConfig.min : 0;
  const scaleMax = typeof scaleConfig?.max === 'number' ? scaleConfig.max : 10;
  const scaleStep = typeof scaleConfig?.step === 'number' ? scaleConfig.step : 1;

  useEffect(() => {
    if (liveTrivia?.phase !== 'question') return;
    if (kind !== 'scale') return;
    setScaleValue((current) => (current === null ? scaleMin : current));
  }, [kind, liveTrivia?.phase, scaleMin]);

  useEffect(() => {
    if (!triviaImageSrc || triviaImageSrc.startsWith('data:')) return;
    const image = new Image();
    image.src = triviaImageSrc;
  }, [triviaImageSrc]);

  const getResponseUser = (): E2EUser | null => {
    if (triviaFixture) return triviaFixture.user;
    return currentUser
      ? {
          uid: currentUser.uid,
          displayName: currentUser.displayName,
        }
      : null;
  };

  const writeTriviaResponse = async (
    activityId: string,
    uid: string,
    payload: Record<string, unknown>
  ) => {
    if (!id) return;
    const path = getPath(id, `responses/${activityId}/${uid}`);
    if (triviaFixture) {
      await recordE2EResponse(path, payload);
      return;
    }
    await set(ref(db, path), payload);
  };

  // Timer countdown
  useEffect(() => {
    if (
      liveTrivia?.phase !== 'question' ||
      typeof liveTrivia.startedAt !== 'number' ||
      !liveTrivia.durationSeconds
    ) {
      setTimeRemaining(null);
      return;
    }

    const endTime = liveTrivia.startedAt + (liveTrivia.durationSeconds * 1000);
    const updateRemaining = () => {
      const correctedNow = Date.now() + serverTimeOffset;
      const remaining = Math.max(0, Math.floor((endTime - correctedNow) / 1000));
      setTimeRemaining(remaining);
      return remaining;
    };

    const interval = setInterval(() => {
      if (updateRemaining() === 0) {
        clearInterval(interval);
      }
    }, 100);

    updateRemaining();

    return () => clearInterval(interval);
  }, [
    liveTrivia?.durationSeconds,
    liveTrivia?.phase,
    liveTrivia?.startedAt,
    serverTimeOffset,
  ]);

  useEffect(() => {
    if (liveTrivia?.phase !== 'question' || !liveTrivia.activityId) return;

    const nudgeKey = `${liveTrivia.activityId}:${liveTrivia.startedAt ?? ''}`;
    if (lastQuestionNudgeRef.current === nudgeKey) return;
    lastQuestionNudgeRef.current = nudgeKey;

    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(200);
    }
  }, [liveTrivia?.activityId, liveTrivia?.phase, liveTrivia?.startedAt]);

  const startSubmission = (answer: PendingTriviaAnswer) => {
    clearSubmitSlowTimer();
    setSubmitting(true);
    setSubmitIsSlow(false);
    setSubmitError(null);
    setRetryAnswer(answer);
    submitSlowTimerRef.current = window.setTimeout(() => {
      setSubmitIsSlow(true);
    }, 2500);
  };

  const finishSubmission = () => {
    clearSubmitSlowTimer();
    setSubmitting(false);
    setSubmitIsSlow(false);
  };

  const failSubmission = (answer: PendingTriviaAnswer) => {
    clearSubmitSlowTimer();
    setSubmitting(false);
    setSubmitIsSlow(false);
    setRetryAnswer(answer);
    setSubmitError('Could not send your answer. Try again.');
  };

  const submitTriviaAnswer = async (answer: PendingTriviaAnswer) => {
    const user = getResponseUser();
    const activityId = liveTrivia?.activityId;
    if (!id || !activityId || !user || submitting || hasAnswered) return;

    if (answer.kind === 'multi') {
      setSelectedOption(answer.optionIndex);
    } else if (answer.kind === 'boolean') {
      setBooleanValue(answer.value);
    } else if (answer.kind === 'scale') {
      setScaleValue(answer.value);
    }

    startSubmission(answer);

    const answeredAt = Date.now();
    const startedAt = typeof liveTrivia.startedAt === 'number' ? liveTrivia.startedAt : answeredAt;
    const responseTime = Math.max(0, answeredAt - startedAt);
    const payload: Record<string, unknown> = {
      answeredAt,
      responseTime,
      displayName: user.displayName,
    };

    switch (answer.kind) {
      case 'multi':
        payload.optionIndex = answer.optionIndex;
        break;
      case 'freeform':
        payload.text = answer.text;
        break;
      case 'boolean':
        payload.booleanValue = answer.value;
        break;
      case 'scale':
        payload.scaleValue = answer.value;
        break;
    }

    try {
      await writeTriviaResponse(activityId, user.uid, payload);
      finishSubmission();
      setRetryAnswer(null);
    } catch (error) {
      console.error('Failed to submit answer:', error);
      failSubmission(answer);
    }
  };

  const submitMultiChoice = async (optionIndex: number) => {
    await submitTriviaAnswer({ kind: 'multi', optionIndex });
  };

  const submitFreeform = async () => {
    const trimmed = freeformText.trim();
    if (!trimmed) return;
    await submitTriviaAnswer({ kind: 'freeform', text: trimmed });
  };

  const submitBoolean = async (value: boolean) => {
    await submitTriviaAnswer({ kind: 'boolean', value });
  };

  const submitScale = async () => {
    const value = scaleValue ?? scaleMin;
    await submitTriviaAnswer({ kind: 'scale', value });
  };

  const retrySubmit = async () => {
    if (!retryAnswer) return;
    await submitTriviaAnswer(retryAnswer);
  };

  const isAnswerLocked = hasAnswered || submitting;

  if (!liveTrivia || liveTrivia.phase === 'idle') {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
        <div className="flex-1 p-4 pb-40">
          <Link
            to={`/shows/${id}${searchSuffix}`}
            className="inline-flex items-center space-x-2 text-gray-400 hover:text-gray-100 transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Show</span>
          </Link>

          {/* Test Mode Indicator */}
          {isTestShow && (
            <div className="mb-4 px-3 py-2 bg-purple-500/20 border border-purple-500/50 rounded-lg text-center">
              <span className="text-purple-300 text-sm font-medium">🧪 Test Mode Active</span>
            </div>
          )}

          <div className="max-w-lg mx-auto py-6 space-y-4">
            <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">Between questions</h2>
                  <p className="text-gray-400 text-sm">One look, phone down.</p>
                </div>
              </div>

              <div className="grid gap-3">
                <div className="rounded-lg bg-gray-950 border border-gray-800 p-3">
                  <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">You</div>
                  <div className="text-xl font-bold leading-tight">{playerStandingText}</div>
                </div>

                <div className="rounded-lg bg-gray-950 border border-gray-800 p-3">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500 mb-1">
                    <Users className="w-3.5 h-3.5" />
                    <span>Your Table</span>
                  </div>
                  <div className="text-xl font-bold leading-tight">{tableStandingText}</div>
                  {userTeam && (
                    <div className="text-gray-400 text-sm mt-1">{userTeam.team_name}</div>
                  )}
                </div>
              </div>
            </div>

            <ShareButton
              variant="bright"
              showName="Hollywood Groove"
              shareType="show_moment"
              className="w-full"
            />

            {isTestShow && (
              <p className="text-purple-400 text-sm text-center">
                Listening for test trivia at: test/shows/{id}/live/trivia
              </p>
            )}
          </div>
        </div>
        {/* Sticky ActionBar at bottom */}
        <div className="fixed bottom-0 left-0 right-0 z-50">
          <ActionBar />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 pb-40 max-w-lg mx-auto">
          {/* Test Mode Banner */}
          {isTestShow && (
            <div className="mb-3 px-2 py-1 bg-purple-500/20 border border-purple-500/50 rounded-lg text-center">
              <span className="text-purple-300 text-xs font-medium">🧪 Test Mode</span>
            </div>
          )}

          {/* Header */}
          <div className="space-y-2 mb-3">
            <div className="flex items-center justify-between gap-2">
              <Link
                to={`/shows/${id}${searchSuffix}`}
                className="inline-flex items-center space-x-1 text-gray-400 hover:text-gray-100 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm">Back</span>
              </Link>

              {myScore && (
                <div className="flex items-center space-x-2 bg-gray-900 px-3 py-1.5 rounded-lg border border-gray-800">
                  <Trophy className="w-4 h-4 text-primary" />
                  <span className="font-semibold text-sm">{myScore.totalScore} pts</span>
                  <span className="text-gray-400 text-xs">
                    ({myScore.correctCount} correct)
                  </span>
                </div>
              )}
            </div>

            {userTeam && (
              <div className="inline-flex max-w-full items-center gap-2 bg-gray-900 px-3 py-1.5 rounded-lg border border-gray-800 text-sm">
                <Users className="w-4 h-4 text-primary shrink-0" />
                <span className="text-gray-400 shrink-0">Your table:</span>
                <span className="font-semibold truncate">{tableStandingText}</span>
              </div>
            )}
          </div>

          {/* Question Phase */}
          {liveTrivia.phase === 'question' && triviaData && (
            <div className="space-y-3">
              {/* Timer */}
              {timeRemaining !== null && (
                <div className="bg-gradient-to-r from-primary/20 to-red-500/20 border border-primary/50 rounded-lg py-2 px-4">
                  <div className="flex items-center justify-center space-x-2">
                    <Clock className="w-4 h-4" />
                    <span className="text-xl font-bold tabular-nums">
                      {timeRemaining}s
                    </span>
                  </div>
                </div>
              )}

              {/* Question Card - Compact Layout */}
              <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
                {activityContext && (
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-3">
                    From: {activityContext}
                  </p>
                )}

                {/* Image + Question Row (side by side if image exists) */}
                {triviaImageSrc ? (
                  <div className="flex gap-3 mb-4">
                    <img
                      src={triviaImageSrc}
                      alt="Question image"
                      className="w-24 h-24 sm:w-32 sm:h-32 object-cover rounded-lg border border-gray-700 flex-shrink-0"
                    />
                    <h2 className="text-base sm:text-lg font-bold flex-1 leading-snug">
                      {triviaData.question}
                    </h2>
                  </div>
                ) : (
                  <h2 className="text-lg sm:text-xl font-bold mb-4">
                    {triviaData.question}
                  </h2>
                )}

                {/* Answer UI */}
                {kind === 'multi' && (
                  <div className="space-y-2">
                    {options.length === 0 && (
                      <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-sm text-red-300">
                        This question is missing options. Ask the show operator to republish it.
                      </div>
                    )}

                    {options.map((option) => (
                      <button
                        key={option.index}
                        onClick={() => submitMultiChoice(option.index)}
                        disabled={isAnswerLocked}
                        className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                          selectedOption === option.index
                            ? 'border-primary bg-primary/10'
                            : 'border-gray-700 hover:border-gray-600 bg-gray-800'
                        } ${isAnswerLocked ? 'cursor-not-allowed opacity-60' : 'hover:bg-gray-700'}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">{option.text}</span>
                          {selectedOption === option.index && (
                            <CheckCircle className="w-4 h-4 text-primary" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {kind === 'freeform' && (
                  <div className="space-y-2">
                    <textarea
                      value={freeformText}
                      onChange={(e) => setFreeformText(e.target.value)}
                      placeholder="Type your answer…"
                      disabled={isAnswerLocked}
                      rows={2}
                      className="w-full p-3 rounded-lg border-2 border-gray-700 bg-gray-800 text-gray-100 placeholder-gray-500 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors disabled:opacity-60 text-sm"
                    />
                    <button
                      onClick={submitFreeform}
                      disabled={isAnswerLocked || freeformText.trim().length === 0}
                      className="w-full px-4 py-2.5 rounded-lg bg-primary text-gray-900 font-semibold hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      {submitting ? 'Sending…' : 'Submit Answer'}
                    </button>
                  </div>
                )}

                {kind === 'boolean' && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => submitBoolean(true)}
                      disabled={isAnswerLocked}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        booleanValue === true
                          ? 'border-primary bg-primary/10'
                          : 'border-gray-700 hover:border-gray-600 bg-gray-800'
                      } ${isAnswerLocked ? 'cursor-not-allowed opacity-60' : 'hover:bg-gray-700'}`}
                    >
                      <span className="font-medium text-sm">{options[0]?.text ?? 'True'}</span>
                    </button>
                    <button
                      onClick={() => submitBoolean(false)}
                      disabled={isAnswerLocked}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        booleanValue === false
                          ? 'border-primary bg-primary/10'
                          : 'border-gray-700 hover:border-gray-600 bg-gray-800'
                      } ${isAnswerLocked ? 'cursor-not-allowed opacity-60' : 'hover:bg-gray-700'}`}
                    >
                      <span className="font-medium text-sm">{options[1]?.text ?? 'False'}</span>
                    </button>
                  </div>
                )}

                {kind === 'scale' && (
                  <div className="space-y-3">
                    <div className="bg-gray-950 border border-gray-800 rounded-lg p-3">
                      <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
                        <span>{scaleConfig?.leftLabel ?? scaleMin}</span>
                        <span>{scaleConfig?.rightLabel ?? scaleMax}</span>
                      </div>

                      <input
                        type="range"
                        min={scaleMin}
                        max={scaleMax}
                        step={scaleStep}
                        value={scaleValue ?? scaleMin}
                        onChange={(e) => setScaleValue(Number(e.target.value))}
                        disabled={isAnswerLocked}
                        className="w-full"
                      />

                      <div className="text-center mt-2">
                        <span className="text-xl font-bold tabular-nums">{scaleValue ?? scaleMin}</span>
                      </div>
                    </div>

                    <button
                      onClick={submitScale}
                      disabled={isAnswerLocked}
                      className="w-full px-4 py-2.5 rounded-lg bg-primary text-gray-900 font-semibold hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      {submitting ? 'Sending…' : 'Submit Rating'}
                    </button>
                  </div>
                )}

                {submitting && (
                  <div className="mt-4 rounded-lg border border-primary/50 bg-primary/10 p-3">
                    <div className="flex flex-wrap items-center justify-center gap-2 text-center text-sm font-medium text-primary">
                      <span>{submitIsSlow ? 'Still sending — hold on…' : 'Sending…'}</span>
                      {submitIsSlow && <RealtimeConnectionPill inline delayMs={0} />}
                    </div>
                  </div>
                )}

                {!submitting && submitError && (
                  <div className="mt-4 rounded-lg border border-red-500/50 bg-red-500/10 p-3">
                    <p className="mb-3 text-center text-sm font-medium text-red-300">{submitError}</p>
                    <button
                      type="button"
                      onClick={retrySubmit}
                      disabled={!retryAnswer}
                      className="w-full rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Retry
                    </button>
                  </div>
                )}

                {hasAnswered && !submitting && !submitError && (
                  <div className="mt-4 p-3 bg-green-500/10 border border-green-500/50 rounded-lg">
                    <p className="text-center text-green-400 font-medium text-sm">
                      Answer submitted! Wait for the reveal...
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Answer Phase */}
          {liveTrivia.phase === 'answer' && triviaData && (
            <div className="space-y-3">
              <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
                {activityContext && (
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-3">
                    From: {activityContext}
                  </p>
                )}

                {/* Image + Question Row (side by side if image exists) */}
                {triviaImageSrc ? (
                  <div className="flex gap-3 mb-4">
                    <img
                      src={triviaImageSrc}
                      alt="Question image"
                      className="w-24 h-24 sm:w-32 sm:h-32 object-cover rounded-lg border border-gray-700 flex-shrink-0"
                    />
                    <h2 className="text-base sm:text-lg font-bold flex-1 leading-snug">
                      {triviaData.question}
                    </h2>
                  </div>
                ) : (
                  <h2 className="text-lg sm:text-xl font-bold mb-4">
                    {triviaData.question}
                  </h2>
                )}

                <div className="mb-4 p-3 bg-green-500/10 border border-green-500/40 rounded-lg">
                  <p className="text-sm text-center">
                    <span className="text-green-300 font-medium">Correct answer:</span>
                    <span className="text-gray-100 font-semibold ml-2">{revealedCorrectAnswer ?? 'Answer unavailable'}</span>
                  </p>
                </div>

                {myResult ? (
                  <div
                    className={`mb-4 p-4 rounded-lg border text-center ${
                      myResult.isCorrect
                        ? 'bg-green-500/15 border-green-500/50'
                        : 'bg-red-500/15 border-red-500/50'
                    }`}
                  >
                    <div
                      className={`text-xl font-bold ${
                        myResult.isCorrect ? 'text-green-300' : 'text-red-300'
                      }`}
                    >
                      {myResult.isCorrect ? '✓ Correct' : '✗ Not this time'} — +{formatPoints(myResult.totalScore)} pts
                    </div>
                  </div>
                ) : isResultPending ? (
                  <div className="mb-4 p-4 bg-primary/10 border border-primary/40 rounded-lg text-center">
                    <div className="text-primary font-bold">Checking your result...</div>
                    <p className="text-gray-400 text-xs mt-1">Scores can land a moment after the reveal.</p>
                  </div>
                ) : (
                  <div className="mb-4 p-3 bg-gray-950 border border-gray-800 rounded-lg text-center">
                    <p className="text-gray-400 text-sm">
                      {hasAnswered ? 'Still calculating your score...' : 'No answer recorded for this round.'}
                    </p>
                  </div>
                )}

                {hasAnswered && (
                  <div className="mb-4 p-3 bg-gray-950 border border-gray-800 rounded-lg">
                    <p className="text-sm text-gray-400 text-center">
                      Your answer:
                      <span className="text-gray-100 font-semibold ml-2">
                        {kind === 'multi'
                          ? (options.find((o) => o.index === selectedOption)?.text ?? '—')
                          : kind === 'freeform'
                            ? freeformText.trim()
                            : kind === 'boolean'
                              ? (booleanValue === null ? '—' : booleanValue ? (options[0]?.text ?? 'True') : (options[1]?.text ?? 'False'))
                              : kind === 'scale'
                                ? String(scaleValue ?? scaleMin)
                                : '—'}
                      </span>
                    </p>
                  </div>
                )}

                {kind === 'multi' && options.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {options.map((option) => (
                      <div
                        key={option.index}
                        className={`p-3 rounded-lg border-2 ${
                          selectedOption === option.index
                            ? 'border-primary bg-primary/10'
                            : 'border-gray-700 bg-gray-800'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">{option.text}</span>
                          {selectedOption === option.index && (
                            <CheckCircle className="w-4 h-4 text-primary" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Winner announcement */}
                {liveTrivia.revealedWinnerUid && (
                  isCurrentUserWinner ? (
                    <div className="p-5 bg-gradient-to-r from-primary/30 to-yellow-500/30 border-2 border-primary rounded-lg text-center shadow-glow">
                      <div className="text-4xl mb-2">🏆</div>
                      <h3 className="text-2xl font-black mb-1">
                        YOU WON THIS ROUND!
                      </h3>
                      <p className="text-gray-100 text-sm font-semibold">
                        Get ready. The band is calling you out.
                      </p>
                    </div>
                  ) : winnerDisplayName ? (
                    <div className="p-4 bg-gradient-to-r from-primary/20 to-yellow-500/20 border border-primary rounded-lg text-center">
                      <Trophy className="w-10 h-10 text-primary mx-auto mb-2" />
                      <h3 className="text-lg font-bold mb-1">
                        Winner: {winnerDisplayName}
                      </h3>
                      <p className="text-gray-300 text-sm">
                        Fastest correct answer wins the round
                      </p>
                    </div>
                  ) : (
                    <div className="p-4 bg-gradient-to-r from-primary/20 to-yellow-500/20 border border-primary rounded-lg text-center">
                      <Trophy className="w-10 h-10 text-primary mx-auto mb-2" />
                      <h3 className="text-lg font-bold mb-1">
                        Winner Revealed!
                      </h3>
                      <p className="text-gray-300 text-sm">
                        Fastest correct answer wins the round
                      </p>
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sticky ActionBar at bottom */}
      <div className="fixed bottom-0 left-0 right-0 z-50">
        <ActionBar />
      </div>
    </div>
  );
}
