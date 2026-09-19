// Typed client for the Verity backend (docs/openapi.json). One function per endpoint.
// Errors surface as ApiError with the backend's detail.code; 401 means the session expired.

import type {
  Analytics,
  Assignment,
  AssignmentDetail,
  Capabilities,
  Course,
  DocumentKind,
  DocumentMeta,
  Job,
  Member,
  PageMapping,
  Question,
  Report,
  ReviewQuestion,
  Rubric,
  RubricInput,
  StaffSubmission,
  Submission,
  User,
} from "./types";
import type { Session } from "./session";

export class ApiError extends Error {
  status: number;
  code: string;
  fields: Array<{ path: string; type: string }>;

  constructor(status: number, code: string, fields: Array<{ path: string; type: string }> = []) {
    super(code);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }

  get expired(): boolean {
    return this.status === 401;
  }

  get denied(): boolean {
    return this.status === 403;
  }

  get conflict(): boolean {
    return this.status === 409;
  }
}

type Method = "GET" | "POST" | "PUT";

export class VerityClient {
  private readonly base: string;
  private readonly token: string;

  constructor(session: Session) {
    this.base = session.api.replace(/\/$/, "");
    this.token = session.token;
  }

  private async request<T>(method: Method, path: string, body?: unknown, form?: FormData): Promise<T> {
    const headers: Record<string, string> = { Authorization: `Bearer ${this.token}` };
    let payload: BodyInit | undefined;
    if (form) {
      payload = form;
    } else if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      payload = JSON.stringify(body);
    }
    let response: Response;
    try {
      response = await fetch(`${this.base}/api${path}`, { method, headers, body: payload });
    } catch {
      throw new ApiError(0, "network");
    }
    if (!response.ok) {
      let code = `http_${response.status}`;
      let fields: Array<{ path: string; type: string }> = [];
      try {
        const data = (await response.json()) as { detail?: unknown };
        if (typeof data.detail === "string") code = data.detail;
        else if (data.detail && typeof data.detail === "object") {
          const d = data.detail as { code?: string; fields?: Array<{ path: string; type: string }> };
          if (d.code) code = d.code;
          if (d.fields) fields = d.fields;
        }
      } catch {
        /* no JSON body */
      }
      throw new ApiError(response.status, code, fields);
    }
    if (response.status === 204) return undefined as T;
    const text = await response.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  // identity and system
  me(): Promise<User> {
    return this.request("GET", "/me");
  }
  capabilities(): Promise<Capabilities> {
    return this.request("GET", "/capabilities");
  }

  // courses
  courses(): Promise<Course[]> {
    return this.request("GET", "/courses");
  }
  createCourse(name: string): Promise<Course> {
    return this.request("POST", "/courses", { name });
  }
  members(courseId: string): Promise<Member[]> {
    return this.request("GET", `/courses/${courseId}/members`);
  }
  enroll(courseId: string, userId: string, role: "student" | "ta" | "instructor"): Promise<Member> {
    return this.request("POST", `/courses/${courseId}/members`, { user_id: userId, role });
  }

  // assignments
  assignments(courseId: string): Promise<Assignment[]> {
    return this.request("GET", `/courses/${courseId}/assignments`);
  }
  createAssignment(
    courseId: string,
    input: { title: string; questions: Question[]; due_at?: string | null },
  ): Promise<Assignment> {
    return this.request("POST", `/courses/${courseId}/assignments`, input);
  }
  assignment(assignmentId: string): Promise<AssignmentDetail> {
    return this.request("GET", `/assignments/${assignmentId}`);
  }
  saveRubricDraft(assignmentId: string, input: RubricInput): Promise<AssignmentDetail> {
    return this.request("PUT", `/assignments/${assignmentId}/rubric-draft`, input);
  }
  requestRubricDraft(assignmentId: string): Promise<Job> {
    return this.request("POST", `/assignments/${assignmentId}/rubric-jobs`);
  }
  publishRubric(assignmentId: string): Promise<Rubric> {
    return this.request("POST", `/assignments/${assignmentId}/rubric-publish`);
  }

