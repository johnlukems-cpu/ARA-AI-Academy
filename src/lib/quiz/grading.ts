/** Pure quiz grading logic (unit tested in tests/grading.test.ts). */
import type { QuestionType } from "@/lib/types";

export type GradableQuestion = {
  id: string;
  type: QuestionType;
  points: number;
  options: { id: string; is_correct: boolean }[];
  accepted_answers?: Partial<Record<string, string[]>> | null;
};

export type Answer = string[] | string | null | undefined;
export type AnswerMap = Record<string, Answer>;

export type QuestionResult = { correct: boolean; earned: number; points: number };
export type GradeResult = {
  score: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
  results: Record<string, QuestionResult>;
};

/** Lowercase, trim, strip diacritics, collapse whitespace and trailing punctuation. */
export function normalizeText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[“”"'’`]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[.!?,;:]+$/g, "")
    .trim();
}

function asArray(a: Answer): string[] {
  if (Array.isArray(a)) return a.filter((x) => typeof x === "string");
  if (typeof a === "string" && a.length > 0) return [a];
  return [];
}

export function gradeQuestion(q: GradableQuestion, answer: Answer): QuestionResult {
  const points = Number(q.points) || 0;
  let correct = false;
  switch (q.type) {
    case "single_choice":
    case "true_false": {
      const picked = asArray(answer);
      const correctIds = q.options.filter((o) => o.is_correct).map((o) => o.id);
      correct = picked.length === 1 && correctIds.includes(picked[0]);
      break;
    }
    case "multiple_choice": {
      const picked = new Set(asArray(answer));
      const validIds = new Set(q.options.map((o) => o.id));
      const correctIds = new Set(q.options.filter((o) => o.is_correct).map((o) => o.id));
      const allValid = [...picked].every((id) => validIds.has(id));
      correct = allValid && picked.size === correctIds.size && [...correctIds].every((id) => picked.has(id));
      break;
    }
    case "short_answer": {
      const given = typeof answer === "string" ? normalizeText(answer) : "";
      const accepted = Object.values(q.accepted_answers ?? {})
        .flat()
        .filter((x): x is string => typeof x === "string")
        .map(normalizeText)
        .filter(Boolean);
      correct = given.length > 0 && accepted.includes(given);
      break;
    }
  }
  return { correct, earned: correct ? points : 0, points };
}

export function gradeAttempt(questions: GradableQuestion[], answers: AnswerMap, passingScore: number): GradeResult {
  const results: Record<string, QuestionResult> = {};
  let score = 0;
  let maxScore = 0;
  for (const q of questions) {
    const r = gradeQuestion(q, answers[q.id]);
    results[q.id] = r;
    score += r.earned;
    maxScore += r.points;
  }
  const percentage = maxScore > 0 ? Math.round((score / maxScore) * 10000) / 100 : 0;
  return { score, maxScore, percentage, passed: maxScore > 0 && percentage >= passingScore, results };
}

/** Fisher–Yates shuffle (returns a new array). */
export function shuffle<T>(items: T[], random: () => number = Math.random): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export type AttemptRules = {
  maxAttempts: number | null;
  retakeWaitHours: number;
  kind: "quiz" | "final_exam";
};

export type PastAttempt = { status: string; passed: boolean | null; submitted_at: string | null };

/** Decide whether a new attempt may start. */
export function canStartAttempt(rules: AttemptRules, past: PastAttempt[], now: Date = new Date()):
  | { ok: true }
  | { ok: false; reason: "quiz_no_attempts" | "quiz_wait" | "already_passed"; retryAt?: Date } {
  const finished = past.filter((a) => a.status !== "in_progress");
  if (rules.kind === "final_exam" && finished.some((a) => a.passed)) return { ok: false, reason: "already_passed" };
  if (rules.maxAttempts !== null && finished.length >= rules.maxAttempts) return { ok: false, reason: "quiz_no_attempts" };
  if (rules.retakeWaitHours > 0) {
    const last = finished
      .filter((a) => a.submitted_at)
      .sort((a, b) => new Date(b.submitted_at!).getTime() - new Date(a.submitted_at!).getTime())[0];
    if (last && !last.passed) {
      const retryAt = new Date(new Date(last.submitted_at!).getTime() + rules.retakeWaitHours * 3_600_000);
      if (retryAt > now) return { ok: false, reason: "quiz_wait", retryAt };
    }
  }
  return { ok: true };
}
