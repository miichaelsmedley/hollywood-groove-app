/**
 * Engagement Service
 *
 * Handles user usage tracking, star progress, and daily limits for between-show trivia.
 */

import { ref, get, set, update, runTransaction } from 'firebase/database';
import { db, rtdbPath } from './firebase';
import {
  getSettings,
  getMelbourneDateString,
  getMelbourneWeekStart,
} from './triviaLibraryService';
import type { TriviaLibraryUsage } from '../types/firebaseContract';

// ============================================
// Types
// ============================================

export interface UsageData {
  questionsToday: number;
  activitiesToday: number;
  starProgressToday: number;
  starsEarnedToday: number;
  starsThisWeek: number;
  recentQuestions: string[];
  recentActivities: string[];
  totalQuestionsAnswered: number;
  totalCorrect: number;
  totalActivitiesCompleted: number;
  totalStarsFromEngagement: number;
}

export interface CanPlayResult {
  canPlay: boolean;
  remaining: number;
  reason?: string;
}

export interface RecordAnswerResult {
  newStarEarned: boolean;
  progress: number;
  starsEarnedToday: number;
  starsThisWeek: number;
}

// ============================================
// Default Usage Data
// ============================================

function getDefaultUsage(today: string, weekStart: string): TriviaLibraryUsage {
  return {
    questions_today: 0,
    activities_today: 0,
    last_activity_date: today,
    star_progress_today: 0,
    stars_earned_today: 0,
    stars_earned_this_week: 0,
    week_start_date: weekStart,
    recent_questions: [],
    recent_activities: [],
    total_questions_answered: 0,
    total_correct: 0,
    total_activities_completed: 0,
    total_stars_from_engagement: 0,
  };
}

// ============================================
// Usage Functions
// ============================================

/**
 * Get user's current usage data
 */
export async function getUserUsage(userId: string): Promise<UsageData> {
  const today = getMelbourneDateString();
  const weekStart = getMelbourneWeekStart();

  const snapshot = await get(ref(db, rtdbPath(`trivia_library/usage/${userId}`)));

  if (!snapshot.exists()) {
    const defaults = getDefaultUsage(today, weekStart);
    return {
      questionsToday: defaults.questions_today,
      activitiesToday: defaults.activities_today,
      starProgressToday: defaults.star_progress_today,
      starsEarnedToday: defaults.stars_earned_today,
      starsThisWeek: defaults.stars_earned_this_week,
      recentQuestions: defaults.recent_questions,
      recentActivities: defaults.recent_activities,
      totalQuestionsAnswered: defaults.total_questions_answered,
      totalCorrect: defaults.total_correct,
      totalActivitiesCompleted: defaults.total_activities_completed,
      totalStarsFromEngagement: defaults.total_stars_from_engagement,
    };
  }

  const data = snapshot.val() as TriviaLibraryUsage;

  // Check if we need to reset daily counters
  const needsDailyReset = data.last_activity_date !== today;
  const needsWeeklyReset = data.week_start_date !== weekStart;

  return {
    questionsToday: needsDailyReset ? 0 : data.questions_today,
    activitiesToday: needsDailyReset ? 0 : data.activities_today,
    starProgressToday: needsDailyReset ? 0 : data.star_progress_today,
    starsEarnedToday: needsDailyReset ? 0 : data.stars_earned_today,
    starsThisWeek: needsWeeklyReset ? 0 : data.stars_earned_this_week,
    recentQuestions: data.recent_questions || [],
    recentActivities: data.recent_activities || [],
    totalQuestionsAnswered: data.total_questions_answered || 0,
    totalCorrect: data.total_correct || 0,
    totalActivitiesCompleted: data.total_activities_completed || 0,
    totalStarsFromEngagement: data.total_stars_from_engagement || 0,
  };
}

/**
 * Check if user can play more trivia today
 */
export async function canPlayMore(userId: string): Promise<CanPlayResult> {
  const settings = await getSettings();
  const usage = await getUserUsage(userId);

  const totalToday = usage.questionsToday + usage.activitiesToday;

  // Check daily question limit
  if (totalToday >= settings.default_user_limit) {
    return {
      canPlay: false,
      remaining: 0,
      reason: 'Daily question limit reached. Come back tomorrow!',
    };
  }

  // Check daily star cap
  if (usage.starsEarnedToday >= settings.star_daily_cap) {
    // Can still play for fun, but won't earn more stars today
    return {
      canPlay: true,
      remaining: settings.default_user_limit - totalToday,
      reason: 'Daily star limit reached, but you can still play for fun!',
    };
  }

  // Check weekly star cap
  if (usage.starsThisWeek >= settings.star_weekly_cap) {
    return {
      canPlay: true,
      remaining: settings.default_user_limit - totalToday,
      reason: 'Weekly star limit reached, but you can still play for fun!',
    };
  }

  return {
    canPlay: true,
    remaining: settings.default_user_limit - totalToday,
  };
}

