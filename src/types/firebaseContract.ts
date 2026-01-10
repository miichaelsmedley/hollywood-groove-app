// 1. Show Metadata (Public read)
// Path: shows/{showId}/meta
export interface ShowMeta {
  title: string;
  startDate: string; // ISO 8601 string
  venueName: string;
  schemaVersion: number;
  publishedAt: number; // Timestamp
}

// 2. Crowd Activity (Public read)
// Path: shows/{showId}/activities/{activityId}
export type ActivityType =
  | 'trivia'
  | 'dancing'
  | 'sing_signup'
  | 'backup_singer'
  | 'costume_contest'
  | 'competition'
  | 'stage_participation'
  | 'vote'
  | 'raffle';

export interface BaseActivity {
  type: ActivityType;
  title: string;
  sequence?: number;
  setId?: number;
  songId?: number;
  description?: string;
  prompt?: string;
  prize?: string;
  maxParticipants?: number;
  dancing?: {
    prompt?: string;
    current_median?: number;
  };
  options?: {
    index: number;
    text: string;
  }[];
}

export interface TriviaActivity extends BaseActivity {
  type: 'trivia';
  trivia: {
    question: string;
    // Controller uses `freeform`; keep `text` as a backward-compatible alias.
    kind: 'multi' | 'freeform' | 'text' | 'boolean' | 'scale';
    durationSeconds?: number;
    image?: {
      mimeType: 'image/png' | 'image/jpeg';
      base64: string;
    };
    options?: {
      index: number;
      text: string;
    }[];
    scale?: {
      min: number;
      max: number;
      step?: number;
      leftLabel?: string;
      rightLabel?: string;
    };
  };
}

// Union type for all activities
export type CrowdActivity = TriviaActivity | BaseActivity;

// 3. Show Settings (Controller writes, PWA reads)
// Path: shows/{showId}/settings
export type DancingMode = 'per_song' | 'interval' | 'activity' | 'disabled';

export interface ShowSettings {
  dancing_mode: DancingMode;
  dancing_cooldown_minutes: number;
  dancing_floor: number;
  dancing_cap: number;
  streak_mode?: 'per_round' | 'per_show' | 'disabled';
  score_compression?: boolean;
  leader_gap_alert?: number;
}

// 4. Live State (Public read, minimal traffic)
// Path: shows/{showId}/live/trivia
export type TriviaPhase = 'idle' | 'question' | 'answer';

export interface LiveTriviaState {
  activityId: string | null;
  phase: TriviaPhase;
  startedAt: number;      // Server timestamp
  durationSeconds: number;
  revealedWinnerUid?: string | null;
}

// Path: shows/{showId}/live/activity
export interface LiveActivityState {
  activityId: string | null;
  type: ActivityType;
  status: 'active' | 'ended';
  startedAt: number;
  currentMedian?: number;      // Dancing only
  prompt?: string;             // Participation activities
  slotsAvailable?: number;     // Participation activities
  fixedPoints?: number;        // Participation activities
}

// 4. User Response (Write only)
// Path: shows/{showId}/responses/{activityId}/{uid}
export interface UserResponse {
  optionIndex?: number; // For multi-choice
  text?: string | null; // For free text inputs
  booleanValue?: boolean; // For boolean inputs
  scaleValue?: number; // For sliding scale inputs
  answeredAt: number;   // Timestamp (ms since epoch)
  responseTime?: number; // Milliseconds elapsed since question start
  displayName: string;
}

// 5. User Score (Read only - calculated by Cloud Functions)
// Path: shows/{showId}/scores/{uid}
export interface UserScore {
  displayName: string;
  totalScore: number;
  correctCount: number;
  breakdown?: {
    trivia?: number;
    dancing?: number;
    participation?: number;
    starting_bonus?: number;
  };
  currentStreak?: number;
  tier?: string | null;
  lastAnsweredAt: number;
}

export interface LeaderboardEntry {
  uid: string;
  displayName: string;
  totalScore: number;
  tier?: string | null;
}

export interface ShowLeaderboard {
  updatedAt?: number;
  top?: LeaderboardEntry[];
}

export interface AllTimeLeaderboardEntry {
  member_id: string;
  display_name: string;
  stars: number;
  tier?: string | null;
}

export interface AllTimeLeaderboard {
  updatedAt?: number;
  top?: AllTimeLeaderboardEntry[];
}

