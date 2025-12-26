import { useEffect, useMemo, useState } from 'react';
import { onValue, ref } from 'firebase/database';
import { BarChart3, Trophy } from 'lucide-react';
import { auth, db, rtdbPath } from '../lib/firebase';
import { useUser } from '../contexts/UserContext';
import { UserScore } from '../types/firebaseContract';
import { Link } from 'react-router-dom';

interface ScoresState {
  loading: boolean;
  error: string | null;
  scores: Record<string, UserScore> | null;
}

export default function Scores() {
  const { userProfile } = useUser();
  const [liveShowId, setLiveShowId] = useState<string | null>(null);
  const [scoresState, setScoresState] = useState<ScoresState>({
    loading: true,
    error: null,
    scores: null,
  });

  useEffect(() => {
    const showsRef = ref(db, rtdbPath('shows'));
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
          if (!phase || phase === 'idle') return [];
          const startedAt = typeof liveTrivia?.startedAt === 'number' ? liveTrivia.startedAt : 0;
          return [{ showId, startedAt }];
        });

        live.sort((a, b) => b.startedAt - a.startedAt);
        setLiveShowId(live[0]?.showId ?? null);
      },
      () => {
        setLiveShowId(null);
      }
    );

    return () => unsubscribe();
  }, []);

  const selectedShowId = useMemo(() => {
    if (liveShowId) return liveShowId;
    const attended = userProfile?.showsAttended ?? [];
    return attended.length > 0 ? attended[attended.length - 1] : null;
  }, [liveShowId, userProfile?.showsAttended]);

  useEffect(() => {
    if (!selectedShowId) {
      setScoresState({ loading: false, error: null, scores: null });
      return;
    }

    setScoresState((current) => ({ ...current, loading: true, error: null }));

    const scoresRef = ref(db, rtdbPath(`shows/${selectedShowId}/scores`));
    const unsubscribe = onValue(
      scoresRef,
      (snapshot) => {
        setScoresState({
          loading: false,
          error: null,
          scores: (snapshot.val() as Record<string, UserScore> | null) ?? null,
        });
      },
      (err) => {
        setScoresState({
          loading: false,
          error: err.message,
          scores: null,
        });
      }
    );

    return () => unsubscribe();
  }, [selectedShowId]);

  const uid = auth.currentUser?.uid ?? null;
  const scoresList = useMemo(() => {
    const scores = scoresState.scores;
    if (!scores) return [];
    return Object.entries(scores)
      .map(([scoreUid, score]) => ({ uid: scoreUid, ...score }))
      .sort((a, b) => b.totalScore - a.totalScore);
  }, [scoresState.scores]);

  const myEntry = useMemo(() => {
    if (!uid) return null;
    return scoresList.find((entry) => entry.uid === uid) ?? null;
  }, [scoresList, uid]);

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

        <Link to="/join" className="block w-full btn-primary text-center">
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

      {scoresState.loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="text-cinema-500 font-medium">Loading scores…</p>
          </div>
        </div>
      ) : scoresState.error ? (
        <div className="bg-cinema-50 border border-cinema-200 rounded-2xl p-5">
          <p className="text-accent-red font-semibold">Can’t load scores</p>
          <p className="text-cinema-500 text-sm mt-1">{scoresState.error}</p>
        </div>
      ) : scoresList.length === 0 ? (
        <div className="bg-cinema-50 border border-cinema-200 rounded-2xl p-6 text-center">
          <p className="text-cinema-500 text-sm">No scores yet. Answer trivia to appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {myEntry && (
            <div className="bg-primary/15 border border-primary/40 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-cinema-800">You</div>
                  <div className="text-lg font-bold">{myEntry.totalScore.toLocaleString()} pts</div>
                </div>
                <div className="text-right text-xs text-cinema-500">
                  <div>{myEntry.correctCount} correct</div>
                  <div>Last: {new Date(myEntry.lastAnsweredAt).toLocaleTimeString()}</div>
                </div>
              </div>
            </div>
          )}

          <div className="bg-cinema-50 border border-cinema-200 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-cinema-200 text-sm font-semibold text-cinema-800">
              Top scores
            </div>
            <ol className="divide-y divide-cinema-200">
              {scoresList.slice(0, 20).map((entry, index) => (
                <li
                  key={entry.uid}
                  className={[
                    'flex items-center justify-between px-4 py-3',
                    entry.uid === uid ? 'bg-primary/10' : '',
                  ].join(' ')}
                >
                  <div className="flex items-baseline gap-3 min-w-0">
                    <span className="w-6 text-sm text-cinema-500">{index + 1}</span>
                    <span className="truncate font-semibold">{entry.displayName || 'Anonymous'}</span>
                  </div>
                  <span className="font-bold tabular-nums">{entry.totalScore.toLocaleString()}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}