  // documents
  upload(assignmentId: string, kind: Exclude<DocumentKind, "submission">, file: File): Promise<DocumentMeta>;
  upload(assignmentId: string, kind: "submission", file: File): Promise<Submission>;
  upload(assignmentId: string, kind: DocumentKind, file: File): Promise<DocumentMeta | Submission> {
    const form = new FormData();
    form.append("file", file, file.name);
    return this.request("POST", `/assignments/${assignmentId}/documents?kind=${kind}`, undefined, form);
  }
  document(documentId: string): Promise<DocumentMeta> {
    return this.request("GET", `/documents/${documentId}`);
  }
  /** Fetches the original PDF with authorization. Caller creates and revokes the object URL. */
  async documentBlob(documentId: string): Promise<Blob> {
    let response: Response;
    try {
      response = await fetch(`${this.base}/api/documents/${documentId}/file`, {
        headers: { Authorization: `Bearer ${this.token}` },
      });
    } catch {
      throw new ApiError(0, "network");
    }
    if (!response.ok) throw new ApiError(response.status, `http_${response.status}`);
    return response.blob();
  }

  // submissions
  submissions(assignmentId: string, finalOnly = false): Promise<Submission[]> {
    return this.request("GET", `/assignments/${assignmentId}/submissions${finalOnly ? "?final_only=true" : ""}`);
  }
  finalQueue(assignmentId: string): Promise<StaffSubmission[]> {
    return this.request("GET", `/assignments/${assignmentId}/submissions?final_only=true`);
  }
  submission(submissionId: string): Promise<Submission> {
    return this.request("GET", `/submissions/${submissionId}`);
  }
  saveMapping(submissionId: string, questions: PageMapping): Promise<Submission> {
    return this.request("PUT", `/submissions/${submissionId}/mapping`, { questions });
  }
  startAssessment(submissionId: string): Promise<Job> {
    return this.request("POST", `/submissions/${submissionId}/assessment-jobs`);
  }
  handIn(submissionId: string): Promise<Submission> {
    return this.request("POST", `/submissions/${submissionId}/hand-in`);
  }

  // jobs
  job(jobId: string): Promise<Job> {
    return this.request("GET", `/jobs/${jobId}`);
  }
  retryJob(jobId: string): Promise<Job> {
    return this.request("POST", `/jobs/${jobId}/retry`);
  }
  /** Polls until the job succeeds or fails. Interval grows from 400ms to 2s. */
  async waitForJob(jobId: string, signal?: AbortSignal): Promise<Job> {
    let delay = 400;
    for (;;) {
      const job = await this.job(jobId);
      if (job.status === "succeeded" || job.status === "failed") return job;
      if (signal?.aborted) return job;
      await new Promise((r) => setTimeout(r, delay));
      delay = Math.min(delay * 1.5, 2000);
    }
  }

  // review (staff)
  saveReview(
    submissionId: string,
    expectedRevision: number,
    questions: Record<string, ReviewQuestion>,
  ): Promise<StaffSubmission["review"]> {
    return this.request("PUT", `/submissions/${submissionId}/review`, {
      expected_revision: expectedRevision,
      questions,
    });
  }
  completeReview(submissionId: string, expectedRevision: number): Promise<StaffSubmission["review"]> {
    return this.request("POST", `/submissions/${submissionId}/review/complete`, {
      expected_revision: expectedRevision,
    });
  }
  releaseReview(submissionId: string, expectedRevision: number): Promise<StaffSubmission["review"]> {
    return this.request("POST", `/submissions/${submissionId}/review/release`, {
      expected_revision: expectedRevision,
    });
  }
  reopenReview(submissionId: string, expectedRevision: number, reason: string): Promise<StaffSubmission["review"]> {
    return this.request("POST", `/submissions/${submissionId}/review/reopen`, {
      expected_revision: expectedRevision,
      reason,
    });
  }

  // reports
  createReport(
    submissionId: string,
    input: { question_id: string; kind: "incorrect_feedback" | "help"; message: string },
  ): Promise<Report> {
    return this.request("POST", `/submissions/${submissionId}/reports`, input);
  }
  reports(assignmentId: string): Promise<Report[]> {
    return this.request("GET", `/assignments/${assignmentId}/reports`);
  }
  resolveReport(reportId: string, status: "resolved" | "dismissed", staffNote: string): Promise<Report> {
    return this.request("PUT", `/reports/${reportId}`, { status, staff_note: staffNote });
  }

  // analytics
  analytics(assignmentId: string): Promise<Analytics> {
    return this.request("GET", `/assignments/${assignmentId}/analytics`);
  }
  audit(assignmentId: string): Promise<unknown[]> {
    return this.request("GET", `/assignments/${assignmentId}/audit`);
  }
}