export interface MemberProfile {
  display_name: string;
  email_hash?: string | null;
  created_at: number;
  auth_provider: string;
  stars: {
    total: number;
    tier: string;
    starting_bonus: number;
    breakdown: {
      shows_attended: number;
      trivia_participated: number;
      dancing_engaged: number;
      stage_participation: number;
      between_show_trivia: number;
      referrals: number;
      early_tickets: number;
      social_shares: number;
      feedback_given: number;
    };
    last_show_date?: string | null;
    decay_warning_sent?: boolean;
    decay_warning_sent_at?: number | null;
    total_stars_decayed?: number;
  };
  email_opt_in?: boolean;
  sms_opt_in?: boolean;
}

// 6. User Profile (User writes, app reads)
// Path: users/{uid}
export interface UserProfile {
  uid: string;
  displayName: string;
  email?: string;
  phone?: string;
  createdAt: number;
  lastSeenAt: number;
  showsAttended: string[]; // Array of show IDs
  preferences: {
    marketingEmails: boolean;
    marketingSMS: boolean;
    notifications: boolean;
  };
}

// ============================================
// TRIVIA LIBRARY (Between-Show Engagement)
// ============================================
// Path: trivia_library/

// Path: trivia_library/settings
export interface TriviaLibrarySettings {
  global_daily_limit: number;      // Max questions ANY user can answer per day
  default_user_limit: number;      // Default per-user daily limit
  timezone: string;                // For midnight reset (e.g., "Australia/Melbourne")
  star_daily_cap: number;          // Max stars earnable per day from trivia
  star_weekly_cap: number;         // Max stars earnable per week from trivia
  stars_per_threshold: number;     // Stars earned when threshold met (usually 1)
  star_threshold: number;          // Sum of star_values needed for 1 star (e.g., 3.0)
}

// Path: trivia_library/categories/{categoryId}
export interface TriviaLibraryCategory {
  name: string;
  description: string;
  icon: string;                    // Lucide icon name
  color: string;                   // Hex color for UI
  subcategories?: string[];        // Optional groupings
  question_count: number;          // Auto-updated count
  activity_count: number;
  created_at: number;
  updated_at: number;
}

// Question option structure
export interface TriviaQuestionOption {
  index: number;
  text: string;
}

// Path: trivia_library/questions/{questionId}
export type TriviaQuestionDifficulty = 'easy' | 'medium' | 'hard';

export interface TriviaLibraryQuestion {
  // Core fields
  category_id: string;
  subcategory?: string;
  type: 'multiple_choice';

  // Question content
  question: string;
  options: TriviaQuestionOption[];
  correct_index: number;

  // Metadata
  difficulty: TriviaQuestionDifficulty;
  star_value: number;              // Contribution toward star threshold (e.g., 1.0)
  image_url?: string | null;
  explanation?: string;            // Shown after answer

  // AI generation metadata (optional for seed data)
  created_at: number;
  created_by: string;              // "manual" or "ai_generator"
  model_used?: string;
  prompt_version?: string;

  // Usage stats
  times_served: number;
  times_correct: number;
  correct_rate: number;

  // Flags
  active: boolean;
  reviewed: boolean;
}

// Path: trivia_library/activities/{activityId}
export type TriviaActivityType = 'yes_no' | 'rating' | 'poll' | 'opinion';

export interface TriviaLibraryActivity {
  // Core fields
  category_id: string;
  subcategory?: string;
  type: TriviaActivityType;

  // Activity content
  question: string;
  options?: TriviaQuestionOption[];  // For yes_no, poll

  // For ratings
  rating_min?: number;
  rating_max?: number;
  rating_labels?: string[];

  // Metadata
  star_value: number;              // Participation = credit (e.g., 0.5)

  // Same metadata as questions
  created_at: number;
  created_by: string;
  active: boolean;
  times_served: number;
}

// Path: trivia_library/schedule/{date} (key format: "YYYY-MM-DD")
export interface TriviaLibrarySchedule {
  category_id: string;
  subcategory?: string;
  theme_name: string;
  description: string;
  priority: number;                // If multiple schedules, highest wins
}

// Path: trivia_library/usage/{userId}
export interface TriviaLibraryUsage {
  // Daily tracking (reset at midnight in configured timezone)
  questions_today: number;
  activities_today: number;
  last_activity_date: string;      // "YYYY-MM-DD" format

  // Star progress
  star_progress_today: number;     // Sum of star_values today
  stars_earned_today: number;      // Stars awarded today
  stars_earned_this_week: number;  // Stars awarded this week
  week_start_date: string;         // Monday of current week "YYYY-MM-DD"

  // History (avoid repeats)
  recent_questions: string[];      // Last N question IDs answered
  recent_activities: string[];     // Last N activity IDs completed

  // Lifetime stats
  total_questions_answered: number;
  total_correct: number;
  total_activities_completed: number;
  total_stars_from_engagement: number;
}
