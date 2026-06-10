/**
 * Play.tsx - Quick Trivia Page
 *
 * Self-paced trivia mode for between-show engagement.
 * Users can answer questions at their own pace and earn stars.
 */

import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle, XCircle, Star, Loader2, Brain, Trophy, User, Mail, Phone, Check, Volume2, MapPin, Image as ImageIcon } from 'lucide-react';
import { auth } from '../lib/firebase';
import { useUser } from '../contexts/UserContext';
import { signInWithGoogle } from '../lib/auth';
import { useTriviaPlay, getSettings, getCategories } from '../lib/triviaLibraryService';
import Spinner from '../components/ui/Spinner';
import GoogleSignInButton from '../components/ui/GoogleSignInButton';
import {
  getUserUsage,
  canPlayMore,
  recordAnswer,
  resetDailyIfNeeded,
  updateMemberStars,
  type UsageData,
  type CanPlayResult,
} from '../lib/engagementService';
import type { TriviaLibrarySettings, TriviaLibraryCategory, TriviaLibraryQuestion } from '../types/firebaseContract';

type GameState = 'loading' | 'ready' | 'answered' | 'limit_reached' | 'no_questions' | 'star_earned';
type DailyAnswerMode = 'choice' | 'multi_select' | 'text' | 'numeric' | 'unsupported';

const choiceQuestionTypes = new Set([
  'multiple_choice',
  'image_choice',
  'image_reveal',
  'mixed_image_faces',
  'guess_person',
  'map_guess_place',
  'audio_clip',
  'true_false',
]);

function getDailyAnswerMode(question: TriviaLibraryQuestion): DailyAnswerMode {
  if (question.type === 'multi_select') return 'multi_select';
  if (question.type === 'closest_number') return 'numeric';
  if (choiceQuestionTypes.has(question.type) && (question.options?.length ?? 0) >= 2) return 'choice';
  if (question.correct_text || question.type === 'type_answer' || question.type === 'lyric_completion' || question.type === 'audio_clip' || question.type === 'map_guess_place') {
    return 'text';
  }
  return 'unsupported';
}

function normaliseAnswerText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ');
}

function getCorrectTextValues(question: TriviaLibraryQuestion): string[] {
  if (Array.isArray(question.correct_text)) return question.correct_text;
  if (typeof question.correct_text === 'string') return [question.correct_text];
  const correctOption = question.options?.find((option) => option.index === question.correct_index);
  return correctOption ? [correctOption.text] : [];
}

function isTextAnswerCorrect(question: TriviaLibraryQuestion, answer: string): boolean {
  const normalizedAnswer = normaliseAnswerText(answer);
  if (!normalizedAnswer) return false;
  return getCorrectTextValues(question).some((value) => normaliseAnswerText(value) === normalizedAnswer);
}

function isNumericAnswerCorrect(question: TriviaLibraryQuestion, answer: string): boolean {
  const submitted = Number(answer);
  if (!Number.isFinite(submitted) || typeof question.numeric_answer !== 'number') return false;
  const tolerance = typeof question.numeric_tolerance === 'number' ? Math.max(0, question.numeric_tolerance) : 0;
  return Math.abs(submitted - question.numeric_answer) <= tolerance;
}

function areSelectionsCorrect(question: TriviaLibraryQuestion, selected: number[]): boolean {
  const expected = [...(question.correct_indices ?? [])].sort((a, b) => a - b);
  const actual = [...selected].sort((a, b) => a - b);
  return expected.length > 0 && expected.length === actual.length && expected.every((value, index) => value === actual[index]);
}

function describeCorrectAnswer(question: TriviaLibraryQuestion): string {
  const textAnswers = getCorrectTextValues(question).filter(Boolean);
  if (textAnswers.length > 0) return textAnswers.join(' / ');

  if (typeof question.numeric_answer === 'number') {
    return question.numeric_tolerance
      ? `${question.numeric_answer} (within ${question.numeric_tolerance})`
      : String(question.numeric_answer);
  }

  if (question.correct_indices?.length) {
    const optionText = question.correct_indices
      .map((index) => question.options?.find((option) => option.index === index)?.text)
      .filter(Boolean);
    if (optionText.length > 0) return optionText.join(', ');
  }

  if (question.map_target?.label) return question.map_target.label;
  if (question.image_hotspot?.label) return question.image_hotspot.label;
  return 'Answer unavailable';
}

