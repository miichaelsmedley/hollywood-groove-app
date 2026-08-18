import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { projectEpisode, serialiseProjection } from './export-weekly-episode.mjs';

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const GENERATED_EPISODE_PATH = resolve(
  SCRIPT_DIRECTORY,
  '../src/features/weekly/episodes/blockbuster-movie-music-ep1.json',
);
const CONTROLLER_EPISODE_PATH = resolve(
  SCRIPT_DIRECTORY,
  '../../hollywood-groove-controller/WeeklyEpisodes/blockbuster-movie-music-ep1-v2.json',
);

const TOP_LEVEL_KEYS = [
  'episodeNumber',
  'questions',
  'slug',
  'strapline',
  'title',
  'version',
];
const QUESTION_KEYS = [
  'correctOptionIndex',
  'id',
  'opensAtSeconds',
  'options',
  'prompt',
  'reveal',
  'revealAtSeconds',
];

test('projection mirrors Controller timing precedence and drops private production data', () => {
  const source = {
    slug: 'test-episode',
    version: 3,
    episodeNumber: 7,
    title: 'Test episode',
    strapline: 'Safe projection',
    programmeImage: { path: '/private/episode.png', sha256: 'secret' },
    timing: {
      introSeconds: 10,
      roundIntroSeconds: 5,
      questionSeconds: 6,
      thinkingSeconds: 7,
      revealSeconds: 4,
      transitionSeconds: 0,
      roundBreakSeconds: 0,
      outroSeconds: 9,
    },
    rounds: [{
      id: 'round-1',
      title: 'Round 1',
      timing: { questionSeconds: 8 },
      questions: [{
        id: 'q1',
        prompt: 'Question one?',
        options: ['Correct', 'Wrong'],
        correctOptionIndex: 0,
        reveal: 'Correct.',
        programmeImage: {
          path: 'Assets/private.png',
          sha256: 'abc123',
          mediaBytes: 'not-public',
        },
        source: { url: 'https://example.test/private' },
        timing: { thinkingSeconds: 11 },
      }, {
        id: 'q2',
        prompt: 'Question two?',
        options: ['Wrong', 'Correct'],
        correctOptionIndex: 1,
        reveal: 'Also correct.',
        timing: {},
      }],
    }],
  };

  const projection = projectEpisode(source);
  assert.deepEqual(Object.keys(projection).sort(), TOP_LEVEL_KEYS);
  assert.deepEqual(Object.keys(projection.questions[0]).sort(), QUESTION_KEYS);
  assert.deepEqual(projection.questions.map((question) => [
    question.opensAtSeconds,
    question.revealAtSeconds,
  ]), [[15, 34], [38, 53]]);

  const serialised = serialiseProjection(projection);
  assert.doesNotMatch(serialised, /programmeImage|sha256|mediaBytes|private\.png|example\.test/);
});

test('projection rejects an all-A weekly answer layout', () => {
  const source = {
    slug: 'biased-episode',
    version: 1,
    episodeNumber: 1,
    title: 'Biased episode',
    timing: {},
    rounds: [{
      id: 'round-1',
      title: 'Round 1',
      timing: {},
      questions: Array.from({ length: 4 }, (_, index) => ({
        id: `q${index + 1}`,
        prompt: `Question ${index + 1}?`,
        options: ['Correct', 'Wrong 1', 'Wrong 2', 'Wrong 3'],
        correctOptionIndex: 0,
        reveal: 'Correct.',
        timing: {},
      })),
    }],
  };

  assert.throws(
    () => projectEpisode(source),
    /A=4, B=0, C=0, D=0/,
  );
});

test('checked-in Episode 1 projection is 40 questions and uses programme t=0 cues', async () => {
  const episode = JSON.parse(await readFile(GENERATED_EPISODE_PATH, 'utf8'));
  assert.equal(episode.slug, 'blockbuster-movie-music-ep1');
  assert.equal(episode.version, 3);
  assert.equal(episode.questions.length, 40);
  assert.deepEqual(
    [0, 1, 2, 3].map(
      (position) => episode.questions.filter(
        (question) => question.correctOptionIndex === position,
      ).length,
    ),
    [10, 10, 10, 10],
  );
  assert.deepEqual(Object.keys(episode).sort(), TOP_LEVEL_KEYS);
  episode.questions.forEach((question) => {
    assert.deepEqual(Object.keys(question).sort(), QUESTION_KEYS);
  });
  assert.deepEqual(
    [episode.questions[0].opensAtSeconds, episode.questions[0].revealAtSeconds],
    [40, 58],
  );
  assert.deepEqual(
    [episode.questions[39].opensAtSeconds, episode.questions[39].revealAtSeconds],
    [1045, 1063],
  );
  assert.doesNotMatch(
    JSON.stringify(episode),
    /programmeImage|cameraTreatment|sha256|mediaBytes|Assets\//,
  );
});

test(
  'checked-in Episode 1 projection matches the sibling Controller pack when available',
  { skip: !existsSync(CONTROLLER_EPISODE_PATH) },
  async () => {
    const source = JSON.parse(await readFile(CONTROLLER_EPISODE_PATH, 'utf8'));
    const generated = await readFile(GENERATED_EPISODE_PATH, 'utf8');
    assert.equal(generated, serialiseProjection(projectEpisode(source)));
  },
);
