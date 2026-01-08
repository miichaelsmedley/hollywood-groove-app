import React, { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { onValue, ref } from 'firebase/database';
import { ArrowLeft, Mic, Trophy, Vote, Users, Music, HelpCircle, Calendar, Sparkles, ChevronRight } from 'lucide-react';
import { db, rtdbPath } from '../lib/firebase';
import { CrowdActivity, ActivityType, LiveActivityState, LiveTriviaState } from '../types/firebaseContract';
import ActionBar from '../components/show/ActionBar';

// Activity type display config
const ACTIVITY_CONFIG: Record<ActivityType, { icon: typeof Mic; label: string; color: string }> = {
  trivia: { icon: HelpCircle, label: 'Trivia', color: 'text-primary' },
  dancing: { icon: Music, label: 'Dancing', color: 'text-primary' },
  sing_signup: { icon: Mic, label: 'Sing Signup', color: 'text-accent-green' },
  backup_singer: { icon: Mic, label: 'Backup Singer', color: 'text-accent-green' },
  costume_contest: { icon: Trophy, label: 'Costume Contest', color: 'text-amber-400' },
  competition: { icon: Trophy, label: 'Competition', color: 'text-amber-400' },
  stage_participation: { icon: Users, label: 'Stage Participation', color: 'text-purple-400' },
  vote: { icon: Vote, label: 'Vote', color: 'text-blue-400' },
  raffle: { icon: Sparkles, label: 'Raffle', color: 'text-pink-400' },
};

type ActivityWithId = CrowdActivity & {
  id: string;
};

export default function Activities() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activities, setActivities] = useState<ActivityWithId[]>([]);
  const [liveActivity, setLiveActivity] = useState<LiveActivityState | null>(null);
  const [liveTrivia, setLiveTrivia] = useState<LiveTriviaState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const showId = Number(id);

    // Listen to activities
    const activitiesRef = ref(db, rtdbPath(`shows/${showId}/activities`));
    const unsubscribeActivities = onValue(activitiesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const activityList: ActivityWithId[] = Object.entries(data).map(([activityId, activity]) => ({
          ...(activity as CrowdActivity),
          id: activityId,
        }));
        // Sort by sequence if available, otherwise by title
        activityList.sort((a, b) => {
          if (a.sequence !== undefined && b.sequence !== undefined) {
            return a.sequence - b.sequence;
          }
          return (a.title || '').localeCompare(b.title || '');
        });
        setActivities(activityList);
      } else {
        setActivities([]);
      }
      setLoading(false);
    });

    // Listen to live activity state
    const liveActivityRef = ref(db, rtdbPath(`shows/${showId}/live/activity`));
    const unsubscribeLiveActivity = onValue(liveActivityRef, (snapshot) => {
      setLiveActivity(snapshot.val() as LiveActivityState | null);
    });

    // Listen to live trivia state
    const liveTriviaRef = ref(db, rtdbPath(`shows/${showId}/live/trivia`));
    const unsubscribeLiveTrivia = onValue(liveTriviaRef, (snapshot) => {
      setLiveTrivia(snapshot.val() as LiveTriviaState | null);
    });

    return () => {
      unsubscribeActivities();
      unsubscribeLiveActivity();
      unsubscribeLiveTrivia();
    };
  }, [id]);

  // Find activities that match current live state
  const liveActivitiesFromCollection = activities.filter((a) =>
    (liveActivity?.activityId === a.id && liveActivity?.status === 'active') ||
    (liveTrivia?.activityId === a.id && liveTrivia?.phase !== 'idle')
  );

  // Build the live activities list, including live activity from state if not in collection
  const buildLiveActivities = (): ActivityWithId[] => {
    const result: ActivityWithId[] = [...liveActivitiesFromCollection];

    // If there's an active live activity that's NOT in our activities collection,
    // create a synthetic entry from the live state
    if (liveActivity?.status === 'active' && liveActivity.activityId) {
      const existsInCollection = activities.some((a) => a.id === liveActivity.activityId);
      if (!existsInCollection) {
        // Create a synthetic activity from live state
        const syntheticActivity: ActivityWithId = {
          id: liveActivity.activityId,
          type: liveActivity.type,
          title: liveActivity.prompt || liveActivity.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          prompt: liveActivity.prompt,
          maxParticipants: liveActivity.slotsAvailable,
        };
        result.push(syntheticActivity);
      }
    }

    return result;
  };

  // Group activities by scope
  const groupedActivities = {
    live: buildLiveActivities(),
    show: activities.filter((a) => !a.songId && !a.setId && a.type !== 'trivia'),
    set: activities.filter((a) => a.setId && !a.songId),
    song: activities.filter((a) => a.songId),
  };

  // Filter out live activities from other groups
  const liveIds = new Set(groupedActivities.live.map((a) => a.id));
  groupedActivities.show = groupedActivities.show.filter((a) => !liveIds.has(a.id));
  groupedActivities.set = groupedActivities.set.filter((a) => !liveIds.has(a.id));
  groupedActivities.song = groupedActivities.song.filter((a) => !liveIds.has(a.id));

  // Determine if an activity is joinable (can be signed up for at any time)
  const isJoinableActivity = (activity: ActivityWithId) => {
    // Trivia and dancing are handled via live state, not direct signup
    if (activity.type === 'trivia' || activity.type === 'dancing') return false;
    // All other activities can be joined
    return true;
  };

  const handleActivityClick = (activity: ActivityWithId, isLive: boolean) => {
    // If it's live trivia, go to trivia page
    if (isLive && activity.type === 'trivia') {
      navigate(`/shows/${id}/trivia`);
      return;
    }
    // If it's live non-trivia activity, go to activity page
    if (isLive && activity.type !== 'trivia') {
      navigate(`/shows/${id}/activity`);
      return;
    }
    // For joinable activities (show/set level), go to detail page
    if (isJoinableActivity(activity)) {
      navigate(`/shows/${id}/activities/${activity.id}`);
    }
  };

  const renderActivityCard = (activity: ActivityWithId, isLive = false) => {
    const config = ACTIVITY_CONFIG[activity.type] || ACTIVITY_CONFIG.stage_participation;
    const Icon = config.icon;
    const isClickable = isLive || isJoinableActivity(activity);

    return (
      <button
        key={activity.id}
        type="button"
        onClick={() => handleActivityClick(activity, isLive)}
        disabled={!isClickable}
        className={`w-full text-left p-3 rounded-lg border transition-all ${
          isLive
            ? 'bg-primary/10 border-primary/50 animate-pulse cursor-pointer'
            : isClickable
              ? 'bg-cinema-900/60 border-cinema-700 hover:border-cinema-500 hover:bg-cinema-800/60 cursor-pointer active:scale-[0.98]'
              : 'bg-cinema-900/60 border-cinema-700 opacity-60 cursor-not-allowed'
        }`}
      >
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg bg-cinema-800 ${config.color}`}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm text-white truncate">{activity.title}</h3>
              {isLive && (
                <span className="text-[10px] uppercase tracking-wide bg-primary text-cinema-900 px-1.5 py-0.5 rounded font-bold">
                  Live
                </span>
              )}
            </div>
            {activity.description && (
              <p className="text-xs text-cinema-400 mt-0.5 line-clamp-2">{activity.description}</p>
            )}
            <div className="flex items-center gap-2 mt-1.5">
              <span className={`text-[10px] ${config.color}`}>{config.label}</span>
              {activity.prize && (
                <span className="text-[10px] text-amber-400">Prize: {activity.prize}</span>
              )}
              {activity.maxParticipants && (
                <span className="text-[10px] text-cinema-500">{activity.maxParticipants} spots</span>
              )}
            </div>
          </div>
          {/* Chevron for clickable items */}
          {isClickable && (
            <ChevronRight className="w-4 h-4 text-cinema-500 flex-shrink-0 self-center" />
          )}
        </div>
      </button>
    );
  };

  const renderSection = (title: string, icon: typeof Calendar, items: ActivityWithId[], isLive = false) => {
    if (items.length === 0) return null;

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-cinema-400">
          {React.createElement(icon, { className: 'w-4 h-4' })}
          <h2 className="text-sm font-semibold uppercase tracking-wide">{title}</h2>
          <span className="text-xs text-cinema-500">({items.length})</span>
        </div>
        <div className="space-y-2">
          {items.map((activity) => renderActivityCard(activity, isLive))}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
        <div className="flex-1 p-4 pb-40">
          <Link
            to={`/shows/${id}`}
            className="inline-flex items-center space-x-2 text-gray-400 hover:text-gray-100 transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Show</span>
          </Link>
          <div className="text-center py-12 text-cinema-400">Loading activities...</div>
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
      {/* Scrollable content with bottom padding for sticky ActionBar */}
      <div className="flex-1 overflow-y-auto p-4 pb-40">
        <div className="max-w-lg mx-auto space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <Link
              to={`/shows/${id}`}
              className="inline-flex items-center space-x-1 text-gray-400 hover:text-gray-100 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">Back</span>
            </Link>
            <h1 className="text-lg font-bold">Activities</h1>
            <div className="w-12" /> {/* Spacer for alignment */}
          </div>

          {/* Live Activities */}
          {renderSection('Live Now', Sparkles, groupedActivities.live, true)}

          {/* Show-level Activities */}
          {renderSection('All Night', Calendar, groupedActivities.show)}

          {/* Set-level Activities */}
          {renderSection('This Set', Music, groupedActivities.set)}

          {/* Song-level Activities */}
          {renderSection('Current Song', Mic, groupedActivities.song)}

          {/* Empty State */}
          {activities.length === 0 && (
            <div className="text-center py-12">
              <Calendar className="w-12 h-12 text-cinema-600 mx-auto mb-3" />
              <h2 className="text-lg font-bold mb-2">No Activities Yet</h2>
              <p className="text-cinema-400 text-sm">
                Activities will appear here when the show starts.
              </p>
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
