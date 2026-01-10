import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mic, Trophy, Vote, Users, Music, HelpCircle, Calendar, Sparkles, Coffee } from 'lucide-react';
import { CrowdActivity, ActivityType } from '../types/firebaseContract';

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

type GlobalActivity = CrowdActivity & {
  id: string;
  showId?: string;
};

/**
 * Global activities page - shows "always" level activities that run between shows.
 * This is for engagement when users are NOT at a live show.
 */
export default function GlobalActivities() {
  const [activities, setActivities] = useState<GlobalActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Global activities are a future feature (Phase 3.5)
    // For now, just show the empty state without attempting to read from Firebase
    // This avoids permission errors until the global_activities path and rules are set up
    setActivities([]);
    setLoading(false);

    // TODO: When global activities are implemented:
    // 1. Add 'global_activities' path to Firebase security rules
    // 2. Uncomment the Firebase listener below
    // const globalActivitiesRef = ref(db, 'global_activities');
    // const unsubscribe = onValue(globalActivitiesRef, (snapshot) => { ... });
    // return () => unsubscribe();
  }, []);

  const renderActivityCard = (activity: GlobalActivity) => {
    const config = ACTIVITY_CONFIG[activity.type] || ACTIVITY_CONFIG.stage_participation;
    const Icon = config.icon;

    return (
      <div
        key={activity.id}
        className="p-4 rounded-xl border bg-white border-cinema-200 hover:border-primary/50 transition-all cursor-pointer"
      >
        <div className="flex items-start gap-3">
          <div className={`p-2.5 rounded-lg bg-cinema-100 ${config.color}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-cinema-900">{activity.title}</h3>
            {activity.description && (
              <p className="text-sm text-cinema-500 mt-0.5 line-clamp-2">{activity.description}</p>
            )}
            <div className="flex items-center gap-2 mt-2">
              <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>
              {activity.prize && (
                <span className="text-xs text-amber-600 font-medium">Prize: {activity.prize}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-md space-y-6">
        <Link
          to="/"
          className="inline-flex items-center space-x-2 text-cinema-500 hover:text-cinema-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </Link>
        <div className="text-center py-12 text-cinema-400">Loading activities...</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link
          to="/"
          className="inline-flex items-center space-x-2 text-cinema-500 hover:text-cinema-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </Link>
      </div>

      <section className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-cinema-900">Activities</h1>
        <p className="text-cinema-500">Play trivia, vote in polls, and earn stars between shows</p>
      </section>

      {/* Activities List */}
      {activities.length > 0 ? (
        <section className="space-y-3">
          {activities.map((activity) => renderActivityCard(activity))}
        </section>
      ) : (
        <section className="text-center py-12 space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-cinema-100">
            <Coffee className="w-8 h-8 text-cinema-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-cinema-900 mb-1">No Activities Right Now</h2>
            <p className="text-sm text-cinema-500 max-w-xs mx-auto">
              Check back soon! We'll have trivia, polls, and other fun activities between shows.
            </p>
          </div>
          <Link
            to="/shows"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-cinema-900 font-semibold hover:bg-primary/90 transition-colors"
          >
            <Calendar className="w-4 h-4" />
            View Upcoming Shows
          </Link>
        </section>
      )}
    </div>
  );
}
