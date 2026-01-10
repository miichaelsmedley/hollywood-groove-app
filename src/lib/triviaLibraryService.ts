/**
 * Trivia Library Service
 *
 * Handles fetching trivia questions and schedule from the trivia_library.
 */

import { useState, useEffect } from 'react';
import { ref, get } from 'firebase/database';
import { db, auth } from './firebase';

// Note: trivia_library is stored at root, NOT under test/ prefix
// This is intentional - trivia content is shared across test/prod
import type {
  TriviaLibrarySettings,
  TriviaLibrarySchedule,
  TriviaLibraryQuestion,
  TriviaLibraryActivity,
  TriviaLibraryCategory,
} from '../types/firebaseContract';

// ============================================
// Timezone Helpers
// ============================================

/**
 * Get today's date string in Melbourne timezone (YYYY-MM-DD format)
 */
export function getMelbourneDateString(): string {
  return new Date().toLocaleDateString('en-CA', {
    timeZone: 'Australia/Melbourne',
  });
}

/**
 * Get the start of the current week (Monday) in Melbourne timezone
 */
export function getMelbourneWeekStart(): string {
  const now = new Date();
  const melbourneDate = new Date(
    now.toLocaleString('en-US', { timeZone: 'Australia/Melbourne' })
  );
  const day = melbourneDate.getDay();
  const diff = melbourneDate.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  const monday = new Date(melbourneDate.setDate(diff));
  return monday.toLocaleDateString('en-CA', { timeZone: 'Australia/Melbourne' });
}

// ============================================
// Settings
// ============================================

let cachedSettings: TriviaLibrarySettings | null = null;

/**
 * Get trivia library settings
 */
export async function getSettings(): Promise<TriviaLibrarySettings> {
  if (cachedSettings) return cachedSettings;

  const snapshot = await get(ref(db, 'trivia_library/settings'));
  if (snapshot.exists()) {
    cachedSettings = snapshot.val() as TriviaLibrarySettings;
    return cachedSettings;
  }

  // Return defaults if settings not found
  return {
    global_daily_limit: 20,
    default_user_limit: 10,
    timezone: 'Australia/Melbourne',
    star_daily_cap: 1,
    star_weekly_cap: 3,
    stars_per_threshold: 1,
    star_threshold: 3.0,
  };
}

// ============================================
// Schedule
// ============================================

/**
 * Get today's schedule (theme)
 */
export async function getTodaySchedule(): Promise<TriviaLibrarySchedule | null> {
  const today = getMelbourneDateString();
  const snapshot = await get(ref(db, `trivia_library/schedule/${today}`));

  if (snapshot.exists()) {
    return snapshot.val() as TriviaLibrarySchedule;
  }
  return null;
}

// ============================================
// Categories
// ============================================

/**
 * Get all categories
 */
export async function getCategories(): Promise<Record<string, TriviaLibraryCategory>> {
  const snapshot = await get(ref(db, 'trivia_library/categories'));
  if (snapshot.exists()) {
    return snapshot.val() as Record<string, TriviaLibraryCategory>;
  }
  return {};
}

// ============================================
// Questions
// ============================================

/**
 * Get all active questions, optionally filtered by category
 */
export async function getActiveQuestions(
  categoryId?: string,
  subcategory?: string
): Promise<Record<string, TriviaLibraryQuestion>> {
  const snapshot = await get(ref(db, 'trivia_library/questions'));

  if (!snapshot.exists()) {
    console.log('🎯 No questions found at trivia_library/questions');
    return {};
  }

  const allQuestions = snapshot.val() as Record<string, TriviaLibraryQuestion>;
  console.log('🎯 Total questions in DB:', Object.keys(allQuestions).length);

  // Filter to active questions matching criteria
  const filtered: Record<string, TriviaLibraryQuestion> = {};
  let skippedInactive = 0;
  let skippedCategory = 0;
  let skippedSubcategory = 0;

  for (const [id, question] of Object.entries(allQuestions)) {
    if (!question.active) {
      skippedInactive++;
      continue;
    }
    if (categoryId && question.category_id !== categoryId) {
      skippedCategory++;
      continue;
    }
    if (subcategory && question.subcategory !== subcategory) {
      skippedSubcategory++;
      continue;
    }
    filtered[id] = question;
  }

  console.log('🎯 Question filtering:', {
    categoryId,
    subcategory,
    totalInDB: Object.keys(allQuestions).length,
    skippedInactive,
    skippedCategory,
    skippedSubcategory,
    matched: Object.keys(filtered).length,
    sampleCategoryIds: Object.values(allQuestions).slice(0, 3).map(q => q.category_id),
  });

  return filtered;
}

