import type { WeeklyEpisode } from './types';

const configuredVideoId = (import.meta.env.VITE_WEEKLY_EPISODE_01_YOUTUBE_ID ?? '').trim();
const youtubeVideoId = /^[A-Za-z0-9_-]{11}$/.test(configuredVideoId)
  ? configuredVideoId
  : null;

export const WEEKLY_PREVIEW_ENABLED =
  import.meta.env.DEV || import.meta.env.VITE_ENABLE_E2E_FIXTURES === 'true';

export const BLOCKBUSTER_MOVIE_MUSIC_EPISODE: WeeklyEpisode = {
  slug: 'blockbuster-movie-music-01',
  version: 1,
  episodeNumber: 1,
  title: 'Blockbuster Movie Music',
  strapline: 'Ten questions. Two decades. One team score.',
  youtubeVideoId,
  questions: [
    {
      id: 'q1',
      prompt: 'At the 1987 Academy Awards, “Take My Breath Away” won Original Song for which film?',
      options: ['Flashdance', 'Top Gun', 'Footloose', 'Dirty Dancing'],
      correctOptionIndex: 1,
      reveal: 'Top Gun. Giorgio Moroder wrote the music and Tom Whitlock the lyric.',
      opensAtSeconds: 165,
      revealAtSeconds: 210,
    },
    {
      id: 'q2',
      prompt: 'Which film placed two different songs among the Original Song nominees at the 1985 Oscars?',
      options: ['Ghostbusters', 'Purple Rain', 'Footloose', 'Beverly Hills Cop'],
      correctOptionIndex: 2,
      reveal: 'Footloose. Its title song and “Let’s Hear It for the Boy” were both nominated.',
      opensAtSeconds: 225,
      revealAtSeconds: 270,
    },
    {
      id: 'q3',
      prompt: '“The Power of Love” earned an Original Song nomination after appearing in which film?',
      options: ['Back to the Future', 'The Karate Kid', 'The Goonies', 'Beverly Hills Cop'],
      correctOptionIndex: 0,
      reveal: 'Back to the Future. The credited writers were Chris Hayes, Johnny Colla and Huey Lewis.',
      opensAtSeconds: 285,
      revealAtSeconds: 330,
    },
    {
      id: 'q4',
      prompt: 'Which song from Dirty Dancing won Original Song at the 1988 Oscars?',
      options: ['Shakedown', 'Storybook Love', 'Nothing’s Gonna Stop Us Now', '(I’ve Had) The Time of My Life'],
      correctOptionIndex: 3,
      reveal: '“(I’ve Had) The Time of My Life.” Dirty Dancing converted its one nomination into one win.',
      opensAtSeconds: 345,
      revealAtSeconds: 390,
    },
    {
      id: 'q5',
      prompt: 'Which artist connects Purple Rain’s Oscar-winning Original Song Score with the album made for Tim Burton’s 1989 Batman?',
      options: ['David Bowie', 'Prince', 'George Michael', 'Phil Collins'],
      correctOptionIndex: 1,
      reveal: 'Prince. He won for Purple Rain, then created a nine-track Batman album.',
      opensAtSeconds: 405,
      revealAtSeconds: 450,
    },
    {
      id: 'q6',
      prompt: 'Which composer wrote the scores for both Home Alone and Jurassic Park?',
      options: ['Alan Silvestri', 'Danny Elfman', 'John Williams', 'James Horner'],
      correctOptionIndex: 2,
      reveal: 'John Williams. From suburban Christmas panic to prehistoric theme-park panic.',
      opensAtSeconds: 560,
      revealAtSeconds: 605,
    },
    {
      id: 'q7',
      prompt: 'Which film soundtrack won Album of the Year at the 1994 Grammys?',
      options: ['The Bodyguard', 'Aladdin', 'Sleepless in Seattle', 'Jurassic Park'],
      correctOptionIndex: 0,
      reveal: 'The Bodyguard. Whitney Houston also won Record of the Year that night.',
      opensAtSeconds: 620,
      revealAtSeconds: 665,
    },
    {
      id: 'q8',
      prompt: 'At the 1995 Oscars, how many of the five Original Song nominees came from The Lion King?',
      options: ['One', 'Two', 'Three', 'Four'],
      correctOptionIndex: 2,
      reveal: 'Three: “Can You Feel the Love Tonight,” “Circle of Life” and “Hakuna Matata.”',
      opensAtSeconds: 680,
      revealAtSeconds: 725,
    },
    {
      id: 'q9',
      prompt: 'Which Men in Black star won the 1998 Grammy for Best Rap Solo Performance with the film’s title track?',
      options: ['Ice Cube', 'LL Cool J', 'Queen Latifah', 'Will Smith'],
      correctOptionIndex: 3,
      reveal: 'Will Smith. The movie star and recording artist were the same person.',
      opensAtSeconds: 740,
      revealAtSeconds: 785,
    },
    {
      id: 'q10',
      prompt: 'Which band recorded Armageddon’s Oscar-nominated “I Don’t Want to Miss a Thing”?',
      options: ['Bon Jovi', 'Aerosmith', 'Def Leppard', 'Journey'],
      correctOptionIndex: 1,
      reveal: 'Aerosmith. Diane Warren wrote the song.',
      opensAtSeconds: 800,
      revealAtSeconds: 845,
    },
  ],
};

const EPISODES: readonly WeeklyEpisode[] = [BLOCKBUSTER_MOVIE_MUSIC_EPISODE];

export function getWeeklyEpisode(slug: string | undefined): WeeklyEpisode | null {
  if (!slug) return null;
  return EPISODES.find((episode) => episode.slug === slug) ?? null;
}

export function getLatestWeeklyEpisode(): WeeklyEpisode {
  return EPISODES[0];
}

export function isWeeklyEpisodePlayable(episode: WeeklyEpisode): boolean {
  return Boolean(episode.youtubeVideoId) || WEEKLY_PREVIEW_ENABLED;
}
