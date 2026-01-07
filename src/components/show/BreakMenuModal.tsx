import { X } from 'lucide-react';
import type { BreakMode } from '../../contexts/ShowContext';

interface BreakMenuModalProps {
  onSelect: (mode: Exclude<BreakMode, 'off'>) => void;
  onClose: () => void;
  currentMedian: number | null;
}

const BREAK_OPTIONS: {
  mode: Exclude<BreakMode, 'off'>;
  icon: string;
  label: string;
  description: string;
  duration: string;
}[] = [
  {
    mode: 'dancing',
    icon: '💃',
    label: 'Dancing',
    description: 'Earn dance points while you groove',
    duration: '10 min',
  },
  {
    mode: 'toilet',
    icon: '🚻',
    label: 'Quick break',
    description: 'Back in a moment',
    duration: '2 min',
  },
  {
    mode: 'chatting',
    icon: '💬',
    label: 'Chatting / Drinks',
    description: 'Socialising with friends',
    duration: '5 min',
  },
];

export default function BreakMenuModal({ onSelect, onClose, currentMedian }: BreakMenuModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-cinema-900 rounded-t-2xl border-t border-cinema-700 p-4 pb-8 animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">Take a Break</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-cinema-800 transition-colors"
          >
            <X className="w-5 h-5 text-cinema-400" />
          </button>
        </div>

        {/* Info */}
        <p className="text-sm text-cinema-400 mb-4">
          Earn ~{currentMedian ?? 50} pts automatically while you're away. Auto-claims every minute (respects cooldown).
        </p>

        {/* Options */}
        <div className="space-y-2">
          {BREAK_OPTIONS.map((option) => (
            <button
              key={option.mode}
              onClick={() => onSelect(option.mode)}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-cinema-800/50 border border-cinema-700 hover:border-primary/50 hover:bg-cinema-800 transition-all active:scale-[0.98]"
            >
              <span className="text-2xl">{option.icon}</span>
              <div className="flex-1 text-left">
                <div className="font-semibold text-white">{option.label}</div>
                <div className="text-xs text-cinema-400">{option.description}</div>
              </div>
              <div className="text-xs text-cinema-500 bg-cinema-900 px-2 py-1 rounded-full">
                {option.duration}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
