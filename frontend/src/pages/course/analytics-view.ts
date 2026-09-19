// Turns `Analytics` into the three tiles, the per-question bars and the one finding that titles
// the chart. Bars exist only where the backend actually scored someone: an empty question keeps
// its row and its label but draws nothing, and a whole assignment with no estimates draws no chart.

import type { Analytics, FlagCategory, Question } from "../../api/types";
import { FLAG_LABEL } from "../../components/flags";

export interface CategoryCount {
  category: string;
  /** distinct students in that category for this question */
  count: number;
  label: string;
}

export interface QuestionBar {
  questionId: string;
  /** "Q1 · Solve the system" */
  label: string;
  maxPoints: number;
  latestMean: number | null;
  firstMean: number | null;
  /** 0-100, the width of the bar; null when there is no latest mean */
  latestPct: number | null;
  /** 0-100, the position of the first-attempt tick; null when there is no first mean */
  firstPct: number | null;
  scoredStudents: number;
  /** "4.0 of 8, n = 5" or "No estimates yet" */
  valueLabel: string;
  categories: CategoryCount[];
  /** more than one rubric version behind this question's numbers */
  mixedRubrics: boolean;
}

export interface OverviewTile {
  id: string;
  label: string;
  value: number;
  caption: string;
  /** set on the quiet reports tile */
  to?: string;
}

export interface Finding {
  questionId: string;
  delta: number;
  /** the sentence that titles the chart block */
  text: string;
}

/** The same word the paper and the feedback panel use for this category. */
export function categoryLabel(category: string): string {
  return FLAG_LABEL[category as FlagCategory] ?? category.replace(/_/g, " ");
}

/** One decimal on a mean, so 4 reads as "4.0" beside 3.3. */
export function formatMean(value: number): string {
  return value.toFixed(1);
}

/** Point totals print without a trailing ".0": 8, not 8.0. */
export function formatMax(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** 0-100 width for a mean out of max_points. Clamped, and null when there is nothing to draw. */
export function barPct(mean: number | null, maxPoints: number): number | null {
  if (mean === null || !Number.isFinite(mean) || maxPoints <= 0) return null;
  return Math.max(0, Math.min(100, (mean / maxPoints) * 100));
}

/** Top categories for a question, largest first, ties broken alphabetically. */
export function topCategories(counts: Record<string, number>, limit = 3): CategoryCount[] {
  return Object.entries(counts)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([category, count]) => ({ category, count, label: categoryLabel(category) }));
}

export function questionBars(analytics: Analytics, questions: Question[]): QuestionBar[] {
  const titles = new Map(questions.map((question) => [question.id, question.title]));
  return analytics.questions.map((row, index) => {
    const title = titles.get(row.question_id);
    const number = questions.findIndex((question) => question.id === row.question_id);
    const prefix = `Q${(number >= 0 ? number : index) + 1}`;
    const latestMean = row.latest.mean_score;
    const scored = row.latest.scored_students;
    return {
      questionId: row.question_id,
      label: title ? `${prefix} · ${title}` : prefix,
      maxPoints: row.max_points,
      latestMean,
      firstMean: row.first.mean_score,
      latestPct: barPct(latestMean, row.max_points),
      firstPct: barPct(row.first.mean_score, row.max_points),
      scoredStudents: scored,
      valueLabel:
        latestMean === null || scored === 0
          ? "No estimates yet"
          : `${formatMean(latestMean)} of ${formatMax(row.max_points)}, n = ${scored}`,
      categories: topCategories(row.latest.students_by_category),
      mixedRubrics: row.latest.rubric_ids.length > 1,
    };
  });
}

/** A chart is drawn only when the backend scored at least one student on at least one question. */
export function hasEstimates(analytics: Analytics): boolean {
  return analytics.questions.some((row) => row.latest.scored_students > 0);
}

/**
 * The finding: the largest first-to-latest change in mean score. Wording stays descriptive —
 * a change in estimates is not evidence of learning, so the sentence only reports the number.
 * Returns null when nothing moved by at least `threshold` points.
 */
export function selectFinding(bars: QuestionBar[], threshold = 0.5): Finding | null {
  let best: Finding | null = null;
  for (const bar of bars) {
    if (bar.latestMean === null || bar.firstMean === null || bar.scoredStudents === 0) continue;
    const delta = bar.latestMean - bar.firstMean;
    if (Math.abs(delta) < threshold) continue;
    if (best && Math.abs(delta) <= Math.abs(best.delta)) continue;
    const size = formatMean(Math.abs(delta));
    const unit = size === "1.0" ? "point" : "points";
    best = {
      questionId: bar.questionId,
      delta,
      text:
        delta < 0
          ? `${bar.label} is ${size} ${unit} lower on the latest attempt`
          : `${bar.label} is ${size} ${unit} higher on the latest attempt`,
    };
  }
  return best;
}

/** The title above the bars: the finding when there is one, otherwise the plain block name. */
export function chartTitle(finding: Finding | null): string {
  return finding ? finding.text : "Scores by question";
}

export function overviewTiles(analytics: Analytics, assignmentId: string): OverviewTile[] {
  const tiles: OverviewTile[] = [
    {
      id: "handed_in",
      label: "Handed in",
      value: analytics.final_submissions,
      caption: `of ${analytics.students_with_attempts} ${
        analytics.students_with_attempts === 1 ? "student" : "students"
      } with attempts`,
    },
    {
      id: "reviewed",
      label: "Reviewed",
      value: analytics.reviewed,
      caption: `of ${analytics.final_submissions} handed in`,
    },
    {
      id: "released",
      label: "Released",
      value: analytics.released,
      caption: `of ${analytics.reviewed} reviewed`,
    },
  ];
  if (analytics.open_reports > 0) {
    tiles.push({
      id: "open_reports",
      label: "Open reports",
      value: analytics.open_reports,
      caption: analytics.open_reports === 1 ? "waiting for a reply" : "waiting for replies",
      to: `/a/${assignmentId}/reports`,
    });
  }
  return tiles;
}
