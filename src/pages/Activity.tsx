import { useEffect, useState, useMemo, useRef } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { onValue, ref, set } from 'firebase/database';
import { CalendarCheck, ArrowLeft, Users } from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { CrowdActivity, LiveActivityState } from '../types/firebaseContract';
import ActionBar from '../components/show/ActionBar';
import CallupInlineNotice from '../components/show/CallupInlineNotice';
import { getShowPath, getTestShowPath } from '../lib/mode';
import { getActivityFixture, recordE2EResponse, type E2EUser } from '../lib/e2eShowFixtures';
import { useDanceCooldown, useShow } from '../contexts/ShowContext';

export default function Activity() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const [liveActivity, setLiveActivity] = useState<LiveActivityState | null>(null);
  const [activity, setActivity] = useState<CrowdActivity | null>(null);
  const [hasResponded, setHasResponded] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const activeActivityIdRef = useRef<string | null>(null);
  const { claimDancePoints: claimDancePointsFromContext } = useShow();
  const { canClaimDance } = useDanceCooldown();
  const fixtureName = searchParams.get('fixture');
  const activityFixture = useMemo(() => getActivityFixture(fixtureName), [fixtureName]);

  // Check if this is a test show via query param
  const isTestShow = searchParams.get('test') === 'true';

  // Helper to get the correct path based on whether it's a test show
  const getPath = useMemo(() => {
    return (showId: string, suffix?: string) => {
      return isTestShow ? getTestShowPath(showId, suffix) : getShowPath(showId, suffix);
    };
  }, [isTestShow]);

  useEffect(() => {
    if (!id) return;

    if (activityFixture) {
      const nextActivityId = activityFixture.live.activityId ?? null;
      if (nextActivityId !== activeActivityIdRef.current) {
        setHasResponded(false);
        setSelectedOption(null);
        activeActivityIdRef.current = nextActivityId;
      }
      setLiveActivity(activityFixture.live);
      setActivity(activityFixture.activity);
      return () => {
        activeActivityIdRef.current = null;
      };
    }

    const unsubscribe = onValue(
      ref(db, getPath(id, 'live/activity')),
      (snapshot) => {
        const state = snapshot.val() as LiveActivityState | null;
        const nextActivityId = state?.activityId ?? null;
        if (nextActivityId !== activeActivityIdRef.current) {
          setHasResponded(false);
          setSelectedOption(null);
          activeActivityIdRef.current = nextActivityId;
        }
        setLiveActivity(state);
      }
    );

    return () => {
      unsubscribe();
      activeActivityIdRef.current = null;
    };
  }, [id, getPath, activityFixture]);

  useEffect(() => {
    if (activityFixture) return;
    if (!id || !liveActivity?.activityId) {
      setActivity(null);
      return;
    }

    const activityRef = ref(db, getPath(id, `activities/${liveActivity.activityId}`));
    const unsubscribe = onValue(activityRef, (snapshot) => {
      setActivity(snapshot.val() as CrowdActivity | null);
    });

    return () => unsubscribe();
  }, [id, liveActivity?.activityId, getPath, activityFixture]);

  const getResponseUser = (): E2EUser | null => {
    if (activityFixture) return activityFixture.user;
    const user = auth.currentUser;
    return user
      ? {
          uid: user.uid,
          displayName: user.displayName || 'Anonymous',
        }
      : null;
  };

  const writeActivityResponse = async (uid: string, payload: Record<string, unknown>) => {
    if (!id || !liveActivity?.activityId) return;
    const path = getPath(id, `responses/${liveActivity.activityId}/${uid}`);
    if (activityFixture) {
      await recordE2EResponse(path, payload);
      return;
    }
    await set(ref(db, path), payload);
  };

  const joinActivity = async () => {
    const user = getResponseUser();
    if (!id || !liveActivity?.activityId || !user) return;

    try {
      await writeActivityResponse(user.uid, {
        action: 'join',
        joinedAt: Date.now(),
        displayName: user.displayName,
      });
      setHasResponded(true);
    } catch (error) {
      console.error('Failed to join activity:', error);
    }
  };

  const handleDanceClaim = async () => {
    const user = getResponseUser();
    if (!id || !liveActivity?.activityId || !user) return;

    try {
      if (activityFixture) {
        await writeActivityResponse(user.uid, {
          type: 'dance_claim',
          claimedAt: Date.now(),
          displayName: user.displayName,
        });
        setHasResponded(true);
        return;
      }

      const claimed = await claimDancePointsFromContext();
      if (claimed) {
        setHasResponded(true);
      }
    } catch (error) {
      console.error('Failed to claim dance points:', error);
    }
  };

  const voteOption = async (optionIndex: number, optionText: string) => {
    const user = getResponseUser();
    if (!id || !liveActivity?.activityId || !user) return;

    try {
      await writeActivityResponse(user.uid, {
        optionIndex,
        optionText,
        votedAt: Date.now(),
        displayName: user.displayName,
      });
      setSelectedOption(optionIndex);
      setHasResponded(true);
    } catch (error) {
      console.error('Failed to submit vote:', error);
    }
  };

  const isLive = liveActivity?.status === 'active';
  const options = Array.isArray(activity?.options) ? activity?.options : [];
  const dancingPrompt = activity?.dancing?.prompt;
  const prompt = dancingPrompt || activity?.prompt || activity?.description || activity?.title || 'Join the activity';
  const isDancing = liveActivity?.type === 'dancing' || activity?.type === 'dancing';
  const currentMedian = typeof liveActivity?.currentMedian === 'number'
    ? liveActivity.currentMedian
    : typeof activity?.dancing?.current_median === 'number'
      ? activity.dancing.current_median
      : null;
  const hasMedian = typeof currentMedian === 'number';

  if (!isLive || !liveActivity) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 pb-40">
          <Link
            to={`/shows/${id}${isTestShow ? '?test=true' : ''}`}
            className="inline-flex items-center space-x-2 text-gray-400 hover:text-gray-100 transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Show</span>
          </Link>

          <div className="max-w-2xl mx-auto text-center py-8">
            <CalendarCheck className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <h2 className="text-xl font-bold mb-2">No Active Activity</h2>
            <p className="text-gray-400 text-sm">
              Check back when the DJ starts a crowd activity.
            </p>
          </div>
        </div>
        {/* Sticky ActionBar at bottom */}
        <div className="fixed bottom-0 left-0 right-0 z-50">
          <ActionBar />
        </div>
      </div>
    );
  }

  if (!activity) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 pb-40">
          <Link
            to={`/shows/${id}${isTestShow ? '?test=true' : ''}`}
            className="inline-flex items-center space-x-2 text-gray-400 hover:text-gray-100 transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Show</span>
          </Link>
          <div className="max-w-2xl mx-auto text-center py-8">
            <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <h2 className="text-xl font-bold mb-2">Loading Activity</h2>
            <p className="text-gray-400 text-sm">Fetching the activity details...</p>
          </div>
        </div>
        {/* Sticky ActionBar at bottom */}
        <div className="fixed bottom-0 left-0 right-0 z-50">
          <ActionBar />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      <div className="flex-1 overflow-y-auto p-4 pb-40">
        <div className="max-w-lg mx-auto space-y-4">
          <Link
            to={`/shows/${id}${isTestShow ? '?test=true' : ''}`}
            className="inline-flex items-center space-x-2 text-gray-400 hover:text-gray-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back to Show</span>
          </Link>

          <div className="bg-cinema-900/60 border border-cinema-700 rounded-xl p-4 space-y-3">
            <div className="text-[10px] uppercase tracking-[0.2em] text-cinema-400">Live Activity</div>
            <h1 className="text-xl font-bold">{activity.title}</h1>
            <p className="text-cinema-300 text-sm">{prompt}</p>

            {activity.prize && (
              <div className="text-xs text-amber-300 font-semibold">Prize: {activity.prize}</div>
            )}

            {activity.maxParticipants && (
              <div className="text-xs text-cinema-400">Spots: {activity.maxParticipants}</div>
            )}
          </div>

          <CallupInlineNotice activityId={liveActivity.activityId} />

          {isDancing ? (
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleDanceClaim}
                className="w-full py-3 px-4 rounded-lg bg-primary/20 border border-primary text-primary font-semibold text-sm hover:bg-primary/30 transition-all active:scale-[0.98] disabled:opacity-50"
                disabled={hasResponded || (!activityFixture && !canClaimDance)}
              >
                {hasResponded
                  ? 'Claimed!'
                  : !activityFixture && !canClaimDance
                    ? 'Dance claim cooling down'
                  : hasMedian
                    ? `Claim ${currentMedian} pts`
                    : 'Claim dance points'}
              </button>
              {hasResponded && (
                <div className="text-xs text-primary font-semibold text-center">You are locked in.</div>
              )}
              {!hasResponded && (
                <div className="text-xs text-cinema-400 text-center">
                  Get on the floor to earn points.
                </div>
              )}
            </div>
          ) : activity.type === 'vote' && options.length > 0 ? (
            <div className="space-y-2">
              {options.map((option) => (
                <button
                  key={option.index}
                  type="button"
                  onClick={() => voteOption(option.index, option.text)}
                  className={[
                    'w-full text-left px-4 py-3 rounded-lg border transition text-sm',
                    selectedOption === option.index
                      ? 'border-primary/70 bg-primary/20'
                      : 'border-cinema-700 bg-cinema-900/60 hover:border-primary/40',
                  ].join(' ')}
                  disabled={hasResponded}
                >
                  <div className="font-semibold">{option.text}</div>
                </button>
              ))}
              {hasResponded && (
                <div className="text-xs text-primary font-semibold text-center">Thanks for voting!</div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <button
                type="button"
                onClick={joinActivity}
                className="w-full py-3 px-4 rounded-lg bg-accent-green/20 border border-accent-green text-accent-green font-semibold text-sm hover:bg-accent-green/30 transition-all active:scale-[0.98] disabled:opacity-50"
                disabled={hasResponded}
              >
                {hasResponded ? 'You are in!' : 'Join Activity'}
              </button>
              {hasResponded && (
                <div className="text-xs text-accent-green font-semibold text-center">You are locked in.</div>
              )}
            </div>
          )}
        </div>
      </div>
      {/* Sticky ActionBar at bottom */}
      <div className="fixed bottom-0 left-0 right-0 z-50">
        <ActionBar />
      </div>
    </div>
  );
}
