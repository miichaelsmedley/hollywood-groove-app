import { Link } from 'react-router-dom';
import { Calendar, Music, Sparkles } from 'lucide-react';

export default function Home() {
  return (
    <div className="mx-auto max-w-md space-y-6">
      <section className="text-center space-y-3">
        <h1 className="text-4xl sm:text-5xl font-bold">
          Welcome to <span className="text-primary font-display">Hollywood Groove</span>
        </h1>
      </section>

      <section className="space-y-3">
        <Link
          to="/join"
          className="block w-full rounded-2xl bg-primary px-5 py-4 text-cinema font-bold shadow-glow-lg active:scale-[0.99] transition"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-lg leading-tight">Join current show</div>
              <div className="text-sm font-semibold opacity-80">Play trivia and see your score</div>
            </div>
            <Sparkles className="h-6 w-6" />
          </div>
        </Link>

        <Link
          to="/upcoming"
          className="block w-full rounded-2xl bg-cinema-50 border border-cinema-200 px-5 py-4 font-semibold text-cinema-900 hover:border-primary/60 transition"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-lg leading-tight">Upcoming events</div>
              <div className="text-sm text-cinema-500">See what’s on next</div>
            </div>
            <Calendar className="h-6 w-6 text-primary" />
          </div>
        </Link>

        <Link
          to="/shows"
          className="block w-full rounded-2xl bg-cinema-50 border border-cinema-200 px-5 py-4 font-semibold text-cinema-900 hover:border-primary/60 transition"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-lg leading-tight">Shows</div>
              <div className="text-sm text-cinema-500">All shows (past and upcoming)</div>
            </div>
            <Music className="h-6 w-6 text-primary" />
          </div>
        </Link>
      </section>
    </div>
  );
}
