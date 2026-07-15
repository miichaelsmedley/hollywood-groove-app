import { useEffect, useMemo, useState } from 'react';
import { onValue, ref } from 'firebase/database';
import { BarChart3, CalendarDays, ListMusic, Star, Trophy, Users } from 'lucide-react';
import { db } from '../lib/firebase';
import { useUser } from '../contexts/UserContext';
import { LiveSetState, UserScore } from '../types/firebaseContract';
import { Link, useSearchParams } from 'react-router-dom';
import { getShowPath, getTestShowPath } from '../lib/mode';
import { useMemberProfile } from '../hooks/useMemberProfile';
import TierBadge from '../components/leaderboard/TierBadge';
import { useActiveShows } from '../lib/showIndex';
import { useAuthUser } from '../features/auth/useAuthUser';
import { useTeamLeaderboard } from '../hooks/useTeamLeaderboard';
import { useUserTeam } from '../hooks/useUserTeam';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { useSetLeaderboard } from '../hooks/useSetLeaderboard';
import { useMySeasonPoints, useSeasonLeaderboard } from '../hooks/useSeasonLeaderboard';
import LeaderboardPanel from '../components/leaderboard/LeaderboardPanel';
import ScoringRulesPanel from '../components/show/ScoringRulesPanel';

type ScoreScope = 'tonight' | 'set' | 'season';
type TonightTab = 'players' | 'tables';