/**
 * Get a random question that the user hasn't recently answered
 */
export async function getRandomQuestion(
  excludeIds: string[] = [],
  categoryId?: string,
  subcategory?: string
): Promise<{ id: string; question: TriviaLibraryQuestion } | null> {
  const questions = await getActiveQuestions(categoryId, subcategory);
  const excludeSet = new Set(excludeIds);

  // Filter out recently answered
  const available = Object.entries(questions).filter(([id]) => !excludeSet.has(id));

  if (available.length === 0) {
    // If no questions left excluding recent, allow any active question
    const allAvailable = Object.entries(questions);
    if (allAvailable.length === 0) return null;

    const randomIndex = Math.floor(Math.random() * allAvailable.length);
    const [id, question] = allAvailable[randomIndex];
    return { id, question };
  }

  // Pick random from available
  const randomIndex = Math.floor(Math.random() * available.length);
  const [id, question] = available[randomIndex];
  return { id, question };
}

/**
 * Get a specific question by ID
 */
export async function getQuestion(
  questionId: string
): Promise<TriviaLibraryQuestion | null> {
  const snapshot = await get(
    ref(db, `trivia_library/questions/${questionId}`)
  );
  if (snapshot.exists()) {
    return snapshot.val() as TriviaLibraryQuestion;
  }
  return null;
}

// ============================================
// Activities
// ============================================

/**
 * Get all active activities
 */
export async function getActiveActivities(
  categoryId?: string
): Promise<Record<string, TriviaLibraryActivity>> {
  const snapshot = await get(ref(db, 'trivia_library/activities'));

  if (!snapshot.exists()) return {};

  const allActivities = snapshot.val() as Record<string, TriviaLibraryActivity>;

  const filtered: Record<string, TriviaLibraryActivity> = {};
  for (const [id, activity] of Object.entries(allActivities)) {
    if (!activity.active) continue;
    if (categoryId && activity.category_id !== categoryId) continue;
    filtered[id] = activity;
  }

  return filtered;
}

/**
 * Get a random activity
 */
export async function getRandomActivity(
  excludeIds: string[] = [],
  categoryId?: string
): Promise<{ id: string; activity: TriviaLibraryActivity } | null> {
  const activities = await getActiveActivities(categoryId);
  const excludeSet = new Set(excludeIds);

  const available = Object.entries(activities).filter(([id]) => !excludeSet.has(id));

  if (available.length === 0) {
    const allAvailable = Object.entries(activities);
    if (allAvailable.length === 0) return null;

    const randomIndex = Math.floor(Math.random() * allAvailable.length);
    const [id, activity] = allAvailable[randomIndex];
    return { id, activity };
  }

  const randomIndex = Math.floor(Math.random() * available.length);
  const [id, activity] = available[randomIndex];
  return { id, activity };
}

// ============================================
// React Hooks
// ============================================

interface TriviaHomeData {
  schedule: TriviaLibrarySchedule | null;
  remaining: number | null;
  loading: boolean;
}

/**
 * Hook for Home page - fetches schedule and remaining questions
 */
