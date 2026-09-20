import { describe, expect, it } from "vitest";
import type { Analytics, Question, QuestionStats } from "../../api/types";
import {
  barPct,
  chartTitle,
  hasEstimates,
  overviewTiles,
  questionBars,
  selectFinding,
  topCategories,
} from "./analytics-view";

const stats = (overrides: Partial<QuestionStats> = {}): QuestionStats => ({
  assessed_students: 6,
  flagged_students: 0,
  assessment_modes: ["fixture"],
  scored_students: 6,
  mean_score: 4,
  students_by_category: {},
  rubric_ids: ["rub_1"],
  ...overrides,
});

const questions: Question[] = [
  { id: "q1", title: "Solve the system", prompt: "", max_points: 8 },
  { id: "q2", title: "Rank and nullity", prompt: "", max_points: 6 },
];

const analytics = (overrides: Partial<Analytics> = {}): Analytics => ({
  students_with_attempts: 6,
  final_submissions: 4,
  reviewed: 1,
  released: 1,
  open_reports: 1,
  questions: [
    {
      question_id: "q1",
      max_points: 8,
      first: stats({ mean_score: 4.5, students_by_category: { presentation: 3, notation: 3, arithmetic: 2 } }),
      latest: stats({
        mean_score: 3.333333,
        students_by_category: { presentation: 4, notation: 5, arithmetic: 2 },
      }),
    },
    {
      question_id: "q2",
      max_points: 6,
      first: stats({ mean_score: 4.166667 }),
      latest: stats({ mean_score: 4.666667 }),
    },
  ],
  interpretation: "Recorded feedback, not a measurement of learning. Unassessed attempts excluded.",
  ...overrides,
});

describe("barPct", () => {
  it("scales a mean against max_points", () => {
    expect(barPct(4, 8)).toBe(50);
    expect(barPct(0, 8)).toBe(0);
    expect(barPct(8, 8)).toBe(100);
  });

  it("clamps out-of-range values and refuses to draw without data", () => {
    expect(barPct(12, 8)).toBe(100);
    expect(barPct(-1, 8)).toBe(0);
    expect(barPct(null, 8)).toBeNull();
    expect(barPct(4, 0)).toBeNull();
  });
});

describe("questionBars", () => {
  it("labels, scales and captions each question", () => {
    const bars = questionBars(analytics(), questions);
    expect(bars[0].label).toBe("Q1 · Solve the system");
    expect(bars[0].valueLabel).toBe("3.3 of 8, n = 6");
    expect(bars[0].latestPct).toBeCloseTo(41.666, 2);
    expect(bars[0].firstPct).toBeCloseTo(56.25, 2);
    expect(bars[0].categories.map((c) => `${c.label} ${c.count}`)).toEqual([
      "Notation 5",
      "Presentation 4",
      "Arithmetic 2",
    ]);
    expect(bars[0].mixedRubrics).toBe(false);
  });

  it("keeps the row but draws nothing when a question has no estimates", () => {
    const empty = analytics({
      questions: [
        {
          question_id: "q1",
          max_points: 8,
          first: stats({ scored_students: 0, mean_score: null, rubric_ids: [] }),
          latest: stats({ scored_students: 0, mean_score: null, rubric_ids: [] }),
        },
      ],
    });
    const bars = questionBars(empty, questions);
    expect(bars[0].latestPct).toBeNull();
    expect(bars[0].valueLabel).toBe("No estimates yet");
    expect(hasEstimates(empty)).toBe(false);
    expect(hasEstimates(analytics())).toBe(true);
  });

  it("flags a question scored under more than one rubric version", () => {
    const mixed = analytics({
      questions: [
        {
          question_id: "q1",
          max_points: 8,
          first: stats(),
          latest: stats({ rubric_ids: ["rub_1", "rub_2"] }),
        },
      ],
    });
    expect(questionBars(mixed, questions)[0].mixedRubrics).toBe(true);
  });
});

describe("topCategories", () => {
  it("takes the largest three, alphabetical on a tie, and drops zeroes", () => {
    const top = topCategories({ logic: 3, notation: 3, arithmetic: 5, presentation: 1, unreadable: 0 });
    expect(top.map((c) => c.category)).toEqual(["arithmetic", "logic", "notation"]);
    expect(top[0].count).toBe(5);
  });

  it("uses the same word for a category as the paper and the feedback panel", () => {
    expect(topCategories({ unsupported_method: 2 })[0].label).toBe("Unsupported method");
    expect(topCategories({ notation: 1 })[0].label).toBe("Notation");
  });
});

describe("selectFinding", () => {
  it("picks the largest change in either direction and words it without claiming learning", () => {
    const finding = selectFinding(questionBars(analytics(), questions));
    expect(finding?.questionId).toBe("q1");
    expect(finding?.text).toBe("Q1 · Solve the system is 1.2 points lower on the latest attempt");
    expect(chartTitle(finding)).toBe(finding?.text);
  });

  it("reports a rise as higher", () => {
    const up = analytics({
      questions: [
        { question_id: "q2", max_points: 6, first: stats({ mean_score: 4 }), latest: stats({ mean_score: 5 }) },
      ],
    });
    expect(selectFinding(questionBars(up, questions))?.text).toBe(
      "Q2 · Rank and nullity is 1.0 point higher on the latest attempt",
    );
  });

  it("returns nothing when nothing moved, and falls back to the plain title", () => {
    const flat = analytics({
      questions: [
        { question_id: "q1", max_points: 8, first: stats({ mean_score: 4 }), latest: stats({ mean_score: 4.2 }) },
      ],
    });
    expect(selectFinding(questionBars(flat, questions))).toBeNull();
    expect(chartTitle(null)).toBe("Scores by question");
  });

  it("ignores questions with no first or latest mean", () => {
    const partial = analytics({
      questions: [
        {
          question_id: "q1",
          max_points: 8,
          first: stats({ mean_score: null, scored_students: 0 }),
          latest: stats({ mean_score: 8 }),
        },
      ],
    });
    expect(selectFinding(questionBars(partial, questions))).toBeNull();
  });
});

describe("overviewTiles", () => {
  it("builds three tiles plus a quiet reports tile that links to Reports", () => {
    const tiles = overviewTiles(analytics(), "asg_1");
    expect(tiles.map((t) => t.label)).toEqual(["Handed in", "Reviewed", "Released", "Open reports"]);
    expect(tiles[0].value).toBe(4);
    expect(tiles[0].caption).toBe("of 6 students with attempts");
    expect(tiles[3].to).toBe("/a/asg_1/reports");
  });

  it("drops the reports tile when nothing is open", () => {
    const tiles = overviewTiles(analytics({ open_reports: 0 }), "asg_1");
    expect(tiles).toHaveLength(3);
  });
});
