import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { useShow } from '../../contexts/ShowContext';

interface RealtimeConnectionPillProps {
  inline?: boolean;
  delayMs?: number;
}

export default function RealtimeConnectionPill({
  inline = false,
  delayMs = 2000,
}: RealtimeConnectionPillProps) {
  const { isRealtimeConnected } = useShow();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isRealtimeConnected) {
      setIsVisible(false);
      return;
    }

    const timer = window.setTimeout(() => setIsVisible(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs, isRealtimeConnected]);

  if (!isVisible) return null;

  const content = (
    <>
      <WifiOff className="h-3.5 w-3.5" />
      <span>Reconnecting...</span>
    </>
  );

  if (inline) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-1 text-xs font-semibold text-amber-200">
        {content}
      </span>
    );
  }

  return (
    <div className="fixed left-1/2 top-3 z-[60] -translate-x-1/2">
      <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-gray-950/95 px-3 py-1.5 text-xs font-semibold text-amber-200 shadow-lg backdrop-blur">
        {content}
      </div>
    </div>
  );
}
