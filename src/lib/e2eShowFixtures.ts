import type {
  CrowdActivity,
  LiveActivityState,
  LiveTriviaState,
  MemberTeamInfo,
  ShowLeaderboard,
  TeamLeaderboard,
  TeamShowScore,
  UserScore,
  UserTriviaResult,
} from '../types/firebaseContract';

declare global {
  interface Window {
    __HG_LAST_RESPONSE__?: {
      path: string;
      payload: unknown;
    };
  }
}

export const E2E_FIXTURES_ENABLED = import.meta.env.VITE_ENABLE_E2E_FIXTURES === 'true';

export type E2EUser = {
  uid: string;
  displayName: string;
};

export type TriviaFixture = {
  live: LiveTriviaState;
  activity: CrowdActivity | null;
  score: UserScore;
  user: E2EUser;
  result?: UserTriviaResult | null;
  leaderboard?: ShowLeaderboard;
  team?: MemberTeamInfo;
  teamScore?: TeamShowScore;
  teamLeaderboard?: TeamLeaderboard;
};

export type ActivityFixture = {
  live: LiveActivityState;
  activity: CrowdActivity;
  user: E2EUser;
};

const fixtureUser: E2EUser = {
  uid: 'e2e-user',
  displayName: 'Fixture Fan',
};

function liveTrivia(activityId: string): LiveTriviaState {
  return {
    activityId,
    phase: 'question',
    startedAt: Date.now() - 1_000,
    durationSeconds: 30,
  };
}

function answerTrivia(activityId: string): LiveTriviaState {
  return {
    activityId,
    phase: 'answer',
    startedAt: Date.now() - 30_000,
    durationSeconds: 30,
    revealedCorrectAnswer: 'Queen',
    revealedWinnerUid: 'sarah',
  };
}

function score(): UserScore {
  return {
    displayName: fixtureUser.displayName,
    totalScore: 120,
    correctCount: 2,
    lastAnsweredAt: Date.now() - 10_000,
  };
}

function leaderboard(): ShowLeaderboard {
  return {
    updatedAt: Date.now(),
    top: [
      { uid: 'sarah', displayName: 'Sarah', totalScore: 180 },
      { uid: 'mick', displayName: 'Mick', totalScore: 155 },
      { uid: fixtureUser.uid, displayName: fixtureUser.displayName, totalScore: 120 },
      { uid: 'alex', displayName: 'Alex', totalScore: 90 },
    ],
  };
}

function fixtureTeam(): MemberTeamInfo {
  return {
    team_id: 'table-9',
    team_name: 'Table 9',
    joined_at: Date.now() - 120_000,
    role: 'member',
  };
}

function fixtureTeamScore(): TeamShowScore {
  return {
    team_name: 'Table 9',
    combined_score: 1240,
    member_scores: {
      [fixtureUser.uid]: { display_name: fixtureUser.displayName, score: 120 },
      sarah: { display_name: 'Sarah', score: 180 },
    },
    contributing_members: [fixtureUser.uid, 'sarah'],
    updated_at: Date.now(),
  };
}

function teamLeaderboard(): TeamLeaderboard {
  return {
    updated_at: Date.now(),
    top: [
      { team_id: 'table-2', team_name: 'Table 2', combined_score: 1380, member_count: 5, rank: 1 },
      { team_id: 'table-4', team_name: 'Table 4', combined_score: 1300, member_count: 4, rank: 2 },
      { team_id: 'table-9', team_name: 'Table 9', combined_score: 1240, member_count: 6, rank: 3 },
    ],
  };
}

