import { Check, ChevronLeft, ChevronRight, LockKeyhole } from 'lucide-react';
import type { WeeklyAttempt, WeeklyQuestion } from './types';

type QuestionPhase = 'waiting' | 'open' | 'revealed';

interface EpisodeAnswerPadProps {
  question: WeeklyQuestion;
  questionIndex: number;
  questionCount: number;
  attempt: WeeklyAttempt;
  selectedOptionIndex: number | null;
  phase: QuestionPhase;
  companionMode: boolean;
  onSelectOption: (optionIndex: number) => void;
  onLockAnswer: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onFinish: () => void;
}

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

export default function EpisodeAnswerPad({
  question,
  questionIndex,
  questionCount,
  attempt,
  selectedOptionIndex,
  phase,
  companionMode,
  onSelectOption,
  onLockAnswer,
  onPrevious,
  onNext,
  onFinish,
}: EpisodeAnswerPadProps) {
  const lockedAnswer = attempt.answers[question.id] ?? null;
  const canChoose = !lockedAnswer && phase === 'open';
  const isLastQuestion = questionIndex === questionCount - 1;
  const canFinish = isLastQuestion && phase === 'revealed';

  return (
    <section className="rounded-3xl border border-cinema-200 bg-cinema-50 p-4 shadow-cinema sm:p-6" aria-labelledby="weekly-question-heading">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
            Question {questionIndex + 1} of {questionCount}
          </p>
          <div className="mt-2 h-1.5 w-36 overflow-hidden rounded-full bg-cinema-200" aria-hidden="true">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-200"
              style={{ width: `${((questionIndex + 1) / questionCount) * 100}%` }}
            />
          </div>
        </div>
        {lockedAnswer && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-300">
            <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
            Locked in
          </span>
        )}
      </div>

      <h2 id="weekly-question-heading" className="text-xl font-bold leading-snug text-white sm:text-2xl">
        {question.prompt}
      </h2>

      {phase === 'waiting' && !lockedAnswer && (
        <p className="mt-3 rounded-xl border border-blue-400/30 bg-blue-400/10 px-3 py-2 text-sm text-blue-200">
          This question opens with the video. Stay inline and get your team ready.
        </p>
      )}
      {phase === 'revealed' && !lockedAnswer && (
        <p className="mt-3 rounded-xl border border-cinema-200 bg-cinema px-3 py-2 text-sm text-cinema-600">
          Time is up. This question was left unanswered.
        </p>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {question.options.map((option, optionIndex) => {
          const selected = lockedAnswer
            ? lockedAnswer.optionIndex === optionIndex
            : selectedOptionIndex === optionIndex;
          return (
            <button
              key={option}
              type="button"
              onClick={() => onSelectOption(optionIndex)}
              disabled={!canChoose}
              aria-pressed={selected}
              className={`flex min-h-16 cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed ${
                selected
                  ? 'border-primary bg-primary/15 text-white'
                  : 'border-cinema-200 bg-cinema text-cinema-800 hover:border-primary/60 disabled:opacity-60'
              }`}
            >
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-black ${
                selected ? 'border-primary bg-primary text-cinema' : 'border-cinema-200 text-cinema-600'
              }`}>
                {selected && lockedAnswer ? <Check className="h-5 w-5" aria-hidden="true" /> : OPTION_LABELS[optionIndex]}
              </span>
              <span className="text-base font-semibold leading-snug">{option}</span>
            </button>
          );
        })}
      </div>

      {!lockedAnswer && phase === 'open' && (
        <button
          type="button"
          onClick={onLockAnswer}
          disabled={selectedOptionIndex === null}
          className="mt-4 min-h-12 w-full cursor-pointer rounded-xl bg-primary px-5 py-3 font-black text-cinema transition-colors duration-200 hover:bg-primary-400 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-cinema-50 disabled:cursor-not-allowed disabled:bg-cinema-200 disabled:text-cinema-500"
        >
          Lock it in
        </button>
      )}

      {phase === 'revealed' && (
        <div className="mt-4 rounded-2xl border border-primary/30 bg-primary/10 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Answer</p>
          <p className="mt-1 font-bold text-white">{question.options[question.correctOptionIndex]}</p>
          <p className="mt-1 text-sm leading-relaxed text-cinema-700">{question.reveal}</p>
        </div>
      )}

      {companionMode && (
        <div className="mt-5 flex items-center gap-3 border-t border-cinema-200 pt-4">
          <button
            type="button"
            onClick={onPrevious}
            disabled={questionIndex === 0}
            className="flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-1 rounded-xl border border-cinema-200 px-3 font-semibold text-cinema-700 transition-colors hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            Previous
          </button>
          {isLastQuestion ? (
            <button
              type="button"
              onClick={onFinish}
              className="min-h-11 flex-1 cursor-pointer rounded-xl bg-primary px-3 font-black text-cinema transition-colors hover:bg-primary-400 focus:outline-none focus:ring-2 focus:ring-primary"
            >
              See our score
            </button>
          ) : (
            <button
              type="button"
              onClick={onNext}
              className="flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-1 rounded-xl border border-primary/60 px-3 font-semibold text-primary transition-colors hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-primary"
            >
              Next
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      {!companionMode && canFinish && (
        <button
          type="button"
          onClick={onFinish}
          className="mt-5 min-h-12 w-full cursor-pointer rounded-xl bg-primary px-5 py-3 font-black text-cinema transition-colors hover:bg-primary-400 focus:outline-none focus:ring-2 focus:ring-primary"
        >
          Finish and see our score
        </button>
      )}
    </section>
  );
}
