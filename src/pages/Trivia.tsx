import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { onValue, ref, set } from 'firebase/database';
import { ArrowLeft, Clock, Trophy, CheckCircle } from 'lucide-react';
import { db, auth, rtdbPath } from '../lib/firebase';
import { LiveTriviaState, CrowdActivity, UserScore } from '../types/firebaseContract';

export default function Trivia() {
  const { id } = useParams<{ id: string }>();
  const [liveTrivia, setLiveTrivia] = useState<LiveTriviaState | null>(null);
  const [currentActivity, setCurrentActivity] = useState<CrowdActivity | null>(null);
  const [myScore, setMyScore] = useState<UserScore | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [freeformText, setFreeformText] = useState('');
  const [booleanValue, setBooleanValue] = useState<boolean | null>(null);
  const [scaleValue, setScaleValue] = useState<number | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!id) return;

    const showId = Number(id);

    // Listen to live trivia state
    const unsubscribeLive = onValue(
      ref(db, rtdbPath(`shows/${showId}/live/trivia`)),
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
          const activityRef = ref(db, rtdbPath(`shows/${showId}/activities/${state.activityId}`));
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
        ref(db, rtdbPath(`shows/${showId}/scores/${uid}`)),
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
  }, [id]);

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

    const showId = Number(id);
    const uid = auth.currentUser.uid;
    const answeredAt = Date.now();
    const startedAt = typeof liveTrivia.startedAt === 'number' ? liveTrivia.startedAt : answeredAt;
    const responseTime = Math.max(0, answeredAt - startedAt);

    try {
      await set(
        ref(db, rtdbPath(`shows/${showId}/responses/${liveTrivia.activityId}/${uid}`)),
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

    const showId = Number(id);
    const uid = auth.currentUser.uid;
    const answeredAt = Date.now();
    const startedAt = typeof liveTrivia.startedAt === 'number' ? liveTrivia.startedAt : answeredAt;
    const responseTime = Math.max(0, answeredAt - startedAt);

    try {
      await set(ref(db, rtdbPath(`shows/${showId}/responses/${liveTrivia.activityId}/${uid}`)), {
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

    const showId = Number(id);
    const uid = auth.currentUser.uid;
    const answeredAt = Date.now();
    const startedAt = typeof liveTrivia.startedAt === 'number' ? liveTrivia.startedAt : answeredAt;
    const responseTime = Math.max(0, answeredAt - startedAt);

    try {
      await set(ref(db, rtdbPath(`shows/${showId}/responses/${liveTrivia.activityId}/${uid}`)), {
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

    const showId = Number(id);
    const uid = auth.currentUser.uid;
    const answeredAt = Date.now();
    const startedAt = typeof liveTrivia.startedAt === 'number' ? liveTrivia.startedAt : answeredAt;
    const responseTime = Math.max(0, answeredAt - startedAt);

    try {
      await set(ref(db, rtdbPath(`shows/${showId}/responses/${liveTrivia.activityId}/${uid}`)), {
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
      <div className="min-h-screen bg-gray-950 text-gray-100 p-8">
        <Link
          to={`/shows/${id}`}
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
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-4 sm:p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Link
            to={`/shows/${id}`}
            className="inline-flex items-center space-x-2 text-gray-400 hover:text-gray-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </Link>

          {myScore && (
            <div className="flex items-center space-x-2 bg-gray-900 px-4 py-2 rounded-lg border border-gray-800">
              <Trophy className="w-5 h-5 text-primary" />
              <span className="font-semibold">{myScore.totalScore} pts</span>
              <span className="text-gray-400 text-sm">
                ({myScore.correctCount} correct)
              </span>
            </div>
          )}
        </div>

        {/* Question Phase */}
        {liveTrivia.phase === 'question' && triviaData && (
          <div className="space-y-6">
            {/* Timer */}
            {timeRemaining !== null && (
              <div className="bg-gradient-to-r from-primary/20 to-red-500/20 border border-primary/50 rounded-lg p-4">
                <div className="flex items-center justify-center space-x-2">
                  <Clock className="w-5 h-5" />
                  <span className="text-2xl font-bold tabular-nums">
                    {timeRemaining}s
                  </span>
                </div>
              </div>
            )}

            {/* Question */}
            <div className="bg-gray-900 rounded-lg p-6 sm:p-8 border border-gray-800">
              {/* Question Image (if present) */}
              {triviaData.image && (
                <div className="mb-6">
                  <img
                    src={`data:${triviaData.image.mimeType};base64,${triviaData.image.base64}`}
                    alt="Question image"
                    className="w-full rounded-lg border border-gray-700"
                  />
                </div>
              )}

              <h2 className="text-xl sm:text-2xl font-bold mb-6">
                {triviaData.question}
              </h2>

              {/* Answer UI */}
              {kind === 'multi' && (
                <div className="space-y-3">
                  {options.length === 0 && (
                    <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-lg text-sm text-red-300">
                      This question is missing options. Ask the show operator to republish it.
                    </div>
                  )}

                  {options.map((option) => (
                    <button
                      key={option.index}
                      onClick={() => submitMultiChoice(option.index)}
                      disabled={hasAnswered}
                      className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                        selectedOption === option.index
                          ? 'border-primary bg-primary/10'
                          : 'border-gray-700 hover:border-gray-600 bg-gray-800'
                      } ${hasAnswered ? 'cursor-not-allowed opacity-60' : 'hover:bg-gray-700'}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{option.text}</span>
                        {selectedOption === option.index && (
                          <CheckCircle className="w-5 h-5 text-primary" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {kind === 'freeform' && (
                <div className="space-y-3">
                  <textarea
                    value={freeformText}
                    onChange={(e) => setFreeformText(e.target.value)}
                    placeholder="Type your answer…"
                    disabled={hasAnswered}
                    rows={3}
                    className="w-full p-4 rounded-lg border-2 border-gray-700 bg-gray-800 text-gray-100 placeholder-gray-500 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors disabled:opacity-60"
                  />
                  <button
                    onClick={submitFreeform}
                    disabled={hasAnswered || freeformText.trim().length === 0}
                    className="w-full px-4 py-3 rounded-lg bg-primary text-gray-900 font-semibold hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Submit Answer
                  </button>
                </div>
              )}

              {kind === 'boolean' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => submitBoolean(true)}
                      disabled={hasAnswered}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        booleanValue === true
                          ? 'border-primary bg-primary/10'
                          : 'border-gray-700 hover:border-gray-600 bg-gray-800'
                      } ${hasAnswered ? 'cursor-not-allowed opacity-60' : 'hover:bg-gray-700'}`}
                    >
                      <span className="font-medium">{options[0]?.text ?? 'True'}</span>
                    </button>
                    <button
                      onClick={() => submitBoolean(false)}
                      disabled={hasAnswered}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        booleanValue === false
                          ? 'border-primary bg-primary/10'
                          : 'border-gray-700 hover:border-gray-600 bg-gray-800'
                      } ${hasAnswered ? 'cursor-not-allowed opacity-60' : 'hover:bg-gray-700'}`}
                    >
                      <span className="font-medium">{options[1]?.text ?? 'False'}</span>
                    </button>
                  </div>
                </div>
              )}

              {kind === 'scale' && (
                <div className="space-y-4">
                  <div className="bg-gray-950 border border-gray-800 rounded-lg p-4">
                    <div className="flex items-center justify-between text-sm text-gray-400 mb-3">
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

                    <div className="text-center mt-3">
                      <span className="text-2xl font-bold tabular-nums">{scaleValue ?? scaleMin}</span>
                    </div>
                  </div>

                  <button
                    onClick={submitScale}
                    disabled={hasAnswered}
                    className="w-full px-4 py-3 rounded-lg bg-primary text-gray-900 font-semibold hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Submit Rating
                  </button>
                </div>
              )}

              {hasAnswered && (
                <div className="mt-6 p-4 bg-green-500/10 border border-green-500/50 rounded-lg">
                  <p className="text-center text-green-400 font-medium">
                    Answer submitted! Wait for the reveal...
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Answer Phase */}
        {liveTrivia.phase === 'answer' && triviaData && (
          <div className="space-y-6">
            <div className="bg-gray-900 rounded-lg p-6 sm:p-8 border border-gray-800">
              {/* Question Image (if present) */}
              {triviaData.image && (
                <div className="mb-6">
                  <img
                    src={`data:${triviaData.image.mimeType};base64,${triviaData.image.base64}`}
                    alt="Question image"
                    className="w-full rounded-lg border border-gray-700"
                  />
                </div>
              )}

              <h2 className="text-xl sm:text-2xl font-bold mb-6">
                {triviaData.question}
              </h2>

              {hasAnswered && (
                <div className="mb-6 p-4 bg-gray-950 border border-gray-800 rounded-lg">
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
                <div className="space-y-3 mb-6">
                  {options.map((option) => (
                    <div
                      key={option.index}
                      className={`p-4 rounded-lg border-2 ${
                        selectedOption === option.index
                          ? 'border-primary bg-primary/10'
                          : 'border-gray-700 bg-gray-800'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{option.text}</span>
                        {selectedOption === option.index && (
                          <CheckCircle className="w-5 h-5 text-primary" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Winner announcement */}
              {liveTrivia.revealedWinnerUid && (
                <div className="p-6 bg-gradient-to-r from-primary/20 to-yellow-500/20 border border-primary rounded-lg text-center">
                  <Trophy className="w-12 h-12 text-primary mx-auto mb-3" />
                  <h3 className="text-xl font-bold mb-2">
                    Winner Revealed!
                  </h3>
                  <p className="text-gray-300">
                    Fastest correct answer wins the round
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
