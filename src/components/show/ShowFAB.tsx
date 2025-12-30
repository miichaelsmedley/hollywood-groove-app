import DanceBreakButton from './DanceBreakButton';
import ActivityButton from './ActivityButton';

/**
 * Floating Action Buttons container for show pages.
 * Positioned fixed at bottom-right, above safe area.
 * Contains Dance/Break button and Activity button (when applicable).
 */
export default function ShowFAB() {
  return (
    <div className="fixed bottom-6 right-4 z-50 flex flex-col items-end gap-3 pb-[env(safe-area-inset-bottom)]">
      <ActivityButton />
      <DanceBreakButton />
    </div>
  );
}
