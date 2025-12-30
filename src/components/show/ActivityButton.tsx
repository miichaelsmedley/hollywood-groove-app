import { useNavigate, useLocation } from 'react-router-dom';
import { Mic, Users, Trophy, Vote } from 'lucide-react';
import { useShow } from '../../contexts/ShowContext';

export default function ActivityButton() {
  const { showId, liveActivity } = useShow();
  const navigate = useNavigate();
  const location = useLocation();

  // Don't show if no live activity or activity has ended
  if (!liveActivity || liveActivity.status !== 'active') {
    return null;
  }

  // Don't show for dancing (handled by DanceBreakButton)
  if (liveActivity.type === 'dancing') {
    return null;
  }

  // Don't show if already on activity page
  if (location.pathname.includes('/activity')) {
    return null;
  }

  const handleClick = () => {
    navigate(`/shows/${showId}/activity`);
  };

  // Get appropriate icon based on activity type
  const getIcon = () => {
    switch (liveActivity.type) {
      case 'stage_participation':
      case 'sing_signup':
      case 'backup_singer':
        return <Mic className="w-5 h-5" />;
      case 'costume_contest':
      case 'competition':
        return <Trophy className="w-5 h-5" />;
      case 'vote':
        return <Vote className="w-5 h-5" />;
      default:
        return <Users className="w-5 h-5" />;
    }
  };

  // Get label based on activity type
  const getLabel = () => {
    switch (liveActivity.type) {
      case 'stage_participation':
        return 'Join Stage';
      case 'sing_signup':
        return 'Sign Up';
      case 'backup_singer':
        return 'Backup Singer';
      case 'costume_contest':
        return 'Costume Contest';
      case 'competition':
        return 'Competition';
      case 'vote':
        return 'Vote Now';
      case 'raffle':
        return 'Raffle';
      default:
        return 'Join Activity';
    }
  };

  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-accent-teal/20 border-2 border-accent-teal text-accent-teal shadow-lg hover:bg-accent-teal/30 transition-all active:scale-95"
    >
      {getIcon()}
      <div className="flex flex-col items-start">
        <span className="font-bold">{getLabel()}</span>
        {liveActivity.slotsAvailable && (
          <span className="text-xs opacity-80">{liveActivity.slotsAvailable} spots</span>
        )}
        {liveActivity.fixedPoints && !liveActivity.slotsAvailable && (
          <span className="text-xs opacity-80">{liveActivity.fixedPoints} pts</span>
        )}
      </div>
    </button>
  );
}
