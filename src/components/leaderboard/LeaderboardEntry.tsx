import { Trophy } from 'lucide-react';
import TierBadge from './TierBadge';

interface LeaderboardEntryProps {
  rank: number;
  displayName: string;
  tier?: string | null;
  score: number;
  scoreSuffix?: string;
  isCurrentUser?: boolean;
}

const medalStyles: Record<number, string> = {
  1: 'text-yellow-500',
  2: 'text-slate-400',
  3: 'text-amber-700',
};

function RankBadge({ rank }: { rank: number }) {
  if (rank <= 3) {
    return <Trophy className={`w-4 h-4 ${medalStyles[rank] ?? 'text-primary'}`} />;
  }
  return <span className="w-6 text-sm text-cinema-500 text-center">{rank}</span>;
}

export default function LeaderboardEntry({
  rank,
  displayName,
  tier,
  score,
  scoreSuffix,
  isCurrentUser,
}: LeaderboardEntryProps) {
  return (
    <li
      className={[
        'flex items-center justify-between px-4 py-3',
        isCurrentUser ? 'bg-primary/10' : '',
      ].join(' ')}
    >
      <div className="flex items-center gap-3 min-w-0">
        <RankBadge rank={rank} />
        <span className="truncate font-semibold">{displayName || 'Guest'}</span>
        <TierBadge tier={tier} />
      </div>
      <span className="font-bold tabular-nums">
        {score.toLocaleString()}
        {scoreSuffix ? ` ${scoreSuffix}` : ''}
      </span>
    </li>
  );
}
