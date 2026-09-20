import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { Analytics, Question, QuestionStats } from "../../api/types";
import { FeedbackByQuestion } from "./FeedbackByQuestion";

afterEach(cleanup);
const questions: Question[] = [{ id: "q1", title: "Solve the system", prompt: "", max_points: 8 }];
function analytics(overrides: Partial<QuestionStats> = {}): Analytics {
  const stats: QuestionStats = {
    assessed_students: 3, flagged_students: 2, scored_students: 2, mean_score: 5,
    students_by_category: { arithmetic: 2, notation: 2 }, rubric_ids: ["r1"],
    assessment_modes: ["fixture"], ...overrides,
  };
  return {
    students_with_attempts: 4, final_submissions: 2, reviewed: 1, released: 0, open_reports: 0,
    questions: [{ question_id: "q1", max_points: 8, first: stats, latest: stats }], interpretation: "",
  };
}

describe("TA feedback chart", () => {
  it("uses distinct-student totals, including uncertain checks, instead of summing categories", () => {
    render(<FeedbackByQuestion analytics={analytics()} questions={questions} />);
    const row = screen.getByRole("listitem");
    expect(within(row).getByText("2 of 3")).toBeInTheDocument();
    expect(screen.getByText("Test fixture")).toBeInTheDocument();
    expect(screen.queryByText("4 of 3")).not.toBeInTheDocument();
    expect(screen.queryByText(/mean|first attempt|reviewed/i)).not.toBeInTheDocument();
  });
  it("distinguishes checked work with zero flags from missing checks", () => {
    const view = render(<FeedbackByQuestion analytics={analytics({ flagged_students: 0 })} questions={questions} />);
    expect(screen.getByText("0 of 3")).toBeInTheDocument();
    view.rerender(<FeedbackByQuestion analytics={analytics({ assessed_students: 0, flagged_students: 0, assessment_modes: [] })} questions={questions} />);
    expect(screen.getByText("No checked attempts yet")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
  it("keeps rubric provenance visible without showing per-category statistics", () => {
    render(<FeedbackByQuestion analytics={analytics({ rubric_ids: ["r1", "r2"], assessment_modes: ["live"] })} questions={questions} />);
    expect(screen.getByText("These checks used different rubric versions.")).toBeInTheDocument();
    expect(screen.queryByText("Test fixture")).not.toBeInTheDocument();
    expect(screen.queryByText(/arithmetic|notation/i)).not.toBeInTheDocument();
  });
});
