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
    label: 'Dance',
    description: 'Get on the dance floor!',
    duration: 'No limit',
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
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-gray-900 rounded-t-2xl border-t border-gray-700 p-4 pb-8 animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold text-white">Take a Break</h3>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-gray-800 hover:bg-gray-700 transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Info */}
        <p className="text-sm text-gray-400 mb-4">
          Earn ~{currentMedian ?? 50} pts automatically while you're away. Auto-claims every minute (respects cooldown).
        </p>

        {/* Options */}
        <div className="space-y-3">
          {BREAK_OPTIONS.map((option) => (
            <button
              key={option.mode}
              onClick={() => onSelect(option.mode)}
              className="w-full flex items-center gap-4 p-4 rounded-xl bg-gray-800 border-2 border-gray-700 hover:border-primary hover:bg-gray-800/80 transition-all active:scale-[0.98]"
            >
              <span className="text-3xl">{option.icon}</span>
              <div className="flex-1 text-left">
                <div className="font-bold text-white text-base">{option.label}</div>
                <div className="text-sm text-gray-400">{option.description}</div>
              </div>
              <div className="text-sm text-gray-500 bg-gray-900 px-3 py-1.5 rounded-full font-medium">
                {option.duration}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