export function getTriviaFixture(name: string | null): TriviaFixture | null {
  if (!E2E_FIXTURES_ENABLED || !name) return null;

  const base = {
    score: score(),
    user: fixtureUser,
    leaderboard: leaderboard(),
    team: fixtureTeam(),
    teamScore: fixtureTeamScore(),
    teamLeaderboard: teamLeaderboard(),
  };

  switch (name) {
    case 'idle':
      return {
        ...base,
        live: {
          activityId: null,
          phase: 'idle',
          startedAt: Date.now(),
          durationSeconds: 0,
        },
        activity: null,
      };
    case 'answer':
      return {
        ...base,
        live: answerTrivia('fixture-trivia-answer'),
        result: {
          isCorrect: true,
          baseScore: 100,
          speedBonus: 52,
          streakMultiplier: 1,
          totalScore: 152,
          answeredAt: Date.now() - 15_000,
        },
        activity: {
          type: 'trivia',
          title: 'Opening Question',
          trivia: {
            question: 'Which band sang Bohemian Rhapsody?',
            kind: 'multi',
            options: [
              { index: 0, text: 'Queen' },
              { index: 1, text: 'Adele' },
              { index: 2, text: 'INXS' },
            ],
          },
        },
      };
    case 'answer-winner':
      return {
        ...base,
        live: {
          ...answerTrivia('fixture-trivia-answer-winner'),
          revealedWinnerUid: fixtureUser.uid,
        },
        result: {
          isCorrect: true,
          baseScore: 100,
          speedBonus: 52,
          streakMultiplier: 1,
          totalScore: 152,
          answeredAt: Date.now() - 15_000,
        },
        activity: {
          type: 'trivia',
          title: 'Opening Question',
          trivia: {
            question: 'Which band sang Bohemian Rhapsody?',
            kind: 'multi',
            options: [
              { index: 0, text: 'Queen' },
              { index: 1, text: 'Adele' },
              { index: 2, text: 'INXS' },
            ],
          },
        },
      };
    case 'multi':
      return {
        ...base,
        live: liveTrivia('fixture-trivia-multi'),
        activity: {
          type: 'trivia',
          title: 'Opening Question',
          trivia: {
            question: 'Which band sang Bohemian Rhapsody?',
            kind: 'multi',
            options: [
              { index: 0, text: 'Queen' },
              { index: 1, text: 'Adele' },
              { index: 2, text: 'INXS' },
            ],
          },
        },
      };
    case 'boolean':
      return {
        ...base,
        live: liveTrivia('fixture-trivia-boolean'),
        activity: {
          type: 'trivia',
          title: 'True Or False',
          trivia: {
            question: 'Hollywood Groove plays live crowd games.',
            kind: 'boolean',
            options: [
              { index: 0, text: 'True' },
              { index: 1, text: 'False' },
            ],
          },
        },
      };
    case 'freeform':
      return {
        ...base,
        live: liveTrivia('fixture-trivia-freeform'),
        activity: {
          type: 'trivia',
          title: 'Singer Question',
          trivia: {
            question: 'Who was the lead singer of Queen?',
            kind: 'freeform',
          },
        },
      };
    case 'scale':
      return {
        ...base,
        live: liveTrivia('fixture-trivia-scale'),
        activity: {
          type: 'trivia',
          title: 'Crowd Rating',
          trivia: {
            question: 'Rate the guitar solo.',
            kind: 'scale',
            scale: { min: 0, max: 10, step: 1 },
          },
        },
      };
    default:
      return null;
  }
}

export function getActivityFixture(name: string | null): ActivityFixture | null {
  if (!E2E_FIXTURES_ENABLED || !name) return null;

  const activityId = `fixture-activity-${name}`;
  const base = {
    live: {
      activityId,
      type: name as LiveActivityState['type'],
      status: 'active' as const,
      startedAt: Date.now() - 1_000,
      currentMedian: name === 'dancing' ? 75 : undefined,
    },
    user: fixtureUser,
  };

  if (name === 'vote') {
    return {
      ...base,
      activity: {
        type: 'vote',
        title: 'Choose The Encore',
        prompt: 'Pick the song to close the set.',
        options: [
          { index: 0, text: 'Dancing Queen' },
          { index: 1, text: 'Sweet Caroline' },
        ],
      },
    };
  }

  if (name === 'dancing') {
    return {
      ...base,
      activity: {
        type: 'dancing',
        title: 'Dance Floor Bonus',
        description: 'Claim points while the floor is open.',
        dancing: { prompt: 'Get on the floor.' },
      },
    };
  }

  const joinTypes = new Set([
    'sing_signup',
    'backup_singer',
    'stage_participation',
    'costume_contest',
    'competition',
    'raffle',
  ]);
  if (!joinTypes.has(name)) {
    return null;
  }

  return {
    ...base,
    activity: {
      type: name as CrowdActivity['type'],
      title: name.replace(/_/g, ' '),
      description: 'Join this activity.',
      maxParticipants: 4,
    },
  };
}

export async function recordE2EResponse(path: string, payload: unknown): Promise<void> {
  if (!E2E_FIXTURES_ENABLED) return;
  window.__HG_LAST_RESPONSE__ = { path, payload };
}
