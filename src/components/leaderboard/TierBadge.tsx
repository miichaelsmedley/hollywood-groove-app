import { Star } from 'lucide-react';

type TierKey =
  | 'extra'
  | 'supporting_role'
  | 'featured'
  | 'lead'
  | 'director'
  | 'legend';

const tierConfig: Record<TierKey, { count: number; className: string; label: string }> = {
  extra: { count: 0, className: 'text-cinema-300', label: 'Extra' },
  supporting_role: { count: 1, className: 'text-cinema-400', label: 'Supporting Role' },
  featured: { count: 2, className: 'text-amber-400', label: 'Featured' },
  lead: { count: 3, className: 'text-amber-500', label: 'Lead' },
  director: { count: 4, className: 'text-yellow-500', label: 'Director' },
  legend: { count: 5, className: 'text-yellow-400', label: 'Legend' },
};

interface TierBadgeProps {
  tier?: string | null;
}

export default function TierBadge({ tier }: TierBadgeProps) {
  const resolved = (tier ?? 'extra') as TierKey;
  const config = tierConfig[resolved] ?? tierConfig.extra;

  return (
    <div className="flex items-center gap-0.5" title={config.label}>
      {Array.from({ length: 5 }).map((_, index) => {
        const isFilled = index < config.count;
        return (
          <Star
            key={`star-${index}`}
            className={[
              'w-3 h-3',
              isFilled ? config.className : 'text-cinema-200',
            ].join(' ')}
            fill={isFilled ? 'currentColor' : 'none'}
            strokeWidth={isFilled ? 1.5 : 1}
          />
        );
      })}
    </div>
  );
}
