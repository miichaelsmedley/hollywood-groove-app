import { useState } from 'react';
import { X, Clock } from 'lucide-react';
import type { BreakMode } from '../../contexts/ShowContext';

interface BreakMenuModalProps {
  onSelect: (mode: Exclude<BreakMode, 'off'>, customDuration?: number) => void;
  onClose: () => void;
  currentMedian: number | null;
}

const BREAK_OPTIONS: {
  mode: Exclude<BreakMode, 'off'>;
  icon: string;
  label: string;
  description: string;
  duration: string;
  hasCustomDuration?: boolean;
}[] = [
  {
    mode: 'dancing',
    icon: '💃',
    label: 'Dance no limit',
    description: 'Get on the dance floor!',
    duration: 'No limit',
  },
  {
    mode: 'chatting',
    icon: '⏱️',
    label: 'Break',
    description: 'Choose your duration',
    duration: 'Custom',
    hasCustomDuration: true,
  },
  {
    mode: 'toilet',
    icon: '⚡',
    label: 'Quick break',
    description: 'Back in 5 minutes',
    duration: '5 min',
  },
];

const DURATION_OPTIONS = [2, 5, 10, 15, 20, 30];

export default function BreakMenuModal({ onSelect, onClose, currentMedian }: BreakMenuModalProps) {
  const [showDurationPicker, setShowDurationPicker] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState(10);

  const handleOptionClick = (option: typeof BREAK_OPTIONS[0]) => {
    if (option.hasCustomDuration) {
      setShowDurationPicker(true);
    } else {
      onSelect(option.mode);
    }
  };

  const handleDurationSelect = () => {
    onSelect('chatting', selectedDuration);
    setShowDurationPicker(false);
  };

  if (showDurationPicker) {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={() => setShowDurationPicker(false)}
        />

        {/* Modal */}
        <div className="relative w-full max-w-lg bg-gray-900 rounded-t-2xl border-t border-gray-700 p-4 pb-8 animate-slide-up">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold text-white">Choose Duration</h3>
            <button
              onClick={() => setShowDurationPicker(false)}
              className="p-2 rounded-full bg-gray-800 hover:bg-gray-700 transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Info */}
          <p className="text-sm text-gray-400 mb-4">
            Select how long you'll be away. You'll earn ~{currentMedian ?? 50} pts automatically.
          </p>

          {/* Duration Options */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            {DURATION_OPTIONS.map((duration) => (
              <button
                key={duration}
                onClick={() => setSelectedDuration(duration)}
                className={`flex flex-col items-center justify-center gap-1 p-4 rounded-xl border-2 transition-all active:scale-[0.95] ${
                  selectedDuration === duration
                    ? 'bg-primary/20 border-primary text-primary'
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                }`}
              >
                <Clock className="w-5 h-5" />
                <span className="text-lg font-bold">{duration}</span>
                <span className="text-xs">min</span>
              </button>
            ))}
          </div>

          {/* Confirm Button */}
          <button
            onClick={handleDurationSelect}
            className="w-full py-3 rounded-xl bg-primary text-gray-900 font-bold shadow-lg hover:bg-primary-400 transition-all active:scale-[0.98]"
          >
            Start {selectedDuration} min break
          </button>
        </div>
      </div>
    );
  }

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
              onClick={() => handleOptionClick(option)}
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
