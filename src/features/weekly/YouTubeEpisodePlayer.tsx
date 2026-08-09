import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';

interface PlayerInstance {
  destroy: () => void;
  getCurrentTime: () => number;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
}

interface PlayerEvent {
  target: PlayerInstance;
}

interface PlayerStateEvent extends PlayerEvent {
  data: number;
}

interface PlayerOptions {
  videoId: string;
  host?: string;
  playerVars: Record<string, string | number>;
  events: {
    onReady: (event: PlayerEvent) => void;
    onStateChange: (event: PlayerStateEvent) => void;
    onError: () => void;
    onAutoplayBlocked?: () => void;
  };
}

interface YouTubeApi {
  Player: new (element: HTMLElement, options: PlayerOptions) => PlayerInstance;
}

declare global {
  interface Window {
    YT?: YouTubeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let youtubeApiPromise: Promise<YouTubeApi> | null = null;

function loadYouTubeApi(): Promise<YouTubeApi> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubeApiPromise) return youtubeApiPromise;

  youtubeApiPromise = new Promise<YouTubeApi>((resolve, reject) => {
    const previousReady = window.onYouTubeIframeAPIReady;
    let script = document.querySelector<HTMLScriptElement>(
      'script[data-hg-youtube-api="true"]',
    );
    const timeout = window.setTimeout(() => {
      youtubeApiPromise = null;
      script?.remove();
      reject(new Error('The YouTube player took too long to load. Open the video on YouTube and use this screen as the answer pad.'));
    }, 15_000);
    const handleReady = () => {
      previousReady?.();
      if (window.YT?.Player) {
        window.clearTimeout(timeout);
        resolve(window.YT);
      } else {
        window.clearTimeout(timeout);
        youtubeApiPromise = null;
        reject(new Error('YouTube player API did not initialise.'));
      }
    };
    window.onYouTubeIframeAPIReady = handleReady;

    if (script) return;

    script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.dataset.hgYoutubeApi = 'true';
    script.addEventListener('error', () => {
      window.clearTimeout(timeout);
      youtubeApiPromise = null;
      script?.remove();
      reject(new Error('The YouTube player could not be loaded.'));
    });
    document.head.appendChild(script);
  });

  return youtubeApiPromise;
}

interface YouTubeEpisodePlayerProps {
  videoId: string;
  title: string;
  initialSeconds: number;
  onPlaybackSeconds: (seconds: number) => void;
  onPlayingChange: (playing: boolean) => void;
  fixtureClock?: boolean;
}

export interface YouTubeEpisodePlayerHandle {
  getCurrentTime: () => number;
}

