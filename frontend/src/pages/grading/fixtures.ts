// Fictional fixtures for the grading tests, shaped like the seeded 21-241 course.
// Test-only: nothing in the shipped UI imports this file.

import type {
  Criterion,
  Job,
  Question,
  Rubric,
  StaffAssessment,
  StaffReview,
  StaffSubmission,
} from "../../api/types";

export const questions: Question[] = [
  { id: "q1", title: "Solve the system", prompt: "Solve the linear system by row reduction.", max_points: 8 },
  { id: "q2", title: "Rank and nullity", prompt: "Find the rank and nullity of A.", max_points: 6 },
  { id: "q3", title: "Subspace proof", prompt: "Prove that W is a subspace of R^3.", max_points: 8 },
  { id: "q4", title: "Inverse", prompt: "Find A inverse from [A | I].", max_points: 8 },
];

export const criteria: Criterion[] = [
  { id: "q1-ops", question_id: "q1", description: "Every row operation is labeled", points: 3, category: "presentation" },
  { id: "q1-arith", question_id: "q1", description: "Row reduction has no arithmetic errors", points: 3, category: "arithmetic" },
  { id: "q1-vector", question_id: "q1", description: "Solution written as a column vector", points: 2, category: "notation" },
  { id: "q2-rank", question_id: "q2", description: "Rank is correct", points: 2, category: "logic" },
  { id: "q2-nullity", question_id: "q2", description: "Nullity is correct", points: 2, category: "logic" },
  { id: "q2-basis", question_id: "q2", description: "Basis for the null space is given", points: 2, category: "justification" },
];

export const rubric: Rubric = {
  id: "rub_1",
  assignment_id: "asg_1",
  version: 1,
  published_at: "2026-09-19T21:53:54Z",
  criteria,
  instructor_notes: "Partial credit for a labeled but arithmetically wrong reduction.",
  reference_ids: [],
};

export function review(overrides: Partial<StaffReview> = {}): StaffReview {
  return {
    revision: 0,
    status: "not_started",
    questions: {},
    score: null,
    updated_at: null,
    reviewer_id: null,
    completed_at: null,
    released_at: null,
    ...overrides,
  };
}

export const assessment: StaffAssessment = {
  score: 19,
  max_points: 30,
  status: "estimated",
  provider_id: "dev-fixture",
  mode: "fixture",
  assessed_at: "2026-09-19T21:53:54Z",
  input_sha256: "0".repeat(64),
  questions: [
    { question_id: "q1", score: 8, max_points: 8, status: "estimated", flags: [] },
    {
      question_id: "q2",
      score: 0,
      max_points: 6,
      status: "estimated",
      flags: [
        {
          id: "q2-flag-1",
          category: "arithmetic",
          message: "Check the arithmetic in this part of your work.",
          anchors: [{ id: "anchor-1", page: 1, bbox: null }],
        },
        {
          id: "q2-flag-2",
          category: "logic",
          message: "Check whether each reasoning step follows from the previous one.",
          anchors: [{ id: "anchor-1", page: 2, bbox: null }],
        },
      ],
    },
    { question_id: "q3", score: 5, max_points: 8, status: "estimated", flags: [] },
    { question_id: "q4", score: null, max_points: 8, status: "needs_review", flags: [] },
  ],
  decisions: [
    { criterion_id: "q1-ops", outcome: "met", evidence_ids: ["p1"], rationale: "Operations labeled." },
    { criterion_id: "q1-arith", outcome: "met", evidence_ids: ["p1"], rationale: "No arithmetic slips." },
    { criterion_id: "q1-vector", outcome: "not_met", evidence_ids: ["p1"], rationale: "Written as a list." },
    { criterion_id: "q2-rank", outcome: "not_met", evidence_ids: ["p1"], rationale: "Rank off by one." },
    { criterion_id: "q2-nullity", outcome: "uncertain", evidence_ids: [], rationale: "Handwriting unclear." },
    { criterion_id: "q2-basis", outcome: "not_met", evidence_ids: ["p1"], rationale: "No basis given." },
  ],
};

export function submission(overrides: Partial<StaffSubmission> = {}): StaffSubmission {
  return {
    id: "sub_ben",
    assignment_id: "asg_1",
    student_id: "usr_ben",
    document_id: "doc_ben",
    version: 1,
    rubric_id: "rub_1",
    created_at: "2026-09-19T21:53:54Z",
    mapping: { q1: [1], q2: [1, 2], q3: [2], q4: [3] },
    sealed: true,
    final: true,
    handed_in_at: "2026-09-19T21:53:54Z",
    job_id: "job_1",
    document: {
      id: "doc_ben",
      assignment_id: "asg_1",
      kind: "submission",
      filename: "hw1-ben-v1.pdf",
      page_count: 3,
      sha256: "a".repeat(64),
      extraction: "pdf_text",
      has_unreadable_pages: false,
    },
    assessment,
    review: review(),
    student_name: "Ben Castellano",
    rubric,
    ...overrides,
  };
}

export function job(overrides: Partial<Job> = {}): Job {
  return {
    id: "job_1",
    kind: "assessment",
    target_id: "sub_ben",
    status: "succeeded",
    attempts: 1,
    created_at: "2026-09-19T21:53:54Z",
    updated_at: "2026-09-19T21:53:54Z",
    error_code: null,
    ...overrides,
  };
}
