import { ChevronDown, Info } from 'lucide-react';
import { useState } from 'react';

export default function ScoringRulesPanel() {
  const [open, setOpen] = useState(false);

  return (
    <section className="bg-cinema-50 border border-cinema-200 rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-cinema-100 transition-colors cursor-pointer"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 font-semibold text-cinema-900">
          <Info className="w-4 h-4 text-primary" />
          How scoring works
        </span>
        <ChevronDown className={`w-4 h-4 text-cinema-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="border-t border-cinema-200 px-4 py-4 text-sm text-cinema-700 space-y-3">
          <p>Each set has its own leaderboard. The top scorer when a set closes is the set winner.</p>
          <p>The night winner is the top total scorer when the show closes.</p>
          <p>If scores are tied, the winner is the player who reached that score first.</p>
          <p>Season points add your final night total plus 200 attendance points after the show closes.</p>
          <p>Dance windows are pre-tagged songs. If you are in dance mode while the window is open, functions add +100 once for that window.</p>
          <p>Each dance window has one random Spotlight moment. Everyone in dance mode at that instant gets +150.</p>
        </div>
      )}
    </section>
  );
}
