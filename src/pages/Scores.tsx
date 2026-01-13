import { useEffect, useMemo, useState } from 'react';
import { onValue, ref } from 'firebase/database';
import { BarChart3, Trophy } from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { useUser } from '../contexts/UserContext';
import { UserScore } from '../types/firebaseContract';
import { Link, useSearchParams } from 'react-router-dom';
import Leaderboard from '../components/leaderboard/Leaderboard';
import { getShowBasePath, getShowPath, getTestShowBasePath, getTestShowPath } from '../lib/mode';

export default function Scores() {
  const { userProfile } = useUser();
  const [searchParams] = useSearchParams();
  const isTestShow = searchParams.get('test') === 'true';
  const [liveShowId, setLiveShowId] = useState<string | null>(null);
  const [myScore, setMyScore] = useState<UserScore | null>(null);
  const [myScoreError, setMyScoreError] = useState<string | null>(null);
  const [isMyScoreLoading, setIsMyScoreLoading] = useState(false);
  const uid = auth.currentUser?.uid ?? null;

  // Helper to get the correct path based on test mode
  const resolvePath = (showId: string, suffix?: string) => {
    return isTestShow ? getTestShowPath(showId, suffix) : getShowPath(showId, suffix);
  };

  useEffect(() => {
    // Check both production and test shows for live activity
    const basePath = isTestShow ? getTestShowBasePath() : getShowBasePath();
    const showsRef = ref(db, basePath);
    const unsubscribe = onValue(
      showsRef,
      (snapshot) => {
        const data = snapshot.val();
        if (!data) {
          setLiveShowId(null);
          return;
        }

        const live = Object.entries(data).flatMap(([showId, showData]: [string, any]) => {
          const liveTrivia = showData?.live?.trivia;
          const phase = liveTrivia?.phase as string | undefined;
          const triviaActive = Boolean(phase && phase !== 'idle');
          const triviaStartedAt = typeof liveTrivia?.startedAt === 'number' ? liveTrivia.startedAt : 0;

          const liveActivity = showData?.live?.activity;
          const activityActive = liveActivity?.status === 'active';
          const activityStartedAt = typeof liveActivity?.startedAt === 'number' ? liveActivity.startedAt : 0;

          if (!triviaActive && !activityActive) return [];

          return [
            {
              showId,
              startedAt: Math.max(
                triviaActive ? triviaStartedAt : 0,
                activityActive ? activityStartedAt : 0
              ),
            },
          ];
        });

        live.sort((a, b) => b.startedAt - a.startedAt);
        setLiveShowId(live[0]?.showId ?? null);
      },
      () => {
        setLiveShowId(null);
      }
    );

    return () => unsubscribe();
  }, [isTestShow]);

  const selectedShowId = useMemo(() => {
    if (liveShowId) return liveShowId;
    const attended = userProfile?.showsAttended ?? [];
    return attended.length > 0 ? attended[attended.length - 1] : null;
  }, [liveShowId, userProfile?.showsAttended]);

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
            {liveShowId ? 'Live show' : 'Last attended show'} • Show #{selectedShowId}
          </p>
        </div>
        <Trophy className="w-6 h-6 text-primary" />
      </div>

      {myScoreError && (
        <div className="bg-cinema-50 border border-cinema-200 rounded-2xl p-5">
          <p className="text-accent-red font-semibold">Can’t load your score</p>
          <p className="text-cinema-500 text-sm mt-1">{myScoreError}</p>
        </div>
      )}

      {isMyScoreLoading ? (
        <div className="bg-cinema-50 border border-cinema-200 rounded-2xl p-4 text-center text-cinema-500 text-sm">
          Loading your score...
        </div>
      ) : myScore ? (
        <div className="bg-primary/15 border border-primary/40 rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-cinema-800">You</div>
              <div className="text-lg font-bold">{myScore.totalScore.toLocaleString()} pts</div>
            </div>
            <div className="text-right text-xs text-cinema-500">
              <div>{myScore.correctCount} correct</div>
              <div>
                Last:{' '}
                {myScore.lastAnsweredAt
                  ? new Date(myScore.lastAnsweredAt).toLocaleTimeString()
                  : '—'}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-cinema-50 border border-cinema-200 rounded-2xl p-4 text-center text-cinema-500 text-sm">
          No score yet. Answer trivia to appear here.
        </div>
      )}

      <Leaderboard showId={selectedShowId} currentUserId={uid} isTestShow={isTestShow} />
    </div>
  );
}
