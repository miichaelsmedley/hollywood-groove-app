import { Megaphone } from 'lucide-react';
import { useShow } from '../../contexts/ShowContext';

type CallupInlineNoticeProps = {
  activityId?: string | null;
};

export default function CallupInlineNotice({ activityId }: CallupInlineNoticeProps) {
  const { liveCallup } = useShow();

  if (!liveCallup || (activityId && liveCallup.activityId !== activityId)) {
    return null;
  }

  return (
    <div className="rounded-xl border border-primary/40 bg-primary/15 p-4 text-white">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary">
          <Megaphone className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Current callup</p>
          <p className="mt-1 text-lg font-black leading-tight">{liveCallup.displayName}</p>
          <p className="mt-1 text-sm text-white/70">{liveCallup.activityTitle}</p>
        </div>
      </div>
    </div>
  );
}