export function useTriviaHome(): TriviaHomeData {
  const [schedule, setSchedule] = useState<TriviaLibrarySchedule | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function fetchData() {
      try {
        // Fetch schedule
        const scheduleData = await getTodaySchedule();
        if (isMounted) setSchedule(scheduleData);

        // Fetch settings and usage to calculate remaining
        const settings = await getSettings();
        const uid = auth.currentUser?.uid;

        if (uid) {
          const today = getMelbourneDateString();
          const usageSnapshot = await get(
            ref(db, `trivia_library/usage/${uid}`)
          );

          if (usageSnapshot.exists()) {
            const usage = usageSnapshot.val();
            // Check if it's a new day
            if (usage.last_activity_date === today) {
              const used = (usage.questions_today || 0) + (usage.activities_today || 0);
              if (isMounted) setRemaining(Math.max(0, settings.default_user_limit - used));
            } else {
              // New day, full quota available
              if (isMounted) setRemaining(settings.default_user_limit);
            }
          } else {
            // No usage record yet
            if (isMounted) setRemaining(settings.default_user_limit);
          }
        } else {
          // No user, show default limit
          if (isMounted) setRemaining(settings.default_user_limit);
        }
      } catch (error) {
        console.error('Error fetching trivia home data:', error);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchData();

    return () => {
      isMounted = false;
    };
  }, []);

  return { schedule, remaining, loading };
}

interface TriviaPlayData {
  settings: TriviaLibrarySettings | null;
  schedule: TriviaLibrarySchedule | null;
  currentQuestion: { id: string; question: TriviaLibraryQuestion } | null;
  loading: boolean;
  error: string | null;
  fetchNextQuestion: () => Promise<void>;
}

/**
 * Hook for Play page - manages current question and fetching next
 */
export function useTriviaPlay(): TriviaPlayData {
  const [settings, setSettings] = useState<TriviaLibrarySettings | null>(null);
  const [schedule, setSchedule] = useState<TriviaLibrarySchedule | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<{
    id: string;
    question: TriviaLibraryQuestion;
  } | null>(null);
  const [recentQuestionIds, setRecentQuestionIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initial load
  useEffect(() => {
    let isMounted = true;

    async function init() {
      try {
        const [settingsData, scheduleData] = await Promise.all([
          getSettings(),
          getTodaySchedule(),
        ]);

        if (!isMounted) return;

        setSettings(settingsData);
        setSchedule(scheduleData);

        // Load recent question IDs from user's usage
        const uid = auth.currentUser?.uid;
        if (uid) {
          const usageSnapshot = await get(
            ref(db, `trivia_library/usage/${uid}`)
          );
          if (usageSnapshot.exists()) {
            const usage = usageSnapshot.val();
            setRecentQuestionIds(usage.recent_questions || []);
          }
        }

        // Fetch first question
        const categoryId = scheduleData?.category_id;
        const subcategory = scheduleData?.subcategory;

        console.log('🎯 Trivia init:', {
          scheduleData,
          categoryId,
          subcategory,
        });

        const question = await getRandomQuestion([], categoryId, subcategory);

        console.log('🎯 Question result:', question ? `Found: ${question.id}` : 'No questions found');

        if (isMounted) {
          setCurrentQuestion(question);
          if (!question) {
            setError('No questions available');
          }
        }
      } catch (err) {
        console.error('Error initializing trivia play:', err);
        if (isMounted) setError('Failed to load trivia');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    init();

    return () => {
      isMounted = false;
    };
  }, []);

  const fetchNextQuestion = async () => {
    setLoading(true);
    setError(null);

    try {
      const categoryId = schedule?.category_id;
      const subcategory = schedule?.subcategory;

      // Add current question to recent list
      const newRecent = currentQuestion
        ? [...recentQuestionIds, currentQuestion.id].slice(-20) // Keep last 20
        : recentQuestionIds;

      setRecentQuestionIds(newRecent);

      const question = await getRandomQuestion(newRecent, categoryId, subcategory);
      setCurrentQuestion(question);

      if (!question) {
        setError('No more questions available');
      }
    } catch (err) {
      console.error('Error fetching next question:', err);
      setError('Failed to load question');
    } finally {
      setLoading(false);
    }
  };

  return {
    settings,
    schedule,
    currentQuestion,
    loading,
    error,
    fetchNextQuestion,
  };
}
