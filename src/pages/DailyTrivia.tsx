import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ref, onValue, set, get } from 'firebase/database';
import { db, auth, rtdbPath } from '../lib/firebase';
import { ArrowLeft, Star } from 'lucide-react';

interface TriviaQuestion {
  id: string;
  question: string;
  category?: string; // e.g., "Studio Ghibli Films", "80s Movies"
  topic?: string; // e.g., "Spirited Away", "The Breakfast Club"
  difficulty: 'Easy' | 'Medium' | 'Hard';
  points: number;
  options: {
    index: number;
    text: string;
  }[];
}

interface UserDailyProgress {
  questionsAnswered: number;
  starsEarned: number;
  lastAnsweredAt: number;
}

export default function DailyTrivia() {
  const navigate = useNavigate();
  const [currentQuestion, setCurrentQuestion] = useState<TriviaQuestion | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [progress, setProgress] = useState<UserDailyProgress>({
    questionsAnswered: 0,
    starsEarned: 0,
    lastAnsweredAt: 0,
  });
  const [loading, setLoading] = useState(true);
  const [hasAnswered, setHasAnswered] = useState(false);

  const maxDailyQuestions = 10;
  const questionsLeft = maxDailyQuestions - progress.questionsAnswered;
  const maxDailyStars = 3.0;

  useEffect(() => {
    if (!auth.currentUser) {
      setLoading(false);
      return;
    }

    const uid = auth.currentUser.uid;
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Load user's daily progress
    const progressRef = ref(db, rtdbPath(`between_show_trivia/daily/${today}/progress/${uid}`));
    const unsubProgress = onValue(progressRef, (snapshot) => {
      if (snapshot.exists()) {
        setProgress(snapshot.val());
      }
    });

    // Load current question (use first unanswered question for the day)
    const loadQuestion = async () => {
      const questionsRef = ref(db, rtdbPath('between_show_trivia/questions'));
      const snapshot = await get(questionsRef);

      if (snapshot.exists()) {
        const questions = Object.entries(snapshot.val() || {}).map(([id, data]: [string, any]) => ({
          id,
          ...data,
        })) as TriviaQuestion[];

        // Get user's answered questions for today
        const answeredRef = ref(db, rtdbPath(`between_show_trivia/daily/${today}/responses/${uid}`));
        const answeredSnap = await get(answeredRef);
        const answeredIds = answeredSnap.exists() ? Object.keys(answeredSnap.val() || {}) : [];

        // Find first unanswered question
        const unanswered = questions.find(q => !answeredIds.includes(q.id));
        setCurrentQuestion(unanswered || null);
      }

      setLoading(false);
    };

    loadQuestion();

    return () => {
      unsubProgress();
    };
  }, []);

  const handleAnswer = async () => {
    if (selectedOption === null || !currentQuestion || !auth.currentUser) return;

    const uid = auth.currentUser.uid;
    const today = new Date().toISOString().split('T')[0];

    // Save user's answer
    const responseRef = ref(db, rtdbPath(`between_show_trivia/daily/${today}/responses/${uid}/${currentQuestion.id}`));
    await set(responseRef, {
      optionIndex: selectedOption,
      answeredAt: Date.now(),
    });

    // Update progress (in real app, this would be done by Cloud Function after checking if answer is correct)
    const newProgress = {
      questionsAnswered: progress.questionsAnswered + 1,
      starsEarned: progress.starsEarned + (currentQuestion.points / 100), // Assuming points convert to stars
      lastAnsweredAt: Date.now(),
    };

    const progressRef = ref(db, rtdbPath(`between_show_trivia/daily/${today}/progress/${uid}`));
    await set(progressRef, newProgress);

    setHasAnswered(true);

    // Auto-advance to next question after 2 seconds
    setTimeout(() => {
      setHasAnswered(false);
      setSelectedOption(null);
      setProgress(newProgress);
      // Would reload to get next question
      window.location.reload();
    }, 2000);
  };

  // Generate descriptive title
  const getTitle = () => {
    if (!currentQuestion) return 'Daily Trivia';

    // Priority: topic > category > "Daily Trivia"
    if (currentQuestion.topic) {
      return `Trivia about ${currentQuestion.topic}`;
    }
    if (currentQuestion.category) {
      return currentQuestion.category;
    }
    return 'Daily Trivia';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-cinema flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-cinema-500 font-medium">Loading trivia...</p>
        </div>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="min-h-screen bg-cinema flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-md">
          <Star className="w-16 h-16 text-primary mx-auto" />
          <h2 className="text-2xl font-bold">All done for today!</h2>
          <p className="text-cinema-600">
            You've answered all available questions. Come back tomorrow for more!
          </p>
          <button
            onClick={() => navigate('/')}
            className="btn-primary"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cinema flex flex-col">
      {/* Header - Fixed */}
      <header className="bg-cinema-900 text-white border-b border-cinema-700">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-cinema-800 rounded-lg transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-bold">{getTitle()}</h1>
          </div>
        </div>
      </header>

      {/* Scrollable content area - Fits within viewport */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">
          {/* Question Card */}
          <div className="bg-cinema-800 text-white rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="inline-flex px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-400 text-sm font-semibold">
                {currentQuestion.difficulty}
              </span>
              <span className="text-yellow-400 text-sm font-semibold">
                {currentQuestion.points} point{currentQuestion.points !== 1 ? 's' : ''}
              </span>
            </div>

            <h2 className="text-lg font-semibold leading-tight">
              {currentQuestion.question}
            </h2>

            {/* Options */}
            <div className="space-y-2">
              {currentQuestion.options.map((option) => (
                <button
                  key={option.index}
                  onClick={() => !hasAnswered && setSelectedOption(option.index)}
                  disabled={hasAnswered}
                  className={`
                    w-full text-left px-4 py-3 rounded-xl font-medium transition
                    ${selectedOption === option.index
                      ? 'bg-primary text-cinema-900 border-2 border-primary'
                      : 'bg-cinema-700 text-white border-2 border-cinema-600 hover:border-primary/60'
                    }
                    ${hasAnswered ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                  `}
                >
                  {option.text}
                </button>
              ))}
            </div>
          </div>

          {/* Progress Card */}
          <div className="bg-cinema-800 text-white rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                <span className="font-semibold">Star Progress</span>
              </div>
              <span className="text-lg font-bold text-yellow-400">
                {progress.starsEarned.toFixed(1)} / {maxDailyStars.toFixed(1)}
              </span>
            </div>

            {progress.starsEarned > 0 && (
              <div className="text-center py-2 bg-yellow-500/10 rounded-lg">
                <span className="text-yellow-400 font-semibold">
                  {progress.starsEarned.toFixed(1)} star{progress.starsEarned !== 1 ? 's' : ''} earned today!
                </span>
              </div>
            )}

            <div className="text-center text-sm text-cinema-400">
              {questionsLeft} question{questionsLeft !== 1 ? 's' : ''} left today
            </div>

            {progress.questionsAnswered >= maxDailyQuestions && (
              <div className="text-center text-sm text-cinema-400 italic">
                Daily star limit reached, but you can still play for fun!
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer - Fixed, always visible */}
      <footer className="bg-cinema-900 border-t border-cinema-700 pb-safe">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <button
            onClick={handleAnswer}
            disabled={selectedOption === null || hasAnswered}
            className={`
              w-full py-4 rounded-xl font-bold text-lg transition
              ${selectedOption !== null && !hasAnswered
                ? 'bg-primary text-cinema-900 hover:bg-primary/90 shadow-glow'
                : 'bg-cinema-700 text-cinema-500 cursor-not-allowed'
              }
            `}
          >
            {hasAnswered ? 'Submitted!' : 'Submit Answer'}
          </button>
        </div>
      </footer>
    </div>
  );
}