const YouTubeEpisodePlayer = forwardRef<YouTubeEpisodePlayerHandle, YouTubeEpisodePlayerProps>(function YouTubeEpisodePlayer({
  videoId,
  title,
  initialSeconds,
  onPlaybackSeconds,
  onPlayingChange,
  fixtureClock = false,
}, forwardedRef) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<PlayerInstance | null>(null);
  const initialSecondsRef = useRef(initialSeconds);
  const secondsCallbackRef = useRef(onPlaybackSeconds);
  const playingCallbackRef = useRef(onPlayingChange);
  const fixtureSecondsRef = useRef(initialSeconds);
  const [fixtureSeconds, setFixtureSeconds] = useState(initialSeconds);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  secondsCallbackRef.current = onPlaybackSeconds;
  playingCallbackRef.current = onPlayingChange;

  useImperativeHandle(forwardedRef, () => ({
    getCurrentTime: () => playerRef.current?.getCurrentTime() ?? fixtureSecondsRef.current,
  }), []);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let disposed = false;
    let pollTimer: number | null = null;

    if (fixtureClock) {
      setReady(true);
      playingCallbackRef.current(false);
      return () => playingCallbackRef.current(false);
    }

    const samplePlayback = () => {
      const player = playerRef.current;
      if (!player || document.visibilityState === 'hidden') return;
      const seconds = player.getCurrentTime();
      if (Number.isFinite(seconds)) secondsCallbackRef.current(seconds);
    };

    void loadYouTubeApi()
      .then((api) => {
        if (disposed) return;
        playerRef.current = new api.Player(mount, {
          videoId,
          host: 'https://www.youtube-nocookie.com',
          playerVars: {
            controls: 1,
            enablejsapi: 1,
            fs: 1,
            origin: window.location.origin,
            playsinline: 1,
            rel: 0,
          },
          events: {
            onReady: (event) => {
              if (disposed) return;
              if (initialSecondsRef.current > 1) {
                event.target.seekTo(initialSecondsRef.current, false);
              }
              setReady(true);
              samplePlayback();
              pollTimer = window.setInterval(samplePlayback, 250);
            },
            onStateChange: (event) => {
              const playing = event.data === 1;
              playingCallbackRef.current(playing);
              samplePlayback();
            },
            onError: () => {
              setError('This video is unavailable in the embedded player.');
            },
            onAutoplayBlocked: () => {
              playingCallbackRef.current(false);
            },
          },
        });
      })
      .catch((loadError: unknown) => {
        if (disposed) return;
        setError(loadError instanceof Error ? loadError.message : 'The video could not be loaded.');
      });

    const sampleOnReturn = () => samplePlayback();
    document.addEventListener('visibilitychange', sampleOnReturn);
    window.addEventListener('focus', sampleOnReturn);

    return () => {
      disposed = true;
      if (pollTimer !== null) window.clearInterval(pollTimer);
      document.removeEventListener('visibilitychange', sampleOnReturn);
      window.removeEventListener('focus', sampleOnReturn);
      playingCallbackRef.current(false);
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [fixtureClock, videoId]);

  const setFixtureTime = (seconds: number) => {
    fixtureSecondsRef.current = seconds;
    setFixtureSeconds(seconds);
    secondsCallbackRef.current(seconds);
    playingCallbackRef.current(false);
  };

  if (fixtureClock) {
    return (
      <div className="min-h-[200px] w-full rounded-2xl border border-dashed border-primary/50 bg-cinema-50 p-4" data-testid="weekly-player-fixture">
        <p className="text-sm font-bold text-primary">Playback fixture · {formatFixtureTime(fixtureSeconds)}</p>
        <p className="mt-1 text-xs text-cinema-500">Test-only controls for reveal and seek behaviour.</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {[
            ['Q1 opens', 165],
            ['Q1 reveals', 210],
            ['Q10 opens', 800],
            ['Q10 reveals', 845],
            ['Rewind to Q1', 165],
          ].map(([label, seconds]) => (
            <button
              key={label}
              type="button"
              onClick={() => setFixtureTime(Number(seconds))}
              className="min-h-11 cursor-pointer rounded-lg border border-cinema-200 px-2 text-xs font-bold text-cinema-700 focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="relative aspect-video min-h-[200px] w-full overflow-hidden rounded-2xl border border-cinema-200 bg-black shadow-cinema">
      <div ref={mountRef} className="h-full w-full" aria-label={`${title} video player`} />
      {!ready && !error && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black text-cinema-700">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden="true" />
            Loading video…
          </div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-cinema px-6 text-center">
          <p className="text-sm text-cinema-700">{error}</p>
          <a
            href={`https://www.youtube.com/watch?v=${videoId}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-primary/60 px-4 py-2 font-semibold text-primary focus:outline-none focus:ring-2 focus:ring-primary"
          >
            Open on YouTube
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>
      )}
    </div>
  );
});

function formatFixtureTime(seconds: number): string {
  const wholeSeconds = Math.max(0, Math.floor(seconds));
  return `${Math.floor(wholeSeconds / 60)}:${String(wholeSeconds % 60).padStart(2, '0')}`;
}

export default YouTubeEpisodePlayer;
