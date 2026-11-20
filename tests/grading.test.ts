import { describe, expect, it } from "vitest";
import { canStartAttempt, gradeAttempt, gradeQuestion, normalizeText, shuffle, type GradableQuestion } from "@/lib/quiz/grading";

const single: GradableQuestion = { id: "q1", type: "single_choice", points: 1, options: [{ id: "a", is_correct: false }, { id: "b", is_correct: true }] };
const tf: GradableQuestion = { id: "q2", type: "true_false", points: 1, options: [{ id: "t", is_correct: true }, { id: "f", is_correct: false }] };
const multi: GradableQuestion = { id: "q3", type: "multiple_choice", points: 2, options: [{ id: "x", is_correct: true }, { id: "y", is_correct: true }, { id: "z", is_correct: false }] };
const short: GradableQuestion = { id: "q4", type: "short_answer", points: 1, options: [], accepted_answers: { nl: ["Kunstmatige intelligentie"], en: ["Artificial intelligence", "AI"] } };

describe("normalizeText", () => {
  it("ignores case, accents, quotes, spacing and trailing punctuation", () => {
    expect(normalizeText("  Kunstmatige   Intelligéntie! ")).toBe("kunstmatige intelligentie");
    expect(normalizeText("“AI”.")).toBe("ai");
  });
});

describe("gradeQuestion", () => {
  it("single choice / true-false: exactly the correct option", () => {
    expect(gradeQuestion(single, "b").correct).toBe(true);
    expect(gradeQuestion(single, "a").correct).toBe(false);
    expect(gradeQuestion(single, ["a", "b"]).correct).toBe(false);
    expect(gradeQuestion(tf, "t").earned).toBe(1);
    expect(gradeQuestion(tf, undefined).earned).toBe(0);
  });
  it("multiple choice: all correct and nothing else (no partial credit)", () => {
    expect(gradeQuestion(multi, ["y", "x"]).earned).toBe(2);
    expect(gradeQuestion(multi, ["x"]).correct).toBe(false);
    expect(gradeQuestion(multi, ["x", "y", "z"]).correct).toBe(false);
    expect(gradeQuestion(multi, ["x", "y", "forged"]).correct).toBe(false);
  });
  it("short answer: any accepted answer in any language", () => {
    expect(gradeQuestion(short, "kunstmatige intelligentie").correct).toBe(true);
    expect(gradeQuestion(short, "ai").correct).toBe(true);
    expect(gradeQuestion(short, "machine learning").correct).toBe(false);
    expect(gradeQuestion(short, "").correct).toBe(false);
  });
});

describe("gradeAttempt", () => {
  it("computes score, percentage and pass/fail at the passing score boundary", () => {
    const qs = [single, tf, multi, short]; // 5 points
    const r = gradeAttempt(qs, { q1: "b", q2: "t", q3: ["x", "y"], q4: "wrong" }, 70);
    expect(r.score).toBe(4);
    expect(r.maxScore).toBe(5);
    expect(r.percentage).toBe(80);
    expect(r.passed).toBe(true);
    expect(gradeAttempt(qs, { q1: "b", q3: ["x", "y"] }, 70).percentage).toBe(60);
    expect(gradeAttempt(qs, { q1: "b", q3: ["x", "y"] }, 70).passed).toBe(false);
    expect(gradeAttempt([single, tf], { q1: "b" }, 50).passed).toBe(true); // exactly 50%
  });
  it("an empty quiz never passes", () => {
    expect(gradeAttempt([], {}, 70).passed).toBe(false);
  });
});

describe("shuffle", () => {
  it("returns a permutation without mutating the input", () => {
    const input = [1, 2, 3, 4, 5];
    const out = shuffle(input, () => 0.3);
    expect(out.sort()).toEqual([1, 2, 3, 4, 5]);
    expect(input).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("canStartAttempt", () => {
  const now = new Date("2026-11-20T12:00:00Z");
  const failed = (h: number) => ({ status: "submitted", passed: false, submitted_at: new Date(now.getTime() - h * 3_600_000).toISOString() });
  it("blocks a retake after the final exam was passed", () => {
    const r = canStartAttempt({ maxAttempts: null, retakeWaitHours: 0, kind: "final_exam" }, [{ status: "submitted", passed: true, submitted_at: now.toISOString() }], now);
    expect(r).toEqual({ ok: false, reason: "already_passed" });
  });
  it("enforces the maximum number of attempts", () => {
    const r = canStartAttempt({ maxAttempts: 2, retakeWaitHours: 0, kind: "final_exam" }, [failed(50), failed(30)], now);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("quiz_no_attempts");
  });
  it("enforces the retake waiting period", () => {
    const r = canStartAttempt({ maxAttempts: 3, retakeWaitHours: 24, kind: "final_exam" }, [failed(5)], now);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("quiz_wait");
      expect(r.retryAt?.toISOString()).toBe("2026-11-21T07:00:00.000Z");
    }
    expect(canStartAttempt({ maxAttempts: 3, retakeWaitHours: 24, kind: "final_exam" }, [failed(25)], now).ok).toBe(true);
  });
  it("ignores an attempt that is still in progress when counting", () => {
    expect(canStartAttempt({ maxAttempts: 1, retakeWaitHours: 0, kind: "quiz" }, [{ status: "in_progress", passed: null, submitted_at: null }], now).ok).toBe(true);
  });
});
