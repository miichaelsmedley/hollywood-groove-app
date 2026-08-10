import episodeOneProjection from './episodes/blockbuster-movie-music-ep1.json';
import type { WeeklyEpisode } from './types';

const configuredVideoId = (import.meta.env.VITE_WEEKLY_EPISODE_01_YOUTUBE_ID ?? '').trim();
const youtubeVideoId = /^[A-Za-z0-9_-]{11}$/.test(configuredVideoId)
  ? configuredVideoId
  : null;

export const WEEKLY_PREVIEW_ENABLED =
  import.meta.env.DEV || import.meta.env.VITE_ENABLE_E2E_FIXTURES === 'true';

export const BLOCKBUSTER_MOVIE_MUSIC_EPISODE: WeeklyEpisode = {
  ...episodeOneProjection,
  youtubeVideoId,
};

const EPISODES: readonly WeeklyEpisode[] = [BLOCKBUSTER_MOVIE_MUSIC_EPISODE];

// Keep the original beta URL working after aligning the public route with the
// canonical Controller episode slug.
const SLUG_ALIASES: Readonly<Record<string, string>> = {
  'blockbuster-movie-music-01': 'blockbuster-movie-music-ep1',
};

export function getWeeklyEpisode(slug: string | undefined): WeeklyEpisode | null {
  if (!slug) return null;
  const canonicalSlug = SLUG_ALIASES[slug] ?? slug;
  return EPISODES.find((episode) => episode.slug === canonicalSlug) ?? null;
}

export function getLatestWeeklyEpisode(): WeeklyEpisode {
  return EPISODES[0];
}

export function isWeeklyEpisodePlayable(episode: WeeklyEpisode): boolean {
  return Boolean(episode.youtubeVideoId) || WEEKLY_PREVIEW_ENABLED;
}
