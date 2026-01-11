import { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { onValue, ref } from 'firebase/database';
import { Calendar, MapPin, ArrowLeft, Trophy } from 'lucide-react';
import { db } from '../lib/firebase';
import { ShowMeta, LiveTriviaState, LiveActivityState } from '../types/firebaseContract';
import { useUser } from '../contexts/UserContext';
import { getShowPath, getTestShowPath } from '../lib/mode';

export default function ShowDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { canUseTestMode } = useUser();
  const [showMeta, setShowMeta] = useState<ShowMeta | null>(null);
  const [liveTrivia, setLiveTrivia] = useState<LiveTriviaState | null>(null);
  const [liveActivity, setLiveActivity] = useState<LiveActivityState | null>(null);
  const [loading, setLoading] = useState(true);

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

    const unsubscribeMeta = onValue(
      ref(db, getPath(id, 'meta')),
      (snapshot) => {
        setShowMeta((snapshot.val() as ShowMeta | null) ?? null);
        setLoading(false);
      }
    );

    const liveTriviaPath = getPath(id, 'live/trivia');

    const unsubscribeLive = onValue(
      ref(db, liveTriviaPath),
      (snapshot) => {
        const data = snapshot.val() as LiveTriviaState | null;
        setLiveTrivia(data ?? null);
      }
    );

    const unsubscribeActivity = onValue(
      ref(db, getPath(id, 'live/activity')),
      (snapshot) => {
        setLiveActivity((snapshot.val() as LiveActivityState | null) ?? null);
      }
    );

    return () => {
      unsubscribeMeta();
      unsubscribeLive();
      unsubscribeActivity();
    };
  }, [id, getPath]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!showMeta) {
    return (
      <div className="space-y-6">
        <Link
          to="/shows"
          className="inline-flex items-center space-x-2 text-cinema-500 hover:text-cinema-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Shows</span>
        </Link>

        <div className="bg-cinema-50 rounded-2xl p-6 border border-cinema-200 text-center">
          <h1 className="text-2xl font-bold mb-2">Show not found</h1>
          <p className="text-cinema-500 text-sm">
            This show hasn't been published yet.
          </p>
          <Link to="/join" className="inline-block mt-5 btn-primary">
            Join current show
          </Link>
        </div>
      </div>
    );
  }

  // Check for test show access - only testers can see test shows
  if (showMeta.isTestShow && !canUseTestMode) {
    return (
      <div className="space-y-6">
        <Link
          to="/shows"
          className="inline-flex items-center space-x-2 text-cinema-500 hover:text-cinema-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Shows</span>
        </Link>

        <div className="bg-cinema-50 rounded-2xl p-6 border border-cinema-200 text-center">
          <h1 className="text-2xl font-bold mb-2">Show not found</h1>
          <p className="text-cinema-500 text-sm">
            This show hasn't been published yet.
          </p>
          <Link to="/join" className="inline-block mt-5 btn-primary">
            Join current show
          </Link>
        </div>
      </div>
    );
  }

  const isLive = liveTrivia?.phase !== 'idle' || liveActivity?.status === 'active';
  const showActivityCTA = liveActivity?.status === 'active' && liveActivity.type !== 'trivia';

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link
        to="/shows"
        className="inline-flex items-center space-x-2 text-cinema-500 hover:text-cinema-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Shows</span>
      </Link>

      {/* Show Header */}
      <div className="bg-cinema-50 rounded-2xl p-6 border border-cinema-200">
        <h1 className="text-2xl font-bold mb-5">{showMeta.title}</h1>

        <div className="space-y-3">
          <div className="flex items-center space-x-3 text-cinema-800">
            <Calendar className="w-5 h-5 text-primary" />
            <span>{new Date(showMeta.startDate).toLocaleDateString('en-AU', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}</span>
          </div>

          <div className="flex items-center space-x-3 text-cinema-800">
            <MapPin className="w-5 h-5 text-primary" />
            <span>{showMeta.venueName}</span>
          </div>
        </div>
      </div>

      {/* Live Status */}
      {isLive && (
        <div className="bg-gradient-to-r from-primary/15 to-accent-red/15 border border-primary/40 rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
              </div>
              <span className="text-lg font-semibold">Show is LIVE!</span>
            </div>

            <div className="flex items-center gap-2">
              {showActivityCTA && (
                <Link
                  to={`/shows/${id}/activity${isTestShow ? '?test=true' : ''}`}
                  className="px-4 py-2 bg-primary text-cinema font-semibold rounded-xl hover:bg-primary-600 transition-colors"
                >
                  Join Activity
                </Link>
              )}
              {liveTrivia?.phase === 'question' && (
                <Link
                  to={`/shows/${id}/trivia${isTestShow ? '?test=true' : ''}`}
                  className="px-4 py-2 bg-primary text-cinema font-semibold rounded-xl hover:bg-primary-600 transition-colors"
                >
                  Join Trivia
                </Link>
              )}
            </div>
          </div>

          {liveTrivia?.phase === 'question' && (
            <div className="mt-4 flex items-center space-x-2 text-sm text-cinema-700">
              <Trophy className="w-4 h-4" />
              <span>Answer the current question to compete!</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