export default function Scores() {
  const { userProfile } = useUser();
  const { profile: memberProfile, isLoading: isMemberLoading } = useMemberProfile();
  const [searchParams] = useSearchParams();
  const isTestShow = searchParams.get('test') === 'true';
  const [myScore, setMyScore] = useState<UserScore | null>(null);
  const [mySetScore, setMySetScore] = useState<UserScore | null>(null);
  const [myScoreError, setMyScoreError] = useState<string | null>(null);
  const [isMyScoreLoading, setIsMyScoreLoading] = useState(false);
  const [scoreScope, setScoreScope] = useState<ScoreScope>('tonight');
  const [activeTab, setActiveTab] = useState<TonightTab>('players');
  const [liveSet, setLiveSet] = useState<LiveSetState | null>(null);
  const authUser = useAuthUser();
  const uid = authUser?.uid ?? null;

  const resolvePath = (showId: string, suffix?: string) => {
    return isTestShow ? getTestShowPath(showId, suffix) : getShowPath(showId, suffix);
  };

  const { shows: activeShows } = useActiveShows({
    includeProd: !isTestShow,
    includeTest: isTestShow,
  });
  const liveShowId = activeShows[0]?.showId ?? null;

  const selectedShowId = useMemo(() => {
    if (liveShowId) return liveShowId;
    const attended = userProfile?.showsAttended ?? [];
    return attended.length > 0 ? attended[attended.length - 1] : null;
  }, [liveShowId, userProfile?.showsAttended]);

  const currentSetNumber = liveSet?.number ?? null;
  const { team: userTeam } = useUserTeam({ isTestMode: isTestShow });
  const tonightLeaderboard = useLeaderboard(selectedShowId, uid, { isTestShow });
  const setLeaderboard = useSetLeaderboard(selectedShowId, currentSetNumber, uid, { isTestShow });
  const seasonLeaderboard = useSeasonLeaderboard(uid, { isTestShow });
  const mySeason = useMySeasonPoints(uid, { isTestShow });
  const {
    entries: tableEntries,
    loading: isTableLeaderboardLoading,
    error: tableLeaderboardError,
    updatedAt: tableLeaderboardUpdatedAt,
  } = useTeamLeaderboard(selectedShowId, { isTestShow });

  useEffect(() => {
    if (!selectedShowId) {
      setLiveSet(null);
      return;
    }
    const unsubscribe = onValue(ref(db, resolvePath(selectedShowId, 'live/set')), (snapshot) => {
      setLiveSet(snapshot.val() as LiveSetState | null);
    });
    return () => unsubscribe();
  }, [selectedShowId, isTestShow]);

  useEffect(() => {
    if (!selectedShowId || !uid) {
      setMyScore(null);
      setMyScoreError(null);
      setIsMyScoreLoading(false);
      return;
    }

    setIsMyScoreLoading(true);
    setMyScoreError(null);

    const scoreRef = ref(db, resolvePath(selectedShowId, `scores/${uid}`));
    const unsubscribe = onValue(
      scoreRef,
      (snapshot) => {
        setMyScore((snapshot.val() as UserScore | null) ?? null);
        setIsMyScoreLoading(false);
      },
      (err) => {
        setMyScore(null);
        setMyScoreError(err.message);
        setIsMyScoreLoading(false);
      }
    );

    return () => unsubscribe();
  }, [selectedShowId, uid, isTestShow]);

  useEffect(() => {
    if (!selectedShowId || !uid || !currentSetNumber) {
      setMySetScore(null);
      return;
    }

    const scoreRef = ref(db, resolvePath(selectedShowId, `set_scores/${currentSetNumber}/${uid}`));
    const unsubscribe = onValue(scoreRef, (snapshot) => {
      setMySetScore((snapshot.val() as UserScore | null) ?? null);
    });
    return () => unsubscribe();
  }, [currentSetNumber, selectedShowId, uid, isTestShow]);

  const renderMemberStars = () => {
    if (isMemberLoading) {
      return (
        <div className="bg-cinema-50 border border-cinema-200 rounded-2xl p-4 text-center text-cinema-500 text-sm">
          Loading your stars...
        </div>
      );
    }

    if (!memberProfile) {
      return null;
    }

    const stars = memberProfile.stars?.total ?? 0;
    const tier = memberProfile.stars?.tier ?? 'extra';
    const showsAttended = memberProfile.stars?.breakdown?.shows_attended ?? 0;

    return (
      <div className="bg-gradient-to-r from-amber-500/20 to-primary/20 border border-primary/40 rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
              <Star className="w-6 h-6 text-primary fill-primary" />
            </div>
            <div>
              <div className="text-sm font-semibold text-cinema-800">Your Stars</div>
              <div className="text-2xl font-bold text-primary">{stars.toLocaleString()}</div>
            </div>
          </div>
          <div className="text-right">
            <TierBadge tier={tier} />
            <div className="text-xs text-cinema-500 mt-1">{showsAttended} shows attended</div>
          </div>
        </div>
      </div>
    );
  };

  const renderTonightScore = () => {
    if (myScoreError) {
      return (
        <div className="bg-cinema-50 border border-cinema-200 rounded-2xl p-5">
          <p className="text-accent-red font-semibold">Can’t load your score</p>
          <p className="text-cinema-500 text-sm mt-1">{myScoreError}</p>
        </div>
      );
    }

    if (isMyScoreLoading) {
      return (
        <div className="bg-cinema-50 border border-cinema-200 rounded-2xl p-4 text-center text-cinema-500 text-sm">
          Loading your score...
        </div>
      );
    }

    if (!myScore) {
      return (
        <div className="bg-cinema-50 border border-cinema-200 rounded-2xl p-4 text-center text-cinema-500 text-sm">
          No score yet. Answer trivia to appear here.
        </div>
      );
    }

    return (
      <ScoreSummaryCard
        label="Tonight"
        score={myScore.totalScore}
        detail={`${myScore.correctCount} correct`}
        subdetail={myScore.lastAnsweredAt ? `Last ${new Date(myScore.lastAnsweredAt).toLocaleTimeString()}` : 'Waiting for your next answer'}
      />
    );
  };

  const renderSetScore = () => {
    if (!currentSetNumber) {
      return (
        <div className="bg-cinema-50 border border-cinema-200 rounded-2xl p-4 text-center text-cinema-500 text-sm">
          No active set yet.
        </div>
      );
    }

    return (
      <ScoreSummaryCard
        label={`Set ${currentSetNumber}`}
        score={mySetScore?.totalScore ?? 0}
        detail={liveSet?.name ?? 'This set'}
        subdetail={mySetScore ? `${mySetScore.correctCount ?? 0} correct this set` : 'No set points yet'}
      />
    );
  };

  const renderSeasonScore = () => {
    return (
      <ScoreSummaryCard
        label={`Season ${mySeason.seasonId}`}
        score={mySeason.points}
        detail="Season points"
        subdetail="Night total + 200 attendance points after each show"
      />
    );
  };

  const renderTableLeaderboard = () => {
    if (!selectedShowId) {
      return (
        <div className="bg-cinema-50 border border-cinema-200 rounded-2xl p-6 text-center">
          <p className="text-cinema-500 text-sm">No show selected yet.</p>
        </div>
      );
    }

    if (isTableLeaderboardLoading) {
      return (
        <div className="bg-cinema-50 border border-cinema-200 rounded-2xl p-6 text-center">
          <div className="flex items-center justify-center gap-2 text-cinema-500">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
            <span className="text-sm">Loading Tables...</span>
          </div>
        </div>
      );
    }

    if (tableLeaderboardError) {
      return (
        <div className="bg-cinema-50 border border-cinema-200 rounded-2xl p-6 text-center">
          <p className="text-accent-red font-semibold">Can’t load Tables</p>
          <p className="text-cinema-500 text-sm mt-1">{tableLeaderboardError.message}</p>
        </div>
      );
    }

    if (tableEntries.length === 0) {
      return (
        <div className="bg-cinema-50 border border-cinema-200 rounded-2xl p-6 text-center">
          <p className="text-cinema-500 text-sm">No Tables scores yet. Join a Table and answer trivia to appear here.</p>
        </div>
      );
    }

    return (
      <div className="bg-cinema-50 border border-cinema-200 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-cinema-200 flex items-center justify-between text-sm font-semibold text-cinema-800">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            <span>Tables leaderboard</span>
          </div>
          {tableLeaderboardUpdatedAt ? (
            <span className="text-xs text-cinema-500">
              Updated {new Date(tableLeaderboardUpdatedAt).toLocaleTimeString()}
            </span>
          ) : null}
        </div>
        <ol className="divide-y divide-cinema-200">
          {tableEntries.map((entry, index) => {
            const rank = entry.rank ?? index + 1;
            const isCurrentTable = entry.team_id === userTeam?.team_id;
            return (
              <li
                key={entry.team_id}
                className={[
                  'flex items-center justify-between gap-3 px-4 py-3',
                  isCurrentTable ? 'bg-primary/10' : '',
                ].join(' ')}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-8 text-sm text-cinema-500 text-center">{rank}</span>
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{entry.team_name || 'Unnamed Table'}</div>
                    <div className="text-xs text-cinema-500">
                      {entry.member_count} {entry.member_count === 1 ? 'player' : 'players'}
                    </div>
                  </div>
                </div>
                <span className="font-bold tabular-nums whitespace-nowrap">
                  {entry.combined_score.toLocaleString()} pts
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    );
  };

  const renderScopeContent = () => {
    if (scoreScope === 'season') {
      return (
        <>
          {renderSeasonScore()}
          <LeaderboardPanel
            title={`Season ${seasonLeaderboard.seasonId}`}
            entries={seasonLeaderboard.entries.map((entry) => ({
              uid: entry.uid,
              displayName: entry.displayName,
              score: entry.seasonPoints,
              tier: entry.tier,
            }))}
            currentUserId={uid}
            updatedAt={seasonLeaderboard.updatedAt}
            isLoading={seasonLeaderboard.isLoading}
            error={seasonLeaderboard.error}
            emptyText="No season points yet. They appear after a show closes."
            scoreSuffix="pts"
            icon={CalendarDays}
          />
        </>
      );
    }

    if (scoreScope === 'set') {
      return (
        <>
          {renderSetScore()}
          <LeaderboardPanel
            title={currentSetNumber ? `Set ${currentSetNumber} leaderboard` : 'This Set'}
            entries={setLeaderboard.entries.map((entry) => ({
              uid: entry.uid,
              displayName: entry.displayName,
              score: entry.totalScore,
              tier: entry.tier,
            }))}
            currentUserId={uid}
            updatedAt={setLeaderboard.updatedAt}
            isLoading={Boolean(currentSetNumber) && setLeaderboard.isLoading}
            error={setLeaderboard.error}
            emptyText={currentSetNumber ? 'No set scores yet.' : 'No active set yet.'}
            icon={ListMusic}
          />
        </>
      );
    }

    return (
      <>
        {renderTonightScore()}
        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-cinema-50 border border-cinema-200 p-1">
          <ScopeButton active={activeTab === 'players'} onClick={() => setActiveTab('players')}>
            Players
          </ScopeButton>
          <ScopeButton active={activeTab === 'tables'} onClick={() => setActiveTab('tables')}>
            Tables
          </ScopeButton>
        </div>

        {activeTab === 'players' ? (
          <LeaderboardPanel
            title="Tonight leaderboard"
            entries={tonightLeaderboard.entries.map((entry) => ({
              uid: entry.uid,
              displayName: entry.displayName,
              score: entry.totalScore,
              tier: entry.tier,
            }))}
            currentUserId={uid}
            updatedAt={tonightLeaderboard.updatedAt}
            isLoading={tonightLeaderboard.isLoading}
            error={tonightLeaderboard.error}
            emptyText="No scores yet. Answer trivia to appear here."
          />
        ) : (
          renderTableLeaderboard()
        )}
      </>
    );
  };

  if (!selectedShowId) {
    return (
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-cinema-50 border border-cinema-200 flex items-center justify-center mx-auto">
            <BarChart3 className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Scores</h1>
          <p className="text-cinema-500 text-sm">Join a show to start earning points.</p>
        </div>

        {renderMemberStars()}
        <ScoringRulesPanel />

        <Link to={isTestShow ? '/join?test=true' : '/join'} className="block w-full btn-primary text-center">
          Join current show
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Scores</h1>
          <p className="text-cinema-500 text-sm">
            {liveShowId ? 'Live show' : 'Last attended show'} - Show #{selectedShowId}
          </p>
        </div>
        <Trophy className="w-6 h-6 text-primary" />
      </div>

      {renderMemberStars()}
      <ScoringRulesPanel />

      <div className="grid grid-cols-3 gap-1 rounded-2xl bg-cinema-50 border border-cinema-200 p-1">
        <ScopeButton active={scoreScope === 'tonight'} onClick={() => setScoreScope('tonight')}>
          Tonight
        </ScopeButton>
        <ScopeButton active={scoreScope === 'set'} onClick={() => setScoreScope('set')}>
          This Set
        </ScopeButton>
        <ScopeButton active={scoreScope === 'season'} onClick={() => setScoreScope('season')}>
          Season
        </ScopeButton>
      </div>

      {renderScopeContent()}
    </div>
  );
}

function ScopeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-2 py-2 text-sm font-semibold transition-colors cursor-pointer ${
        active
          ? 'bg-primary text-cinema shadow-glow'
          : 'text-cinema-600 hover:text-cinema-900'
      }`}
    >
      {children}
    </button>
  );
}

function ScoreSummaryCard({
  label,
  score,
  detail,
  subdetail,
}: {
  label: string;
  score: number;
  detail: string;
  subdetail: string;
}) {
  return (
    <div className="bg-primary/15 border border-primary/40 rounded-2xl p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-cinema-800">{label}</div>
          <div className="text-2xl font-bold">{score.toLocaleString()} pts</div>
        </div>
        <div className="text-right text-xs text-cinema-500">
          <div>{detail}</div>
          <div>{subdetail}</div>
        </div>
      </div>
    </div>
  );
}