/**
 * Reset daily counters if needed (call at start of session)
 */
export async function resetDailyIfNeeded(userId: string): Promise<boolean> {
  const today = getMelbourneDateString();
  const weekStart = getMelbourneWeekStart();

  const usageRef = ref(db, rtdbPath(`trivia_library/usage/${userId}`));
  const snapshot = await get(usageRef);

  if (!snapshot.exists()) {
    // Initialize fresh usage record
    await set(usageRef, getDefaultUsage(today, weekStart));
    return true;
  }

  const data = snapshot.val() as TriviaLibraryUsage;
  const needsDailyReset = data.last_activity_date !== today;
  const needsWeeklyReset = data.week_start_date !== weekStart;

  if (needsDailyReset || needsWeeklyReset) {
    const updates: Partial<TriviaLibraryUsage> = {
      last_activity_date: today,
    };

    if (needsDailyReset) {
      updates.questions_today = 0;
      updates.activities_today = 0;
      updates.star_progress_today = 0;
      updates.stars_earned_today = 0;
    }

    if (needsWeeklyReset) {
      updates.week_start_date = weekStart;
      updates.stars_earned_this_week = 0;
    }

    await update(usageRef, updates);
    return true;
  }

  return false;
}

/**
 * Record a trivia answer and update usage/star progress
 */
export async function recordAnswer(
  userId: string,
  questionId: string,
  correct: boolean,
  starValue: number
): Promise<RecordAnswerResult> {
  const settings = await getSettings();
  const today = getMelbourneDateString();
  const weekStart = getMelbourneWeekStart();

  const usageRef = ref(db, rtdbPath(`trivia_library/usage/${userId}`));

  // Use transaction to ensure atomic updates
  const result = await runTransaction(usageRef, (currentData) => {
    const data = currentData || getDefaultUsage(today, weekStart);

    // Check if we need resets
    const needsDailyReset = data.last_activity_date !== today;
    const needsWeeklyReset = data.week_start_date !== weekStart;

    if (needsDailyReset) {
      data.questions_today = 0;
      data.activities_today = 0;
      data.star_progress_today = 0;
      data.stars_earned_today = 0;
      data.last_activity_date = today;
    }

    if (needsWeeklyReset) {
      data.week_start_date = weekStart;
      data.stars_earned_this_week = 0;
    }

    // Update counters
    data.questions_today = (data.questions_today || 0) + 1;
    data.total_questions_answered = (data.total_questions_answered || 0) + 1;

    if (correct) {
      data.total_correct = (data.total_correct || 0) + 1;

      // Only add star progress if under caps
      const underDailyCap = data.stars_earned_today < settings.star_daily_cap;
      const underWeeklyCap = data.stars_earned_this_week < settings.star_weekly_cap;

      if (underDailyCap && underWeeklyCap) {
        data.star_progress_today = (data.star_progress_today || 0) + starValue;

        // Check if threshold reached
        if (data.star_progress_today >= settings.star_threshold) {
          // Award star
          data.stars_earned_today = (data.stars_earned_today || 0) + settings.stars_per_threshold;
          data.stars_earned_this_week = (data.stars_earned_this_week || 0) + settings.stars_per_threshold;
          data.total_stars_from_engagement = (data.total_stars_from_engagement || 0) + settings.stars_per_threshold;

          // Reset progress (keep overflow)
          data.star_progress_today = data.star_progress_today - settings.star_threshold;
        }
      }
    }

    // Update recent questions (keep last 20)
    const recentQuestions = data.recent_questions || [];
    if (!recentQuestions.includes(questionId)) {
      recentQuestions.push(questionId);
      if (recentQuestions.length > 20) {
        recentQuestions.shift();
      }
      data.recent_questions = recentQuestions;
    }

    return data;
  });

  const finalData = result.snapshot.val() as TriviaLibraryUsage;

  // Check if a new star was earned this transaction
  // (we determine this by checking if progress just went below threshold after being above)
  const previousProgress =
    finalData.star_progress_today +
    (correct ? 0 : starValue) +
    (finalData.stars_earned_today > 0 ? settings.star_threshold : 0);

  const newStarEarned =
    correct &&
    previousProgress >= settings.star_threshold &&
    finalData.star_progress_today < settings.star_threshold;

  return {
    newStarEarned,
    progress: finalData.star_progress_today,
    starsEarnedToday: finalData.stars_earned_today,
    starsThisWeek: finalData.stars_earned_this_week,
  };
}

