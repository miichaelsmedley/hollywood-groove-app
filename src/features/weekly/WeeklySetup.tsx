import { useState } from 'react';
import { Minus, Plus, UserRound, UsersRound } from 'lucide-react';
import type { SavedTable, WeeklyEpisode, WeeklyPlayMode } from './types';

interface WeeklySetupProps {
  episode: WeeklyEpisode;
  savedTable: SavedTable | null;
  challengeName: string | null;
  onStart: (details: {
    mode: WeeklyPlayMode;
    teamName: string;
    playerCount: number;
  }) => void;
}

export default function WeeklySetup({
  episode,
  savedTable,
  challengeName,
  onStart,
}: WeeklySetupProps) {
  const [mode, setMode] = useState<WeeklyPlayMode>(challengeName || savedTable ? 'table' : 'solo');
  const [teamName, setTeamName] = useState(savedTable?.teamName ?? 'The Groove Crew');
  const [playerCount, setPlayerCount] = useState(savedTable?.playerCount ?? 4);
  const [error, setError] = useState<string | null>(null);

  const handleStart = () => {
    const cleanTeamName = teamName.trim();
    if (mode === 'table' && cleanTeamName.length < 2) {
      setError('Give your table a name with at least two characters.');
      return;
    }
    setError(null);
    onStart({ mode, teamName: cleanTeamName, playerCount });
  };

  return (
    <section className="mx-auto w-full max-w-xl space-y-5" aria-labelledby="play-mode-heading">
      {challengeName && (
        <div className="rounded-2xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-cinema-800">
          <span className="font-bold text-primary">{challengeName}</span> challenged your table. Can you beat them?
        </div>
      )}

      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
          Episode {episode.episodeNumber}
        </p>
        <h1 id="play-mode-heading" className="mt-2 text-3xl font-bold text-white sm:text-4xl">
          How are you playing?
        </h1>
        <p className="mt-2 text-base text-cinema-600">
          One answer pad, one score. Gather a table or take it on yourself.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Play mode">
        <button
          type="button"
          role="radio"
          aria-checked={mode === 'solo'}
          onClick={() => {
            setMode('solo');
            setError(null);
          }}
          className={`min-h-32 cursor-pointer rounded-2xl border p-4 text-left transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary ${
            mode === 'solo'
              ? 'border-primary bg-primary/15 text-white'
              : 'border-cinema-200 bg-cinema-50 text-cinema-700 hover:border-primary/60'
          }`}
        >
          <UserRound className="h-7 w-7 text-primary" aria-hidden="true" />
          <span className="mt-4 block text-lg font-bold">Play solo</span>
          <span className="mt-1 block text-sm text-cinema-600">Your answers, your score</span>
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={mode === 'table'}
          onClick={() => {
            setMode('table');
            setError(null);
          }}
          className={`min-h-32 cursor-pointer rounded-2xl border p-4 text-left transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary ${
            mode === 'table'
              ? 'border-primary bg-primary/15 text-white'
              : 'border-cinema-200 bg-cinema-50 text-cinema-700 hover:border-primary/60'
          }`}
        >
          <UsersRound className="h-7 w-7 text-primary" aria-hidden="true" />
          <span className="mt-4 block text-lg font-bold">Play as a team</span>
          <span className="mt-1 block text-sm text-cinema-600">Debate, then lock one answer</span>
        </button>
      </div>

      {mode === 'table' && (
        <div className="space-y-4 rounded-2xl border border-cinema-200 bg-cinema-50 p-4">
          <div>
            <label htmlFor="weekly-team-name" className="mb-2 block text-sm font-bold text-cinema-800">
              Team name
            </label>
            <input
              id="weekly-team-name"
              type="text"
              value={teamName}
              onChange={(event) => {
                setTeamName(event.target.value.slice(0, 32));
                setError(null);
              }}
              autoComplete="off"
              placeholder="The Groove Crew"
              maxLength={32}
              className="min-h-12 w-full rounded-xl border border-cinema-200 bg-cinema px-4 text-base text-white outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div>
            <span className="mb-2 block text-sm font-bold text-cinema-800">People around the table</span>
            <div className="flex items-center justify-between rounded-xl border border-cinema-200 bg-cinema p-2">
              <button
                type="button"
                aria-label="Remove one player"
                onClick={() => setPlayerCount((count) => Math.max(2, count - 1))}
                disabled={playerCount <= 2}
                className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg border border-cinema-200 text-cinema-700 transition-colors hover:border-primary hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Minus className="h-5 w-5" aria-hidden="true" />
              </button>
              <div className="text-center" aria-live="polite">
                <div className="text-2xl font-black text-white">{playerCount}</div>
                <div className="text-xs text-cinema-500">players</div>
              </div>
              <button
                type="button"
                aria-label="Add one player"
                onClick={() => setPlayerCount((count) => Math.min(12, count + 1))}
                disabled={playerCount >= 12}
                className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg border border-cinema-200 text-cinema-700 transition-colors hover:border-primary hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Plus className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <p className="mt-2 text-xs text-cinema-500">Player count is just for fun. It never changes the score.</p>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleStart}
        className="min-h-12 w-full cursor-pointer rounded-xl bg-primary px-5 py-3 text-base font-black text-cinema shadow-glow transition-colors duration-200 hover:bg-primary-400 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-cinema"
      >
        {mode === 'table' ? 'Start the team quiz' : 'Start playing'}
      </button>
    </section>
  );
}
