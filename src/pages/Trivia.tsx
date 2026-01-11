import { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { onValue, ref, set } from 'firebase/database';
import { ArrowLeft, Clock, Trophy, CheckCircle } from 'lucide-react';
import { db, auth } from '../lib/firebase';
import { LiveTriviaState, CrowdActivity, UserScore } from '../types/firebaseContract';
import ActionBar from '../components/show/ActionBar';
import { getShowPath, getTestShowPath } from '../lib/mode';

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
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  // Check if this is a test show via query param
  const isTestShow = searchParams.get('test') === 'true';

  // Helper to get the correct path based on whether it's a test show
  const getPath = useMemo(() => {
    return (showId: string, suffix?: string) => {
      return isTestShow ? getTestShowPath(showId, suffix) : getShowPath(showId, suffix);
    };
  }, [isTestShow]);

  useEffect(() => {
    if (!id) return;

    // Listen to live trivia state
    const unsubscribeLive = onValue(
      ref(db, getPath(id, 'live/trivia')),
      (snapshot) => {
        const state = snapshot.val() as LiveTriviaState | null;
        setLiveTrivia(state);

        // Reset answered state when new question appears
        if (state?.phase === 'question') {
          setHasAnswered(false);
          setSelectedOption(null);
          setFreeformText('');
          setBooleanValue(null);
          setScaleValue(null);
        }

        // Load the current activity
        if (state?.activityId) {
          const activityRef = ref(db, getPath(id, `activities/${state.activityId}`));
          onValue(activityRef, (activitySnapshot) => {
            setCurrentActivity(activitySnapshot.val() as CrowdActivity | null);
          });
        }
      }
    );

    // Listen to user's score
    const uid = auth.currentUser?.uid;
    if (uid) {
      const unsubscribeScore = onValue(
        ref(db, getPath(id, `scores/${uid}`)),
        (snapshot) => {
          setMyScore(snapshot.val() as UserScore | null);
        }
      );

      return () => {
        unsubscribeLive();
        unsubscribeScore();
      };
    }

    return () => unsubscribeLive();
  }, [id, getPath]);

  const isTriviaActivity = currentActivity?.type === 'trivia';
  const triviaData = isTriviaActivity && 'trivia' in currentActivity
    ? currentActivity.trivia
    : null;

  const kindRaw = triviaData?.kind ?? null;
  const kind = kindRaw === 'text' ? 'freeform' : kindRaw;
  const options = Array.isArray(triviaData?.options) ? triviaData.options : [];

  const scaleConfig = triviaData?.scale;
  const scaleMin = typeof scaleConfig?.min === 'number' ? scaleConfig.min : 0;
  const scaleMax = typeof scaleConfig?.max === 'number' ? scaleConfig.max : 10;
  const scaleStep = typeof scaleConfig?.step === 'number' ? scaleConfig.step : 1;

  useEffect(() => {
    if (liveTrivia?.phase !== 'question') return;
    if (kind !== 'scale') return;
    setScaleValue((current) => (current === null ? scaleMin : current));
  }, [kind, liveTrivia?.phase, scaleMin]);

  // Timer countdown
  useEffect(() => {
    if (liveTrivia?.phase !== 'question' || !liveTrivia.durationSeconds) {
      setTimeRemaining(null);
      return;
    }

    const endTime = liveTrivia.startedAt + (liveTrivia.durationSeconds * 1000);

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
      setTimeRemaining(remaining);

      if (remaining === 0) {
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [liveTrivia]);

  const submitMultiChoice = async (optionIndex: number) => {
    if (!id || !liveTrivia?.activityId || !auth.currentUser) return;

    const uid = auth.currentUser.uid;
    const answeredAt = Date.now();
    const startedAt = typeof liveTrivia.startedAt === 'number' ? liveTrivia.startedAt : answeredAt;
    const responseTime = Math.max(0, answeredAt - startedAt);

    try {
      await set(
        ref(db, getPath(id, `responses/${liveTrivia.activityId}/${uid}`)),
        {
          optionIndex,
          answeredAt,
          responseTime,
          displayName: auth.currentUser.displayName || 'Anonymous',
        }
      );

      setSelectedOption(optionIndex);
      setHasAnswered(true);
    } catch (error) {
      console.error('Failed to submit answer:', error);
    }
  };

  const submitFreeform = async () => {
    if (!id || !liveTrivia?.activityId || !auth.currentUser) return;
    const trimmed = freeformText.trim();
    if (!trimmed) return;

    const uid = auth.currentUser.uid;
    const answeredAt = Date.now();
    const startedAt = typeof liveTrivia.startedAt === 'number' ? liveTrivia.startedAt : answeredAt;
    const responseTime = Math.max(0, answeredAt - startedAt);

    try {
      await set(ref(db, getPath(id, `responses/${liveTrivia.activityId}/${uid}`)), {
        text: trimmed,
        answeredAt,
        responseTime,
        displayName: auth.currentUser.displayName || 'Anonymous',
      });

      setHasAnswered(true);
    } catch (error) {
      console.error('Failed to submit answer:', error);
    }
  };

  const submitBoolean = async (value: boolean) => {
    if (!id || !liveTrivia?.activityId || !auth.currentUser) return;

    const uid = auth.currentUser.uid;
    const answeredAt = Date.now();
    const startedAt = typeof liveTrivia.startedAt === 'number' ? liveTrivia.startedAt : answeredAt;
    const responseTime = Math.max(0, answeredAt - startedAt);

    try {
      await set(ref(db, getPath(id, `responses/${liveTrivia.activityId}/${uid}`)), {
        booleanValue: value,
        answeredAt,
        responseTime,
        displayName: auth.currentUser.displayName || 'Anonymous',
      });

      setBooleanValue(value);
      setHasAnswered(true);
    } catch (error) {
      console.error('Failed to submit answer:', error);
    }
  };

  const submitScale = async () => {
    if (!id || !liveTrivia?.activityId || !auth.currentUser) return;
    const value = scaleValue ?? scaleMin;

    const uid = auth.currentUser.uid;
    const answeredAt = Date.now();
    const startedAt = typeof liveTrivia.startedAt === 'number' ? liveTrivia.startedAt : answeredAt;
    const responseTime = Math.max(0, answeredAt - startedAt);

    try {
      await set(ref(db, getPath(id, `responses/${liveTrivia.activityId}/${uid}`)), {
        scaleValue: value,
        answeredAt,
        responseTime,
        displayName: auth.currentUser.displayName || 'Anonymous',
      });

      setHasAnswered(true);
    } catch (error) {
      console.error('Failed to submit answer:', error);
    }
  };

  if (!liveTrivia || liveTrivia.phase === 'idle') {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
        <div className="flex-1 p-4 pb-40">
          <Link
            to={`/shows/${id}${isTestShow ? '?test=true' : ''}`}
            className="inline-flex items-center space-x-2 text-gray-400 hover:text-gray-100 transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Show</span>
          </Link>

          <div className="max-w-2xl mx-auto text-center py-12">
            <Trophy className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">No Active Trivia</h2>
            <p className="text-gray-400">
              Wait for the next question to appear during the show!
            </p>
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
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <Link
              to={`/shows/${id}${isTestShow ? '?test=true' : ''}`}
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
                {/* Image + Question Row (side by side if image exists) */}
                {triviaData.image ? (
                  <div className="flex gap-3 mb-4">
                    <img
                      src={`data:${triviaData.image.mimeType};base64,${triviaData.image.base64}`}
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
                        disabled={hasAnswered}
                        className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                          selectedOption === option.index
                            ? 'border-primary bg-primary/10'
                            : 'border-gray-700 hover:border-gray-600 bg-gray-800'
                        } ${hasAnswered ? 'cursor-not-allowed opacity-60' : 'hover:bg-gray-700'}`}
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
                      disabled={hasAnswered}
                      rows={2}
                      className="w-full p-3 rounded-lg border-2 border-gray-700 bg-gray-800 text-gray-100 placeholder-gray-500 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors disabled:opacity-60 text-sm"
                    />
                    <button
                      onClick={submitFreeform}
                      disabled={hasAnswered || freeformText.trim().length === 0}
                      className="w-full px-4 py-2.5 rounded-lg bg-primary text-gray-900 font-semibold hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      Submit Answer
                    </button>
                  </div>
                )}

                {kind === 'boolean' && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => submitBoolean(true)}
                      disabled={hasAnswered}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        booleanValue === true
                          ? 'border-primary bg-primary/10'
                          : 'border-gray-700 hover:border-gray-600 bg-gray-800'
                      } ${hasAnswered ? 'cursor-not-allowed opacity-60' : 'hover:bg-gray-700'}`}
                    >
                      <span className="font-medium text-sm">{options[0]?.text ?? 'True'}</span>
                    </button>
                    <button
                      onClick={() => submitBoolean(false)}
                      disabled={hasAnswered}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        booleanValue === false
                          ? 'border-primary bg-primary/10'
                          : 'border-gray-700 hover:border-gray-600 bg-gray-800'
                      } ${hasAnswered ? 'cursor-not-allowed opacity-60' : 'hover:bg-gray-700'}`}
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
                        disabled={hasAnswered}
                        className="w-full"
                      />

                      <div className="text-center mt-2">
                        <span className="text-xl font-bold tabular-nums">{scaleValue ?? scaleMin}</span>
                      </div>
                    </div>

                    <button
                      onClick={submitScale}
                      disabled={hasAnswered}
                      className="w-full px-4 py-2.5 rounded-lg bg-primary text-gray-900 font-semibold hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      Submit Rating
                    </button>
                  </div>
                )}

                {hasAnswered && (
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
                {/* Image + Question Row (side by side if image exists) */}
                {triviaData.image ? (
                  <div className="flex gap-3 mb-4">
                    <img
                      src={`data:${triviaData.image.mimeType};base64,${triviaData.image.base64}`}
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
                  <div className="p-4 bg-gradient-to-r from-primary/20 to-yellow-500/20 border border-primary rounded-lg text-center">
                    <Trophy className="w-10 h-10 text-primary mx-auto mb-2" />
                    <h3 className="text-lg font-bold mb-1">
                      Winner Revealed!
                    </h3>
                    <p className="text-gray-300 text-sm">
                      Fastest correct answer wins the round
                    </p>
                  </div>
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