export default function Play() {
  const { isRegistered, loading: userLoading, registerUser, isGoogleUser, googlePhotoURL } = useUser();

  const {
    schedule,
    currentQuestion,
    loading: questionLoading,
    error: questionError,
    fetchNextQuestion,
  } = useTriviaPlay();

  const [gameState, setGameState] = useState<GameState>('loading');
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<number[]>([]);
  const [textAnswer, setTextAnswer] = useState('');
  const [numericAnswer, setNumericAnswer] = useState('');
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [canPlayResult, setCanPlayResult] = useState<CanPlayResult | null>(null);
  const [settings, setSettings] = useState<TriviaLibrarySettings | null>(null);
  const [categories, setCategories] = useState<Record<string, TriviaLibraryCategory>>({});
  const [submitting, setSubmitting] = useState(false);

  // Registration form state
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [marketingConsent, setMarketingConsent] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [signingInWithGoogle, setSigningInWithGoogle] = useState(false);

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

        // Get settings, usage, and the category lookup (id -> human-readable name)
        const [settingsData, usageData, playResult, categoriesData] = await Promise.all([
          getSettings(),
          getUserUsage(uid),
          canPlayMore(uid),
          getCategories(),
        ]);

        if (!isMounted) return;

        setSettings(settingsData);
        setUsage(usageData);
        setCanPlayResult(playResult);
        setCategories(categoriesData);

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

  // Record an answer after the UI-specific control has calculated correctness.
  const recordQuestionResult = useCallback(async (correct: boolean) => {
    if (gameState !== 'ready' || !currentQuestion || submitting) return;

    const uid = auth.currentUser?.uid;
    if (!uid) return;

    setSubmitting(true);
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

  // Handle answer selection
  const handleSelectAnswer = useCallback(async (optionIndex: number) => {
    if (!currentQuestion) return;

    setSelectedOption(optionIndex);
    const correct = currentQuestion.question.correct_index !== undefined
      && optionIndex === currentQuestion.question.correct_index;

    await recordQuestionResult(correct);
  }, [currentQuestion, recordQuestionResult]);

  const handleToggleMultiSelect = useCallback((optionIndex: number) => {
    if (gameState !== 'ready' || submitting) return;
    setSelectedOptions((current) =>
      current.includes(optionIndex)
        ? current.filter((index) => index !== optionIndex)
        : [...current, optionIndex]
    );
  }, [gameState, submitting]);

  const handleSubmitMultiSelect = useCallback(async () => {
    if (!currentQuestion || selectedOptions.length === 0) return;
    await recordQuestionResult(areSelectionsCorrect(currentQuestion.question, selectedOptions));
  }, [currentQuestion, selectedOptions, recordQuestionResult]);

  const handleSubmitTextAnswer = useCallback(async () => {
    if (!currentQuestion || textAnswer.trim().length === 0) return;
    await recordQuestionResult(isTextAnswerCorrect(currentQuestion.question, textAnswer));
  }, [currentQuestion, textAnswer, recordQuestionResult]);

  const handleSubmitNumericAnswer = useCallback(async () => {
    if (!currentQuestion || numericAnswer.trim().length === 0) return;
    await recordQuestionResult(isNumericAnswerCorrect(currentQuestion.question, numericAnswer));
  }, [currentQuestion, numericAnswer, recordQuestionResult]);

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
    setSelectedOptions([]);
    setTextAnswer('');
    setNumericAnswer('');
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

  // Pre-fill form when user signs in with Google
  useEffect(() => {
    if (isGoogleUser && auth.currentUser) {
      const user = auth.currentUser;
      console.log('🔄 Pre-filling form from Google:', {
        displayName: user.displayName,
        email: user.email,
        currentDisplayName: displayName,
        currentEmail: email,
      });

      // Pre-fill email if available
      if (user.email && !email) {
        setEmail(user.email);
      }

      // Pre-fill nickname: use displayName, or derive from email as fallback
      if (!displayName) {
        if (user.displayName) {
          setDisplayName(user.displayName);
        } else if (user.email) {
          // Derive nickname from email (e.g., "michael.smith" from "michael.smith@gmail.com")
          const emailName = user.email.split('@')[0];
          // Capitalize first letter and replace dots/underscores with spaces
          const derivedName = emailName
            .replace(/[._]/g, ' ')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
          console.log('📝 Derived nickname from email:', derivedName);
          setDisplayName(derivedName);
        }
      }
    }
  }, [isGoogleUser, displayName, email]);

  const handleGoogleSignIn = async () => {
    setSigningInWithGoogle(true);
    try {
      await signInWithGoogle();
    } catch (error: any) {
      console.error('Google sign-in error:', error);
      if (error?.message !== 'Sign-in cancelled') {
        alert('Failed to sign in with Google. Please try again.');
      }
    } finally {
      setSigningInWithGoogle(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!displayName.trim()) return;
    if (!email.trim() && !phone.trim()) {
      alert('Please provide either an email address or mobile number.');
      return;
    }

    if (!auth.currentUser) {
      alert('Session expired. Please refresh the page and try again.');
      return;
    }

    setRegistering(true);

    try {
      await registerUser({
        displayName: displayName.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        marketingEmails: email.trim() ? marketingConsent : false,
        marketingSMS: phone.trim() ? marketingConsent : false,
      });
      // After registration, the game will load automatically
    } catch (error: any) {
      console.error('Registration error:', error);
      if (error?.code === 'PERMISSION_DENIED' || error?.message?.includes('permission')) {
        alert('Unable to save your profile. Please try signing in with Google instead.');
      } else {
        alert('Failed to register. Please try again or sign in with Google.');
      }
    } finally {
      setRegistering(false);
    }
  };

  // User loading state
  if (userLoading) {
    return (
      <div className="mx-auto max-w-lg space-y-6">
        <header className="flex items-center gap-3">
          <Link to="/" className="p-2 rounded-lg hover:bg-gray-800 transition">
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </Link>
          <h1 className="text-xl font-bold">Daily Trivia</h1>
        </header>
        <div className="flex flex-col items-center justify-center py-12">
          <Spinner className="w-10 h-10 border-4 border-primary border-t-transparent mb-4" />
          <p className="text-gray-400">Checking your account...</p>
        </div>
      </div>
    );
  }

  // Registration gate - show registration form if user is not registered
  if (!isRegistered) {
    return (
      <div className="mx-auto max-w-lg space-y-6">
        <header className="flex items-center gap-3">
          <Link to="/" className="p-2 rounded-lg hover:bg-gray-800 transition">
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </Link>
          <h1 className="text-xl font-bold">Daily Trivia</h1>
        </header>

        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <div className="text-center mb-6">
            <Brain className="w-12 h-12 text-primary mx-auto mb-3" />
            <h2 className="text-xl font-bold mb-2">Join Hollywood Groove</h2>
            <p className="text-gray-400 text-sm">
              Create your profile to play trivia, earn stars, and track your progress!
            </p>
          </div>

          <form onSubmit={handleRegister} className="space-y-4">
            {/* Google Sign-In Option */}
            {!isGoogleUser && (
              <div className="space-y-3">
                <GoogleSignInButton
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={signingInWithGoogle}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-600 bg-gray-800 text-white font-semibold hover:border-primary/60 hover:bg-gray-700 transition disabled:opacity-50"
                >
                  {signingInWithGoogle ? 'Signing in...' : 'Sign in with Google'}
                </GoogleSignInButton>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-700"></div>
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="px-2 bg-gray-900 text-gray-500">or fill out manually</span>
                  </div>
                </div>
              </div>
            )}

            {/* Google User Indicator */}
            {isGoogleUser && (
              <div className="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/30 rounded-xl">
                {googlePhotoURL && (
                  <img src={googlePhotoURL} alt="Profile" className="w-8 h-8 rounded-full border-2 border-green-500/30" />
                )}
                <div className="flex-1 text-sm">
                  <div className="font-medium text-white">Signed in with Google</div>
                  <div className="text-xs text-gray-400">Info pre-filled below</div>
                </div>
                <CheckCircle className="w-5 h-5 text-green-400" />
              </div>
            )}

            {/* Nickname */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5">Nickname</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Enter your nickname"
                  required
                  autoFocus
                  className="w-full pl-10 pr-3 py-3 bg-gray-800 border-2 border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-primary focus:outline-none transition-all"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5">
                Email <span className="text-gray-600 font-normal">(or phone)</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="w-full pl-10 pr-3 py-3 bg-gray-800 border-2 border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-primary focus:outline-none transition-all"
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5">
                Phone <span className="text-gray-600 font-normal">(or email)</span>
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="04XX XXX XXX"
                  className="w-full pl-10 pr-3 py-3 bg-gray-800 border-2 border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-primary focus:outline-none transition-all"
                />
              </div>
            </div>

            {/* Marketing Consent */}
            {(email || phone) && (
              <label className="flex items-start gap-2 cursor-pointer p-3 bg-gray-800 border border-gray-700 rounded-lg">
                <div className="relative flex-shrink-0 mt-0.5">
                  <input
                    type="checkbox"
                    checked={marketingConsent}
                    onChange={(e) => setMarketingConsent(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-5 h-5 border-2 border-gray-600 rounded peer-checked:border-primary peer-checked:bg-primary transition-all flex items-center justify-center">
                    {marketingConsent && <Check className="w-3 h-3 text-gray-900 font-bold" />}
                  </div>
                </div>
                <span className="text-xs text-gray-300">
                  Get show updates and trivia notifications between shows
                </span>
              </label>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!displayName.trim() || (!email.trim() && !phone.trim()) || registering}
              className="w-full py-3 rounded-xl bg-primary text-gray-900 font-bold hover:bg-primary-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {registering ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Joining...
                </span>
              ) : (
                'Start Playing'
              )}
            </button>

            {/* Warning for non-Google users */}
            {!isGoogleUser && (
              <p className="text-xs text-center text-amber-400/80">
                <strong>Tip:</strong> Sign in with Google to save your progress permanently.
              </p>
            )}
          </form>
        </div>
      </div>
    );
  }

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
          <h1 className="text-xl font-bold">Daily Trivia</h1>
        </header>

        <div className="flex flex-col items-center justify-center py-12">
          <Spinner className="w-10 h-10 border-4 border-primary border-t-transparent mb-4" />
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
          <h1 className="text-xl font-bold">Daily Trivia</h1>
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
          <h1 className="text-xl font-bold">Daily Trivia</h1>
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
          <h1 className="text-xl font-bold">Daily Trivia</h1>
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
  const answerMode = getDailyAnswerMode(question);
  const correctAnswerLabel = describeCorrectAnswer(question);
  const showResult = gameState === 'answered';
  // The heading line should show the category/movie NAME, never a raw id.
  // `category_id` is a UUID foreign key into trivia_library/categories — resolve it
  // to its human-readable `name`. Any value that still looks like an id is suppressed.
  const looksLikeId = (value: string) => {
    const v = value.trim();
    // Stored ids are UUIDs with '_' separators (Firebase-key-safe), e.g.
    // "648b10ce_5c94_4db7_b1d4_fa30503f3f13"; also tolerate the '-' form.
    return (
      /^[0-9a-f]{8}[_-][0-9a-f]{4}[_-][0-9a-f]{4}[_-][0-9a-f]{4}[_-][0-9a-f]{12}$/i.test(v) ||
      /^[0-9a-f]{20,}$/i.test(v)
    );
  };
  const formatContextLabel = (value: string) =>
    value
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (match) => match.toUpperCase());
  const categoryName = categories[question.category_id]?.name?.trim();
  const categoryLabel = categoryName
    ? categoryName
    : question.category_id && !looksLikeId(question.category_id)
    ? formatContextLabel(question.category_id)
    : '';
  const subcategoryLabel =
    question.subcategory && !looksLikeId(question.subcategory)
      ? formatContextLabel(question.subcategory)
      : '';
  const questionContext = [subcategoryLabel, categoryLabel].filter(Boolean).join(' • ');

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
          <h1 className="text-xl font-bold">Daily Trivia</h1>
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

        {/* Category / theme heading — hidden entirely if it can't be resolved to a name */}
        {questionContext && (
          <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-2">
            {questionContext}
          </p>
        )}

        {(question.image_url || question.audio_url || question.map_target) && (
          <div className="mb-4 space-y-3">
            {question.image_url && (
              <div className="overflow-hidden rounded-lg border border-gray-800 bg-gray-950">
                <img
                  src={question.image_url}
                  alt="Trivia clue"
                  className="w-full max-h-72 object-contain bg-black"
                />
              </div>
            )}

            {question.audio_url && (
              <div className="rounded-lg border border-gray-800 bg-gray-950 p-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary">
                  <Volume2 className="h-4 w-4" />
                  <span>Audio clue</span>
                </div>
                <audio src={question.audio_url} controls preload="metadata" className="w-full" />
              </div>
            )}

            {question.map_target && (
              <div className="rounded-lg border border-gray-800 bg-gray-950 p-3">
                <div className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                  <div className="text-sm text-gray-300">
                    <div className="font-semibold text-gray-100">Map clue</div>
                    {showResult ? (
                      <div className="text-gray-400">
                        {question.map_target.label ?? 'Target location'}:
                        {' '}
                        {question.map_target.lat.toFixed(4)}, {question.map_target.lng.toFixed(4)}
                      </div>
                    ) : (
                      <div className="text-gray-500">Answer first to reveal the location.</div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <h2 className="text-lg font-bold mb-4 leading-snug">{question.question}</h2>

        {/* Options */}
        {answerMode === 'choice' && (
          <div className="space-y-2">
          {(question.options ?? []).map((option) => {
            const isSelected = selectedOption === option.index;
            const isCorrectOption = option.index === question.correct_index;

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
        )}

        {answerMode === 'multi_select' && (
          <div className="space-y-2">
            {(question.options ?? []).map((option) => {
              const isSelected = selectedOptions.includes(option.index);
              const isCorrectOption = question.correct_indices?.includes(option.index) ?? false;
              let optionClass = 'w-full text-left p-4 rounded-lg border-2 transition-all duration-200 ';

              if (showResult) {
                if (isCorrectOption) {
                  optionClass += 'border-green-500 bg-green-500/10';
                } else if (isSelected) {
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
                  onClick={() => handleToggleMultiSelect(option.index)}
                  disabled={gameState !== 'ready' || submitting}
                  className={optionClass}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{option.text}</span>
                    {(isSelected || (showResult && isCorrectOption)) && (
                      <CheckCircle className={`h-5 w-5 flex-shrink-0 ${showResult && !isCorrectOption ? 'text-red-400' : 'text-primary'}`} />
                    )}
                  </div>
                </button>
              );
            })}
            {gameState === 'ready' && (
              <button
                onClick={handleSubmitMultiSelect}
                disabled={selectedOptions.length === 0 || submitting}
                className="w-full rounded-lg bg-primary px-4 py-3 font-bold text-gray-900 transition hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Submit Selections
              </button>
            )}
          </div>
        )}

        {answerMode === 'text' && (
          <div className="space-y-3">
            <input
              type="text"
              value={textAnswer}
              onChange={(event) => setTextAnswer(event.target.value)}
              disabled={gameState !== 'ready' || submitting}
              placeholder="Type your answer"
              className="w-full rounded-lg border-2 border-gray-700 bg-gray-800 px-4 py-3 text-gray-100 placeholder-gray-500 outline-none transition focus:border-primary disabled:opacity-60"
            />
            {gameState === 'ready' && (
              <button
                onClick={handleSubmitTextAnswer}
                disabled={textAnswer.trim().length === 0 || submitting}
                className="w-full rounded-lg bg-primary px-4 py-3 font-bold text-gray-900 transition hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Submit Answer
              </button>
            )}
          </div>
        )}

        {answerMode === 'numeric' && (
          <div className="space-y-3">
            <input
              type="number"
              value={numericAnswer}
              onChange={(event) => setNumericAnswer(event.target.value)}
              disabled={gameState !== 'ready' || submitting}
              placeholder="Enter a number"
              className="w-full rounded-lg border-2 border-gray-700 bg-gray-800 px-4 py-3 text-gray-100 placeholder-gray-500 outline-none transition focus:border-primary disabled:opacity-60"
            />
            {gameState === 'ready' && (
              <button
                onClick={handleSubmitNumericAnswer}
                disabled={numericAnswer.trim().length === 0 || submitting}
                className="w-full rounded-lg bg-primary px-4 py-3 font-bold text-gray-900 transition hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Submit Answer
              </button>
            )}
          </div>
        )}

        {answerMode === 'unsupported' && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
            <div className="mb-2 flex items-center gap-2 font-semibold">
              <ImageIcon className="h-4 w-4" />
              <span>This trivia type needs a playable answer field.</span>
            </div>
            <p className="text-amber-100/80">
              Add options, accepted text, or a numeric answer before scheduling it.
            </p>
          </div>
        )}

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
            <p className="mb-2 text-sm text-gray-300">
              Correct answer: <span className="font-semibold text-gray-100">{correctAnswerLabel}</span>
            </p>
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
