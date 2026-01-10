/**
 * Play.tsx - Quick Trivia Page
 *
 * Self-paced trivia mode for between-show engagement.
 * Users can answer questions at their own pace and earn stars.
 */

import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle, XCircle, Star, Loader2, Brain, Trophy } from 'lucide-react';
import { auth } from '../lib/firebase';
import { useTriviaPlay, getSettings } from '../lib/triviaLibraryService';
import {
  getUserUsage,
  canPlayMore,
  recordAnswer,
  resetDailyIfNeeded,
  updateMemberStars,
  type UsageData,
  type CanPlayResult,
} from '../lib/engagementService';
import type { TriviaLibrarySettings } from '../types/firebaseContract';

type GameState = 'loading' | 'ready' | 'answered' | 'limit_reached' | 'no_questions' | 'star_earned';

export default function Play() {
  const {
    schedule,
    currentQuestion,
    loading: questionLoading,
    error: questionError,
    fetchNextQuestion,
  } = useTriviaPlay();

  const [gameState, setGameState] = useState<GameState>('loading');
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [canPlayResult, setCanPlayResult] = useState<CanPlayResult | null>(null);
  const [settings, setSettings] = useState<TriviaLibrarySettings | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Initialize - check usage and limits
  useEffect(() => {
    let isMounted = true;

    async function init() {
      const uid = auth.currentUser?.uid;
      if (!uid) {
        // Wait for auth
        return;
      }

      try {
        // Reset daily counters if needed
        await resetDailyIfNeeded(uid);

        // Get settings and usage
        const [settingsData, usageData, playResult] = await Promise.all([
          getSettings(),
          getUserUsage(uid),
          canPlayMore(uid),
        ]);

        if (!isMounted) return;

        setSettings(settingsData);
        setUsage(usageData);
        setCanPlayResult(playResult);

        if (!playResult.canPlay) {
          setGameState('limit_reached');
        } else if (questionError || !currentQuestion) {
          setGameState('no_questions');
        } else {
          setGameState('ready');
        }
      } catch (error) {
        console.error('Error initializing play:', error);
        if (isMounted) setGameState('no_questions');
      }
    }

    // Wait for auth to be ready
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        init();
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [currentQuestion, questionError]);

  // Update game state when question loading changes
  useEffect(() => {
    if (!questionLoading && currentQuestion && gameState === 'loading') {
      setGameState('ready');
    }
  }, [questionLoading, currentQuestion, gameState]);

  // Handle answer selection
  const handleSelectAnswer = useCallback(async (optionIndex: number) => {
    if (gameState !== 'ready' || !currentQuestion || submitting) return;

    const uid = auth.currentUser?.uid;
    if (!uid) return;

    setSubmitting(true);
    setSelectedOption(optionIndex);

    const correct = optionIndex === currentQuestion.question.correct_index;
    setIsCorrect(correct);

    try {
      // Record the answer
      const result = await recordAnswer(
        uid,
        currentQuestion.id,
        correct,
        currentQuestion.question.star_value
      );

      // Update local usage
      setUsage((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          questionsToday: prev.questionsToday + 1,
          totalQuestionsAnswered: prev.totalQuestionsAnswered + 1,
          totalCorrect: correct ? prev.totalCorrect + 1 : prev.totalCorrect,
          starProgressToday: result.progress,
          starsEarnedToday: result.starsEarnedToday,
          starsThisWeek: result.starsThisWeek,
        };
      });

      // Check if star was earned
      if (result.newStarEarned) {
        // Update member profile with new star
        await updateMemberStars(uid, 1);
        setGameState('star_earned');
      } else {
        setGameState('answered');
      }

      // Update can play result
      const newCanPlay = await canPlayMore(uid);
      setCanPlayResult(newCanPlay);
    } catch (error) {
      console.error('Error recording answer:', error);
      setGameState('answered');
    } finally {
      setSubmitting(false);
    }
  }, [gameState, currentQuestion, submitting]);

  // Handle next question
  const handleNextQuestion = useCallback(async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    // Check if we can continue
    const playResult = await canPlayMore(uid);
    setCanPlayResult(playResult);

    if (!playResult.canPlay) {
      setGameState('limit_reached');
      return;
    }

    // Reset state for next question
    setSelectedOption(null);
    setIsCorrect(null);
    setGameState('loading');

    // Fetch next question
    await fetchNextQuestion();
    setGameState('ready');
  }, [fetchNextQuestion]);

  // Star progress component
  const StarProgress = () => {
    if (!usage || !settings) return null;

    const progress = usage.starProgressToday;
    const threshold = settings.star_threshold;
    const percentage = Math.min((progress / threshold) * 100, 100);

    return (
      <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-400" />
            <span className="text-sm text-gray-400">Star Progress</span>
          </div>
          <span className="text-sm font-bold text-primary">
            {progress.toFixed(1)} / {threshold.toFixed(1)}
          </span>
        </div>
        <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-yellow-500 to-yellow-400 transition-all duration-500 ease-out"
            style={{ width: `${percentage}%` }}
          />
        </div>
        {usage.starsEarnedToday > 0 && (
          <div className="text-xs text-yellow-400 mt-2 text-center">
            {usage.starsEarnedToday} star{usage.starsEarnedToday !== 1 ? 's' : ''} earned today!
          </div>
        )}
      </div>
    );
  };

  // Remaining questions indicator
  const RemainingIndicator = () => {
    if (!canPlayResult) return null;

    return (
      <div className="text-center text-sm text-gray-400">
        {canPlayResult.remaining > 0 ? (
          <>
            <span className="font-medium text-gray-300">{canPlayResult.remaining}</span>{' '}
            question{canPlayResult.remaining !== 1 ? 's' : ''} left today
          </>
        ) : (
          <span className="text-yellow-400">Daily limit reached</span>
        )}
        {canPlayResult.reason && (
          <div className="text-xs text-gray-500 mt-1">{canPlayResult.reason}</div>
        )}
      </div>
    );
  };

  // Loading state
  if (gameState === 'loading' || questionLoading) {
    return (
      <div className="mx-auto max-w-lg space-y-6">
        <header className="flex items-center gap-3">
          <Link
            to="/"
            className="p-2 rounded-lg hover:bg-gray-800 transition"
          >
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </Link>
          <h1 className="text-xl font-bold">Quick Trivia</h1>
        </header>

        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
          <p className="text-gray-400">Loading trivia...</p>
        </div>
      </div>
    );
  }

  // Limit reached state
  if (gameState === 'limit_reached') {
    return (
      <div className="mx-auto max-w-lg space-y-6">
        <header className="flex items-center gap-3">
          <Link
            to="/"
            className="p-2 rounded-lg hover:bg-gray-800 transition"
          >
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </Link>
          <h1 className="text-xl font-bold">Quick Trivia</h1>
        </header>

        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 text-center">
          <Trophy className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Great Work Today!</h2>
          <p className="text-gray-400 mb-4">
            You've reached your daily trivia limit.
            <br />
            Come back tomorrow for more questions!
          </p>
          {usage && (
            <div className="bg-gray-800 rounded-lg p-4 mb-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-gray-400">Questions Today</div>
                  <div className="text-xl font-bold">{usage.questionsToday}</div>
                </div>
                <div>
                  <div className="text-gray-400">Correct Today</div>
                  <div className="text-xl font-bold text-green-400">
                    {/* We'd need to track this separately, using total for now */}
                    {usage.totalCorrect}
                  </div>
                </div>
              </div>
            </div>
          )}
          <StarProgress />
        </div>

        <Link
          to="/"
          className="block w-full text-center py-3 rounded-xl bg-primary text-gray-900 font-bold hover:bg-primary-600 transition"
        >
          Back to Home
        </Link>
      </div>
    );
  }

  // No questions available
  if (gameState === 'no_questions' || !currentQuestion) {
    return (
      <div className="mx-auto max-w-lg space-y-6">
        <header className="flex items-center gap-3">
          <Link
            to="/"
            className="p-2 rounded-lg hover:bg-gray-800 transition"
          >
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </Link>
          <h1 className="text-xl font-bold">Quick Trivia</h1>
        </header>

        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 text-center">
          <Brain className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">No Questions Available</h2>
          <p className="text-gray-400">
            Check back later for more trivia questions!
          </p>
        </div>

        <Link
          to="/"
          className="block w-full text-center py-3 rounded-xl bg-gray-800 text-gray-300 font-bold hover:bg-gray-700 transition"
        >
          Back to Home
        </Link>
      </div>
    );
  }

  // Star earned celebration
  if (gameState === 'star_earned') {
    return (
      <div className="mx-auto max-w-lg space-y-6">
        <header className="flex items-center gap-3">
          <Link
            to="/"
            className="p-2 rounded-lg hover:bg-gray-800 transition"
          >
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </Link>
          <h1 className="text-xl font-bold">Quick Trivia</h1>
        </header>

        <div className="bg-gradient-to-b from-yellow-500/20 to-transparent rounded-xl p-6 border border-yellow-500/50 text-center">
          <div className="text-6xl mb-4 animate-bounce">⭐</div>
          <h2 className="text-2xl font-bold mb-2 text-yellow-400">
            Star Earned!
          </h2>
          <p className="text-gray-300 mb-4">
            Congratulations! You've earned a star from today's trivia.
          </p>
          {usage && (
            <div className="text-sm text-gray-400">
              Total stars this week: {usage.starsThisWeek}
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <Link
            to="/"
            className="flex-1 text-center py-3 rounded-xl bg-gray-800 text-gray-300 font-bold hover:bg-gray-700 transition"
          >
            Done
          </Link>
          {canPlayResult?.canPlay && canPlayResult.remaining > 0 && (
            <button
              onClick={handleNextQuestion}
              className="flex-1 py-3 rounded-xl bg-primary text-gray-900 font-bold hover:bg-primary-600 transition"
            >
              Keep Playing
            </button>
          )}
        </div>
      </div>
    );
  }

  const question = currentQuestion.question;

  return (
    <div className="mx-auto max-w-lg space-y-4">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="p-2 rounded-lg hover:bg-gray-800 transition"
          >
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </Link>
          <h1 className="text-xl font-bold">Quick Trivia</h1>
        </div>
      </header>

      {/* Theme banner */}
      {schedule && (
        <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 rounded-lg px-4 py-2 border border-purple-500/30">
          <div className="text-sm font-medium text-purple-300">
            Today's Theme: {schedule.theme_name}
          </div>
          {schedule.description && (
            <div className="text-xs text-purple-400/80">{schedule.description}</div>
          )}
        </div>
      )}

      {/* Question Card */}
      <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
        {/* Difficulty badge */}
        <div className="flex items-center justify-between mb-3">
          <span
            className={`text-xs font-medium px-2 py-1 rounded-full ${
              question.difficulty === 'easy'
                ? 'bg-green-500/20 text-green-400'
                : question.difficulty === 'medium'
                ? 'bg-yellow-500/20 text-yellow-400'
                : 'bg-red-500/20 text-red-400'
            }`}
          >
            {question.difficulty.charAt(0).toUpperCase() + question.difficulty.slice(1)}
          </span>
          <span className="text-xs text-gray-500">
            {question.star_value} point{question.star_value !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Question */}
        <h2 className="text-lg font-bold mb-4 leading-snug">{question.question}</h2>

        {/* Options */}
        <div className="space-y-2">
          {question.options.map((option) => {
            const isSelected = selectedOption === option.index;
            const isCorrectOption = option.index === question.correct_index;
            const showResult = gameState === 'answered';

            let optionClass =
              'w-full text-left p-4 rounded-lg border-2 transition-all duration-200 ';

            if (showResult) {
              if (isCorrectOption) {
                optionClass += 'border-green-500 bg-green-500/10';
              } else if (isSelected && !isCorrectOption) {
                optionClass += 'border-red-500 bg-red-500/10';
              } else {
                optionClass += 'border-gray-700 bg-gray-800 opacity-50';
              }
            } else if (isSelected) {
              optionClass += 'border-primary bg-primary/10';
            } else {
              optionClass += 'border-gray-700 bg-gray-800 hover:border-gray-600 hover:bg-gray-700';
            }

            return (
              <button
                key={option.index}
                onClick={() => handleSelectAnswer(option.index)}
                disabled={gameState !== 'ready' || submitting}
                className={optionClass}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{option.text}</span>
                  {showResult && isCorrectOption && (
                    <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                  )}
                  {showResult && isSelected && !isCorrectOption && (
                    <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Feedback */}
        {gameState === 'answered' && (
          <div
            className={`mt-4 p-4 rounded-lg ${
              isCorrect
                ? 'bg-green-500/10 border border-green-500/50'
                : 'bg-red-500/10 border border-red-500/50'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              {isCorrect ? (
                <>
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  <span className="font-bold text-green-400">Correct!</span>
                </>
              ) : (
                <>
                  <XCircle className="w-5 h-5 text-red-400" />
                  <span className="font-bold text-red-400">Incorrect</span>
                </>
              )}
            </div>
            {question.explanation && (
              <p className="text-sm text-gray-300">{question.explanation}</p>
            )}
          </div>
        )}
      </div>

      {/* Star Progress */}
      <StarProgress />

      {/* Remaining indicator */}
      <RemainingIndicator />

      {/* Action buttons */}
      {gameState === 'answered' && (
        <div className="flex gap-3">
          <Link
            to="/"
            className="flex-1 text-center py-3 rounded-xl bg-gray-800 text-gray-300 font-bold hover:bg-gray-700 transition"
          >
            Done
          </Link>
          {canPlayResult?.canPlay && canPlayResult.remaining > 0 && (
            <button
              onClick={handleNextQuestion}
              className="flex-1 py-3 rounded-xl bg-primary text-gray-900 font-bold hover:bg-primary-600 transition"
            >
              Next Question
            </button>
          )}
        </div>
      )}
    </div>
  );
}
