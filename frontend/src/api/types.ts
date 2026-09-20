// Types mirror docs/openapi.json and the projections in backend/verity/service.py.
// Student responses never contain criteria, rationales, or staff reasons; the API strips them.

export type Role = "student" | "ta" | "instructor";

export interface User {
  id: string;
  name: string;
  role: Role;
}

export interface Capabilities {
  provider_id: string;
  /** "unconfigured" | "fixture" | "model" */
  mode: string;
  automated_assessment: boolean;
  ocr: boolean;
  extraction: string;
  max_upload_bytes: number;
  max_pages: number;
  human_review_required: boolean;
}

export interface Course {
  id: string;
  name: string;
  created_at: string;
  /** the current user's role in this course */
  role: Role;
}

export interface Member {
  id: string;
  name: string;
  role: Role;
}

export interface Question {
  id: string;
  title: string;
  prompt: string;
  max_points: number;
}

export interface Assignment {
  id: string;
  course_id: string;
  title: string;
  questions: Question[];
  due_at: string | null;
  created_at: string;
  published_rubric_id: string | null;
}

export type Category =
  | "arithmetic"
  | "logic"
  | "notation"
  | "presentation"
  | "justification"
  | "unsupported_method"
  | "unreadable";

export type FlagCategory = Category | "needs_review";

export interface Criterion {
  id: string;
  question_id: string;
  description: string;
  points: number;
  category: Category;
}

export interface RubricInput {
  criteria: Criterion[];
  instructor_notes: string;
}

export interface Rubric extends RubricInput {
  id: string;
  assignment_id: string;
  version: number;
  published_at: string;
  reference_ids: string[];
}

/** GET /api/assignments/{id}. Students get the public fields plus `documents` (published
 *  question PDFs only). Staff also get the editable draft, its revision counter, every
 *  reference document, and the list of published rubric versions (latest last). */
export interface AssignmentDetail extends Assignment {
  documents: DocumentMeta[];
  rubric_draft?: RubricInput | null;
  draft_revision?: number;
  rubrics?: Rubric[];
}

export type DocumentKind = "questions" | "solution" | "graded_example" | "submission";

export interface DocumentMeta {
  id: string;
  assignment_id: string;
  kind: DocumentKind;
  filename: string;
  page_count: number;
  sha256: string;
  extraction: string;
  has_unreadable_pages: boolean;
}

export interface Anchor {
  id: string;
  /** 1-based */
  page: number;
  /** normalized [left, top, right, bottom], origin top-left; null when only the page is known */
  bbox: [number, number, number, number] | null;
}

export interface Flag {
  id: string;
  category: FlagCategory;
  message: string;
  anchors: Anchor[];
}

export interface QuestionAssessment {
  question_id: string;
  /** null when any criterion is uncertain: show "Needs review", never 0 */
  score: number | null;
  max_points: number;
  status: "estimated" | "needs_review";
  flags: Flag[];
}

export interface Decision {
  criterion_id: string;
  outcome: "met" | "not_met" | "uncertain";
  evidence_ids: string[];
  rationale: string;
}

export interface StudentAssessment {
  score: number | null;
  max_points: number;
  status: "estimated" | "needs_review";
  questions: QuestionAssessment[];
  provider_id: string;
  /** "fixture" must be labeled "Test fixture" in the UI */
  mode: string;
  assessed_at: string;
}

export interface StaffAssessment extends StudentAssessment {
  decisions: Decision[];
  input_sha256: string;
}

export type ReviewStatus = "not_started" | "in_progress" | "completed" | "released";

export interface ReviewQuestion {
  score: number;
  reason: string;
}

export interface StaffReview {
  revision: number;
  status: ReviewStatus;
  questions: Record<string, ReviewQuestion>;
  /** omitted by the API until the review is completed */
  score?: number | null;
  updated_at?: string | null;
  reviewer_id?: string | null;
  completed_at?: string | null;
  released_at?: string | null;
  reopen_reason?: string;
}

export interface StudentReview {
  status: ReviewStatus;
  /** present only when status === "released" */
  questions?: Record<string, { score: number }>;
  score?: number | null;
}

export type PageMapping = Record<string, number[]>;

interface SubmissionBase {
  id: string;
  assignment_id: string;
  student_id: string;
  document_id: string;
  version: number;
  rubric_id: string;
  created_at: string;
  mapping: PageMapping | null;
  sealed: boolean;
  final: boolean;
  handed_in_at: string | null;
  job_id: string | null;
  document: DocumentMeta;
}

export interface StudentSubmission extends SubmissionBase {
  assessment: StudentAssessment | null;
  review: StudentReview;
}

export interface StaffSubmission extends SubmissionBase {
  assessment: StaffAssessment | null;
  review: StaffReview;
  student_name: string;
  rubric: Rubric;
}

export type Submission = StudentSubmission | StaffSubmission;

export function isStaffSubmission(s: Submission): s is StaffSubmission {
  return "student_name" in s;
}

export type JobStatus = "queued" | "running" | "succeeded" | "failed";

export interface Job {
  id: string;
  kind: "assessment" | "rubric";
  target_id: string;
  status: JobStatus;
  attempts: number;
  created_at: string;
  updated_at: string;
  error_code: "not_configured" | "invalid_result" | "provider_failed" | "interrupted" | null;
}

export interface Report {
  id: string;
  submission_id: string;
  question_id: string;
  kind: "incorrect_feedback" | "help";
  message: string;
  status: "open" | "resolved" | "dismissed";
  created_at: string;
  student_id?: string;
  student_name?: string;
  staff_note?: string;
  [key: string]: unknown;
}

export interface QuestionStats {
  /** Includes completed checks whose score is uncertain. */
  assessed_students: number;
  /** Distinct students with at least one flag, across all categories. */
  flagged_students: number;
  assessment_modes: string[];
  scored_students: number;
  mean_score: number | null;
  students_by_category: Record<string, number>;
  rubric_ids: string[];
}

export interface Analytics {
  students_with_attempts: number;
  final_submissions: number;
  reviewed: number;
  released: number;
  open_reports: number;
  questions: Array<{
    question_id: string;
    max_points: number;
    first: QuestionStats;
    latest: QuestionStats;
  }>;
  interpretation: string;
}

export interface FieldError {
  /** e.g. ["body", "questions", 0, "id"] */
  path: Array<string | number>;
  type: string;
}

export interface ApiErrorBody {
  detail: { code: string; fields?: FieldError[] } | string;
}

/** PUT /api/assignments/{id}/rubric-draft returns the saved draft and its revision. */
export interface SavedRubricDraft {
  draft: RubricInput;
  revision: number;
}
