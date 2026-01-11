import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { onValue, ref, set } from 'firebase/database';
import { CalendarCheck, ArrowLeft, Users, CheckCircle, Clock, Trophy } from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { CrowdActivity } from '../types/firebaseContract';
import ActionBar from '../components/show/ActionBar';
import { getShowPath } from '../lib/mode';

interface UserResponse {
  action?: string;
  joinedAt?: number;
  displayName?: string;
  optionIndex?: number;
  optionText?: string;
  votedAt?: number;
}

export default function ActivityDetail() {
  const { id, activityId } = useParams<{ id: string; activityId: string }>();
  const [activity, setActivity] = useState<CrowdActivity | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasResponded, setHasResponded] = useState(false);
  const [existingResponse, setExistingResponse] = useState<UserResponse | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Fetch activity details
  useEffect(() => {
    if (!id || !activityId) return;

    const activityRef = ref(db, getShowPath(id, `activities/${activityId}`));
    const unsubscribe = onValue(activityRef, (snapshot) => {
      setActivity(snapshot.val() as CrowdActivity | null);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [id, activityId]);

  // Check if user has already responded
  useEffect(() => {
    if (!id || !activityId || !auth.currentUser) return;
    const uid = auth.currentUser.uid;

    const responseRef = ref(db, getShowPath(id, `responses/${activityId}/${uid}`));
    const unsubscribe = onValue(responseRef, (snapshot) => {
      const response = snapshot.val() as UserResponse | null;
      if (response) {
        setHasResponded(true);
        setExistingResponse(response);
        if (typeof response.optionIndex === 'number') {
          setSelectedOption(response.optionIndex);
        }
      }
    });

    return () => unsubscribe();
  }, [id, activityId]);

  const joinActivity = async () => {
    if (!id || !activityId || !auth.currentUser || submitting) return;
    const uid = auth.currentUser.uid;

    setSubmitting(true);
    try {
      await set(ref(db, getShowPath(id, `responses/${activityId}/${uid}`)), {
        action: 'join',
        joinedAt: Date.now(),
        displayName: auth.currentUser.displayName || 'Anonymous',
      });
      setHasResponded(true);
    } catch (error) {
      console.error('Failed to join activity:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const voteOption = async (optionIndex: number, optionText: string) => {
    if (!id || !activityId || !auth.currentUser || hasResponded || submitting) return;
    const uid = auth.currentUser.uid;

    setSubmitting(true);
    try {
      await set(ref(db, getShowPath(id, `responses/${activityId}/${uid}`)), {
        optionIndex,
        optionText,
        votedAt: Date.now(),
        displayName: auth.currentUser.displayName || 'Anonymous',
      });
      setSelectedOption(optionIndex);
      setHasResponded(true);
    } catch (error) {
      console.error('Failed to submit vote:', error);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
        <div className="flex-1 p-4 pb-40">
          <Link
            to={`/shows/${id}/activities`}
            className="inline-flex items-center space-x-2 text-gray-400 hover:text-gray-100 transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Activities</span>
          </Link>
          <div className="text-center py-12 text-cinema-400">Loading activity...</div>
        </div>
        <div className="fixed bottom-0 left-0 right-0 z-50">
          <ActionBar />
        </div>
      </div>
    );
  }

  if (!activity) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
        <div className="flex-1 p-4 pb-40">
          <Link
            to={`/shows/${id}/activities`}
            className="inline-flex items-center space-x-2 text-gray-400 hover:text-gray-100 transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Activities</span>
          </Link>

          <div className="max-w-lg mx-auto text-center py-8">
            <CalendarCheck className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <h2 className="text-xl font-bold mb-2">Activity Not Found</h2>
            <p className="text-gray-400 text-sm">
              This activity doesn't exist or has been removed.
            </p>
          </div>
        </div>
        <div className="fixed bottom-0 left-0 right-0 z-50">
          <ActionBar />
        </div>
      </div>
    );
  }

  const options = Array.isArray(activity.options) ? activity.options : [];
  const prompt = activity.prompt || activity.description || '';
  const isVote = activity.type === 'vote' && options.length > 0;
  const isSignup = ['sing_signup', 'backup_singer', 'stage_participation', 'costume_contest', 'competition', 'raffle'].includes(activity.type);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      <div className="flex-1 overflow-y-auto p-4 pb-40">
        <div className="max-w-lg mx-auto space-y-4">
          <Link
            to={`/shows/${id}/activities`}
            className="inline-flex items-center space-x-2 text-gray-400 hover:text-gray-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back to Activities</span>
          </Link>

          {/* Activity Header */}
          <div className="bg-cinema-900/60 border border-cinema-700 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="text-[10px] uppercase tracking-[0.2em] text-cinema-400">
                {activity.type.replace(/_/g, ' ')}
              </div>
              {activity.songId && (
                <span className="text-[10px] uppercase tracking-wide bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded">
                  Song Activity
                </span>
              )}
              {!activity.songId && !activity.setId && (
                <span className="text-[10px] uppercase tracking-wide bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded">
                  All Night
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold">{activity.title}</h1>
            {prompt && <p className="text-cinema-300 text-sm">{prompt}</p>}

            {activity.prize && (
              <div className="flex items-center gap-2 text-amber-300">
                <Trophy className="w-4 h-4" />
                <span className="text-sm font-semibold">Prize: {activity.prize}</span>
              </div>
            )}

            {activity.maxParticipants && (
              <div className="flex items-center gap-2 text-cinema-400">
                <Users className="w-4 h-4" />
                <span className="text-sm">{activity.maxParticipants} spots available</span>
              </div>
            )}
          </div>

          {/* Already Joined State */}
          {hasResponded && (
            <div className="bg-accent-green/10 border border-accent-green/30 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-6 h-6 text-accent-green flex-shrink-0" />
                <div>
                  <div className="font-semibold text-accent-green">You're signed up!</div>
                  <div className="text-sm text-cinema-400">
                    {existingResponse?.joinedAt && (
                      <>Joined {new Date(existingResponse.joinedAt).toLocaleTimeString()}</>
                    )}
                    {existingResponse?.votedAt && (
                      <>Voted {new Date(existingResponse.votedAt).toLocaleTimeString()}</>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Vote Options */}
          {isVote && !hasResponded && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-cinema-300 mb-2">Cast your vote:</div>
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
                  disabled={submitting}
                >
                  <div className="font-semibold">{option.text}</div>
                </button>
              ))}
            </div>
          )}

          {/* Show selected vote */}
          {isVote && hasResponded && selectedOption !== null && (
            <div className="text-sm text-cinema-400">
              You voted for: <span className="text-white font-medium">{options[selectedOption]?.text}</span>
            </div>
          )}

          {/* Sign Up Button (for non-vote activities) */}
          {isSignup && !hasResponded && (
            <div className="space-y-3">
              <button
                type="button"
                onClick={joinActivity}
                className="w-full py-4 px-4 rounded-xl bg-accent-green text-gray-900 font-bold text-lg hover:bg-accent-green/90 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={submitting}
              >
                {submitting ? 'Signing up...' : 'Sign Up Now'}
              </button>
              <p className="text-xs text-cinema-500 text-center">
                You'll be added to the participation list for this activity.
              </p>
            </div>
          )}

          {/* Info for trivia/dancing - these are handled differently */}
          {(activity.type === 'trivia' || activity.type === 'dancing') && (
            <div className="bg-cinema-800/50 border border-cinema-700 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-cinema-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-cinema-400">
                  {activity.type === 'trivia'
                    ? 'This trivia question will be pushed live by the DJ. Watch for it in the Trivia section!'
                    : 'Dancing points will be available when the DJ activates this track.'}
                </div>
              </div>
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
