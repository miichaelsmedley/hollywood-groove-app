import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { onValue, ref, set } from 'firebase/database';
import { CalendarCheck, ArrowLeft, Users } from 'lucide-react';
import { auth, db, rtdbPath } from '../lib/firebase';
import { CrowdActivity, LiveActivityState } from '../types/firebaseContract';

export default function Activity() {
  const { id } = useParams<{ id: string }>();
  const [liveActivity, setLiveActivity] = useState<LiveActivityState | null>(null);
  const [activity, setActivity] = useState<CrowdActivity | null>(null);
  const [hasResponded, setHasResponded] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);

  useEffect(() => {
    if (!id) return;
    const showId = Number(id);

    const unsubscribe = onValue(
      ref(db, rtdbPath(`shows/${showId}/live/activity`)),
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

    const showId = Number(id);
    const activityRef = ref(db, rtdbPath(`shows/${showId}/activities/${liveActivity.activityId}`));
    const unsubscribe = onValue(activityRef, (snapshot) => {
      setActivity(snapshot.val() as CrowdActivity | null);
    });

    return () => unsubscribe();
  }, [id, liveActivity?.activityId]);

  const joinActivity = async () => {
    if (!id || !liveActivity?.activityId || !auth.currentUser) return;
    const showId = Number(id);
    const uid = auth.currentUser.uid;

    try {
      await set(ref(db, rtdbPath(`shows/${showId}/responses/${liveActivity.activityId}/${uid}`)), {
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
    const showId = Number(id);
    const uid = auth.currentUser.uid;

    try {
      await set(ref(db, rtdbPath(`shows/${showId}/responses/${liveActivity.activityId}/${uid}`)), {
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
    const showId = Number(id);
    const uid = auth.currentUser.uid;

    try {
      await set(ref(db, rtdbPath(`shows/${showId}/responses/${liveActivity.activityId}/${uid}`)), {
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
      <div className="min-h-screen bg-gray-950 text-gray-100 p-8">
        <Link
          to={`/shows/${id}`}
          className="inline-flex items-center space-x-2 text-gray-400 hover:text-gray-100 transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Show</span>
        </Link>

        <div className="max-w-2xl mx-auto text-center py-12">
          <CalendarCheck className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">No Active Activity</h2>
          <p className="text-gray-400">
            Check back when the DJ starts a crowd activity.
          </p>
        </div>
      </div>
    );
  }

  if (!activity) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 p-8">
        <Link
          to={`/shows/${id}`}
          className="inline-flex items-center space-x-2 text-gray-400 hover:text-gray-100 transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Show</span>
        </Link>
        <div className="max-w-2xl mx-auto text-center py-12">
          <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Loading Activity</h2>
          <p className="text-gray-400">Fetching the activity details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-4 sm:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <Link
          to={`/shows/${id}`}
          className="inline-flex items-center space-x-2 text-gray-400 hover:text-gray-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Show</span>
        </Link>

        <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 space-y-4">
          <div className="text-xs uppercase tracking-[0.3em] text-gray-400">Live Activity</div>
          <h1 className="text-3xl font-bold">{activity.title}</h1>
          <p className="text-gray-300 text-lg">{prompt}</p>

          {activity.prize && (
            <div className="text-sm text-amber-300 font-semibold">Prize: {activity.prize}</div>
          )}

          {activity.maxParticipants && (
            <div className="text-sm text-gray-400">Spots: {activity.maxParticipants}</div>
          )}
        </div>

        {isDancing ? (
          <div className="space-y-3">
            <button
              type="button"
              onClick={claimDancePoints}
              className="w-full btn-primary"
              disabled={hasResponded}
            >
              {hasResponded
                ? 'Claimed!'
                : hasMedian
                  ? `Claim ${currentMedian} pts`
                  : 'Claim dance points'}
            </button>
            {hasResponded && (
              <div className="text-sm text-primary font-semibold">You are locked in.</div>
            )}
            {!hasResponded && (
              <div className="text-xs text-gray-400">
                Get on the floor to earn points.
              </div>
            )}
          </div>
        ) : activity.type === 'vote' && options.length > 0 ? (
          <div className="space-y-3">
            {options.map((option) => (
              <button
                key={option.index}
                type="button"
                onClick={() => voteOption(option.index, option.text)}
                className={[
                  'w-full text-left px-5 py-4 rounded-xl border transition',
                  selectedOption === option.index
                    ? 'border-primary/70 bg-primary/20'
                    : 'border-gray-800 bg-gray-900/60 hover:border-primary/40',
                ].join(' ')}
                disabled={hasResponded}
              >
                <div className="font-semibold">{option.text}</div>
              </button>
            ))}
            {hasResponded && (
              <div className="text-sm text-primary font-semibold">Thanks for voting!</div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <button
              type="button"
              onClick={joinActivity}
              className="w-full btn-primary"
              disabled={hasResponded}
            >
              {hasResponded ? 'You are in!' : 'Join Activity'}
            </button>
            {hasResponded && (
              <div className="text-sm text-primary font-semibold">You are locked in.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
