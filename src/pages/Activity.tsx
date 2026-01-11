import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { onValue, ref, set } from 'firebase/database';
import { CalendarCheck, ArrowLeft, Users } from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { CrowdActivity, LiveActivityState } from '../types/firebaseContract';
import ActionBar from '../components/show/ActionBar';
import { getShowPath } from '../lib/mode';

export default function Activity() {
  const { id } = useParams<{ id: string }>();
  const [liveActivity, setLiveActivity] = useState<LiveActivityState | null>(null);
  const [activity, setActivity] = useState<CrowdActivity | null>(null);
  const [hasResponded, setHasResponded] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);

  useEffect(() => {
    if (!id) return;

    const unsubscribe = onValue(
      ref(db, getShowPath(id, 'live/activity')),
      (snapshot) => {
        const state = snapshot.val() as LiveActivityState | null;
        setLiveActivity(state);
        setHasResponded(false);
        setSelectedOption(null);
      }
    );

    return () => unsubscribe();
  }, [id]);

  useEffect(() => {
    if (!id || !liveActivity?.activityId) {
      setActivity(null);
      return;
    }

    const activityRef = ref(db, getShowPath(id, `activities/${liveActivity.activityId}`));
    const unsubscribe = onValue(activityRef, (snapshot) => {
      setActivity(snapshot.val() as CrowdActivity | null);
    });

    return () => unsubscribe();
  }, [id, liveActivity?.activityId]);

  const joinActivity = async () => {
    if (!id || !liveActivity?.activityId || !auth.currentUser) return;
    const uid = auth.currentUser.uid;

    try {
      await set(ref(db, getShowPath(id, `responses/${liveActivity.activityId}/${uid}`)), {
        action: 'join',
        joinedAt: Date.now(),
        displayName: auth.currentUser.displayName || 'Anonymous',
      });
      setHasResponded(true);
    } catch (error) {
      console.error('Failed to join activity:', error);
    }
  };

  const claimDancePoints = async () => {
    if (!id || !liveActivity?.activityId || !auth.currentUser) return;
    const uid = auth.currentUser.uid;

    try {
      await set(ref(db, getShowPath(id, `responses/${liveActivity.activityId}/${uid}`)), {
        type: 'dance_claim',
        claimedAt: Date.now(),
        displayName: auth.currentUser.displayName || 'Anonymous',
      });
      setHasResponded(true);
    } catch (error) {
      console.error('Failed to claim dance points:', error);
    }
  };

  const voteOption = async (optionIndex: number, optionText: string) => {
    if (!id || !liveActivity?.activityId || !auth.currentUser) return;
    const uid = auth.currentUser.uid;

    try {
      await set(ref(db, getShowPath(id, `responses/${liveActivity.activityId}/${uid}`)), {
        optionIndex,
        optionText,
        votedAt: Date.now(),
        displayName: auth.currentUser.displayName || 'Anonymous',
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
            to={`/shows/${id}`}
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
            to={`/shows/${id}`}
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
            to={`/shows/${id}`}
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

          {isDancing ? (
            <div className="space-y-2">
              <button
                type="button"
                onClick={claimDancePoints}
                className="w-full py-3 px-4 rounded-lg bg-primary/20 border border-primary text-primary font-semibold text-sm hover:bg-primary/30 transition-all active:scale-[0.98] disabled:opacity-50"
                disabled={hasResponded}
              >
                {hasResponded
                  ? 'Claimed!'
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