/**
 * Record an activity completion (yes/no, rating, poll, etc.)
 */
export async function recordActivity(
  userId: string,
  activityId: string,
  starValue: number
): Promise<RecordAnswerResult> {
  const settings = await getSettings();
  const today = getMelbourneDateString();
  const weekStart = getMelbourneWeekStart();

  const usageRef = ref(db, rtdbPath(`trivia_library/usage/${userId}`));

  const result = await runTransaction(usageRef, (currentData) => {
    const data = currentData || getDefaultUsage(today, weekStart);

    // Check if we need resets
    const needsDailyReset = data.last_activity_date !== today;
    const needsWeeklyReset = data.week_start_date !== weekStart;

    if (needsDailyReset) {
      data.questions_today = 0;
      data.activities_today = 0;
      data.star_progress_today = 0;
      data.stars_earned_today = 0;
      data.last_activity_date = today;
    }

    if (needsWeeklyReset) {
      data.week_start_date = weekStart;
      data.stars_earned_this_week = 0;
    }

    // Update counters
    data.activities_today = (data.activities_today || 0) + 1;
    data.total_activities_completed = (data.total_activities_completed || 0) + 1;

    // Activities always count as "correct" for star progress (participation credit)
    const underDailyCap = data.stars_earned_today < settings.star_daily_cap;
    const underWeeklyCap = data.stars_earned_this_week < settings.star_weekly_cap;

    if (underDailyCap && underWeeklyCap) {
      data.star_progress_today = (data.star_progress_today || 0) + starValue;

      // Check if threshold reached
      if (data.star_progress_today >= settings.star_threshold) {
        data.stars_earned_today = (data.stars_earned_today || 0) + settings.stars_per_threshold;
        data.stars_earned_this_week = (data.stars_earned_this_week || 0) + settings.stars_per_threshold;
        data.total_stars_from_engagement = (data.total_stars_from_engagement || 0) + settings.stars_per_threshold;
        data.star_progress_today = data.star_progress_today - settings.star_threshold;
      }
    }

    // Update recent activities
    const recentActivities = data.recent_activities || [];
    if (!recentActivities.includes(activityId)) {
      recentActivities.push(activityId);
      if (recentActivities.length > 20) {
        recentActivities.shift();
      }
      data.recent_activities = recentActivities;
    }

    return data;
  });

  const finalData = result.snapshot.val() as TriviaLibraryUsage;

  return {
    newStarEarned: false, // We'll determine this more carefully in the UI
    progress: finalData.star_progress_today,
    starsEarnedToday: finalData.stars_earned_today,
    starsThisWeek: finalData.stars_earned_this_week,
  };
}

/**
 * Update the member profile with stars earned from engagement
 * This should be called when a star is earned to update the global member record
 */
export async function updateMemberStars(
  userId: string,
  starsToAdd: number
): Promise<void> {
  const memberRef = ref(db, rtdbPath(`members/${userId}`));

  await runTransaction(memberRef, (currentData) => {
    if (!currentData) {
      // Member record should exist, but if not, skip
      return currentData;
    }

    // Update stars breakdown
    const stars = currentData.stars || {
      total: 0,
      tier: 'extra',
      starting_bonus: 0,
      breakdown: {
        shows_attended: 0,
        trivia_participated: 0,
        dancing_engaged: 0,
        stage_participation: 0,
        between_show_trivia: 0,
        referrals: 0,
        early_tickets: 0,
        social_shares: 0,
        feedback_given: 0,
      },
    };

    stars.breakdown.between_show_trivia =
      (stars.breakdown.between_show_trivia || 0) + starsToAdd;
    stars.total = (stars.total || 0) + starsToAdd;

    // Update tier based on new total
    stars.tier = getTierFromStars(stars.total);

    currentData.stars = stars;
    return currentData;
  });
}

/**
 * Get tier name from star count
 */
function getTierFromStars(totalStars: number): string {
  if (totalStars >= 5) return 'legend';
  if (totalStars >= 4) return 'director';
  if (totalStars >= 3) return 'lead';
  if (totalStars >= 2) return 'featured';
  if (totalStars >= 1) return 'supporting_role';
  return 'extra';
}
