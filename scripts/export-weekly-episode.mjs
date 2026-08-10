import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const DEFAULT_SOURCE = resolve(
  SCRIPT_DIRECTORY,
  '../../hollywood-groove-controller/WeeklyEpisodes/blockbuster-movie-music-ep1-v2.json',
);
const DEFAULT_OUTPUT = resolve(
  SCRIPT_DIRECTORY,
  '../src/features/weekly/episodes/blockbuster-movie-music-ep1.json',
);

const DEFAULT_TIMING = Object.freeze({
  introSeconds: 30,
  roundIntroSeconds: 10,
  questionSeconds: 6,
  thinkingSeconds: 12,
  revealSeconds: 4,
  transitionSeconds: 2,
  roundBreakSeconds: 15,
  outroSeconds: 25,
});

const TOP_LEVEL_KEYS = new Set([
  'slug',
  'version',
  'episodeNumber',
  'title',
  'strapline',
  'questions',
]);
const QUESTION_KEYS = new Set([
  'id',
  'prompt',
  'options',
  'correctOptionIndex',
  'reveal',
  'opensAtSeconds',
  'revealAtSeconds',
]);

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value;
}

function requireString(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function requireInteger(value, label, minimum = 0) {
  if (!Number.isInteger(value) || value < minimum) {
    throw new Error(`${label} must be an integer of at least ${minimum}`);
  }
  return value;
}

function requireDuration(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a finite number of at least zero`);
  }
  return value;
}

function resolveDuration(questionTiming, roundTiming, episodeTiming, key) {
  return requireDuration(
    questionTiming[key] ?? roundTiming[key] ?? episodeTiming[key],
    `timing.${key}`,
  );
}

function assertProjectionShape(projection) {
  for (const key of Object.keys(projection)) {
    if (!TOP_LEVEL_KEYS.has(key)) {
      throw new Error(`Unsafe or unsupported projected episode field: ${key}`);
    }
  }

  for (const [index, question] of projection.questions.entries()) {
    for (const key of Object.keys(question)) {
      if (!QUESTION_KEYS.has(key)) {
        throw new Error(`Unsafe or unsupported projected question field at ${index}: ${key}`);
      }
    }
  }
}

/**
 * Mirrors WeeklyStudioTimelineCompiler with programme time starting at 0.
 * The answer window opens at the question segment and closes when the reveal
 * segment starts. Only answer-pad text and those two cue times are projected.
 */
export function projectEpisode(sourceValue) {
  const source = requireObject(sourceValue, 'episode');
  const episodeTiming = {
    ...DEFAULT_TIMING,
    ...requireObject(source.timing ?? {}, 'episode.timing'),
  };
  if (!Array.isArray(source.rounds) || source.rounds.length === 0) {
    throw new Error('episode.rounds must be a non-empty array');
  }

  let cursor = requireDuration(episodeTiming.introSeconds, 'timing.introSeconds');
  const questions = [];

  source.rounds.forEach((roundValue, roundIndex) => {
    const round = requireObject(roundValue, `rounds[${roundIndex}]`);
    const roundTiming = requireObject(round.timing ?? {}, `rounds[${roundIndex}].timing`);
    if (!Array.isArray(round.questions) || round.questions.length === 0) {
      throw new Error(`rounds[${roundIndex}].questions must be a non-empty array`);
    }

    cursor += requireDuration(
      roundTiming.introSeconds ?? episodeTiming.roundIntroSeconds,
      `rounds[${roundIndex}].introSeconds`,
    );

    round.questions.forEach((questionValue, questionIndex) => {
      const question = requireObject(
        questionValue,
        `rounds[${roundIndex}].questions[${questionIndex}]`,
      );
      const questionTiming = requireObject(
        question.timing ?? {},
        `rounds[${roundIndex}].questions[${questionIndex}].timing`,
      );
      if (!Array.isArray(question.options) || question.options.length < 2) {
        throw new Error(
          `rounds[${roundIndex}].questions[${questionIndex}].options must contain at least two items`,
        );
      }
      const options = question.options.map((option, optionIndex) => requireString(
        option,
        `rounds[${roundIndex}].questions[${questionIndex}].options[${optionIndex}]`,
      ));
      const correctOptionIndex = requireInteger(
        question.correctOptionIndex,
        `rounds[${roundIndex}].questions[${questionIndex}].correctOptionIndex`,
      );
      if (correctOptionIndex >= options.length) {
        throw new Error(
          `rounds[${roundIndex}].questions[${questionIndex}].correctOptionIndex is out of range`,
        );
      }

      const questionSeconds = resolveDuration(
        questionTiming,
        roundTiming,
        episodeTiming,
        'questionSeconds',
      );
      const thinkingSeconds = resolveDuration(
        questionTiming,
        roundTiming,
        episodeTiming,
        'thinkingSeconds',
      );
      const revealSeconds = resolveDuration(
        questionTiming,
        roundTiming,
        episodeTiming,
        'revealSeconds',
      );
      const transitionSeconds = resolveDuration(
        questionTiming,
        roundTiming,
        episodeTiming,
        'transitionSeconds',
      );

      if (questionSeconds + thinkingSeconds <= 0) {
        throw new Error(
          `rounds[${roundIndex}].questions[${questionIndex}] needs question or thinking screen time`,
        );
      }
      if (revealSeconds <= 0) {
        throw new Error(
          `rounds[${roundIndex}].questions[${questionIndex}] needs positive reveal screen time`,
        );
      }

      const opensAtSeconds = cursor;
      const revealAtSeconds = opensAtSeconds + questionSeconds + thinkingSeconds;
      questions.push({
        id: requireString(question.id, `rounds[${roundIndex}].questions[${questionIndex}].id`),
        prompt: requireString(
          question.prompt,
          `rounds[${roundIndex}].questions[${questionIndex}].prompt`,
        ),
        options,
        correctOptionIndex,
        reveal: requireString(
          question.reveal,
          `rounds[${roundIndex}].questions[${questionIndex}].reveal`,
        ),
        opensAtSeconds,
        revealAtSeconds,
      });

      cursor = revealAtSeconds + revealSeconds;
      if (questionIndex < round.questions.length - 1) {
        cursor += transitionSeconds;
      }
    });

    if (roundIndex < source.rounds.length - 1) {
      cursor += requireDuration(
        roundTiming.breakAfterSeconds ?? episodeTiming.roundBreakSeconds,
        `rounds[${roundIndex}].breakAfterSeconds`,
      );
    }
  });

  // Validate the final segment too, even though duration is intentionally not
  // exported to the public answer-pad data.
  requireDuration(episodeTiming.outroSeconds, 'timing.outroSeconds');

  const projection = {
    slug: requireString(source.slug, 'episode.slug'),
    version: requireInteger(source.version ?? 1, 'episode.version', 1),
    episodeNumber: requireInteger(source.episodeNumber, 'episode.episodeNumber', 1),
    title: requireString(source.title, 'episode.title'),
    strapline: typeof source.strapline === 'string' ? source.strapline : '',
    questions,
  };
  assertProjectionShape(projection);
  return projection;
}

export function serialiseProjection(projection) {
  return `${JSON.stringify(projection, null, 2)}\n`;
}

function parseArguments(argumentsList) {
  const options = {
    source: DEFAULT_SOURCE,
    output: DEFAULT_OUTPUT,
    check: false,
  };
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === '--check') {
      options.check = true;
    } else if (argument === '--source' || argument === '--output') {
      const value = argumentsList[index + 1];
      if (!value) throw new Error(`${argument} requires a path`);
      options[argument.slice(2)] = resolve(value);
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  return options;
}

async function run() {
  const options = parseArguments(process.argv.slice(2));
  const source = JSON.parse(await readFile(options.source, 'utf8'));
  const output = serialiseProjection(projectEpisode(source));

  if (options.check) {
    const existing = await readFile(options.output, 'utf8');
    if (existing !== output) {
      throw new Error(`Weekly episode projection is stale: ${options.output}`);
    }
    console.log(`Weekly episode projection is current: ${options.output}`);
    return;
  }

  await mkdir(dirname(options.output), { recursive: true });
  await writeFile(options.output, output, 'utf8');
  console.log(`Wrote ${options.output}`);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
