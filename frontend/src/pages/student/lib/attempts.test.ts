import { describe, expect, it } from "vitest";
import type { StudentSubmission } from "../../../api/types";
import {
  attemptAction,
  attemptLabel,
  attemptStatus,
  dueSentence,
  handInGate,
  isMapped,
  latestAttempt,
  points,
  scoreLine,
  sortedAttempts,
  stamp,
  uploadGate,
} from "./attempts";

function attempt(overrides: Partial<StudentSubmission> & { version: number }): StudentSubmission {
  const { version } = overrides;
  const base: StudentSubmission = {
    id: `sub_${version}`,
    assignment_id: "asg_1",
    student_id: "usr_1",
    document_id: `doc_${version}`,
    version,
    rubric_id: "rub_1",
    created_at: "2026-09-19T21:53:54Z",
    mapping: { q1: [1], q2: [1], q3: [2], q4: [3] },
    sealed: false,
    final: false,
    handed_in_at: null,
    job_id: null,
    document: {
      id: `doc_${version}`,
      assignment_id: "asg_1",
      kind: "submission",
      filename: `hw1-v${version}.pdf`,
      page_count: 3,
      sha256: "x",
      extraction: "pdf_text",
      has_unreadable_pages: false,
    },
    assessment: null,
    review: { status: "not_started" },
  };
  return { ...base, ...overrides };
}

const estimated = {
  score: 22,
  max_points: 30,
  status: "estimated" as const,
  questions: [],
  provider_id: "dev-fixture",
  mode: "fixture",
  assessed_at: "2026-09-19T21:53:54Z",
};

describe("numbers", () => {
  it("prints whole points without a decimal tail", () => {
    expect(points(8)).toBe("8");
    expect(points(7.5)).toBe("7.5");
    expect(scoreLine(22, 30)).toBe("22 of 30");
  });

  it("never renders a null score as zero", () => {
    expect(scoreLine(null, 30)).toBe("Needs review");
  });
});

describe("attempt status", () => {
  it("says Not checked before an assessment exists", () => {
    expect(attemptStatus(attempt({ version: 1 }))).toEqual({ kind: "not_checked", label: "Not checked" });
  });

  it("labels an estimate as an estimate", () => {
    const status = attemptStatus(attempt({ version: 1, assessment: estimated }));
    expect(status).toMatchObject({ kind: "estimated", label: "Estimated 22 of 30" });
  });

  it("shows Needs review for a null score", () => {
    const status = attemptStatus(
      attempt({
        version: 1,
        assessment: { ...estimated, score: null, status: "needs_review" },
      }),
    );
    expect(status).toEqual({ kind: "needs_review", label: "Needs review" });
  });

  it("shows the final score only once the review is released", () => {
    const pending = attempt({
      version: 2,
      final: true,
      assessment: estimated,
      review: { status: "completed" },
    });
    expect(attemptStatus(pending).kind).toBe("estimated");

    const released = attempt({
      version: 2,
      final: true,
      assessment: estimated,
      review: { status: "released", score: 27, questions: { q1: { score: 7 } } },
    });
    expect(attemptStatus(released)).toMatchObject({ kind: "final", label: "Final score 27 of 30" });
  });
});

describe("row action", () => {
  it("asks for pages when nothing is mapped", () => {
    expect(attemptAction(attempt({ version: 1, mapping: {} }))).toBe("assign_pages");
    expect(attemptAction(attempt({ version: 1, mapping: { q1: [1], q2: [] } }))).toBe("assign_pages");
  });

  it("offers the check once every question has pages", () => {
    expect(attemptAction(attempt({ version: 1 }))).toBe("check");
  });

  it("offers page edits instead of a check when assessment is not connected", () => {
    expect(attemptAction(attempt({ version: 1 }), { canCheck: false })).toBe("edit_pages");
  });

  it("offers feedback once the attempt is sealed", () => {
    expect(attemptAction(attempt({ version: 1, sealed: true, assessment: estimated }))).toBe("view");
  });

  it("knows a mapping is incomplete", () => {
    expect(isMapped(attempt({ version: 1, mapping: null }))).toBe(false);
    expect(isMapped(attempt({ version: 1 }))).toBe(true);
  });
});

describe("attempt order", () => {
  it("lists the latest attempt first", () => {
    const list = [attempt({ version: 1 }), attempt({ version: 3 }), attempt({ version: 2 })];
    expect(sortedAttempts(list).map((a) => a.version)).toEqual([3, 2, 1]);
    expect(latestAttempt(list)?.version).toBe(3);
  });

  it("keeps the first and the latest attempt distinct in the version popover", () => {
    const list = [attempt({ version: 1 }), attempt({ version: 2 }), attempt({ version: 3 })];
    expect(list.map((a) => attemptLabel(a, list))).toEqual([
      "Attempt 1 (first)",
      "Attempt 2",
      "Attempt 3 (latest)",
    ]);
    const only = [attempt({ version: 1 })];
    expect(attemptLabel(only[0], only)).toBe("Attempt 1");
  });
});

describe("hand in gate", () => {
  const now = new Date("2026-09-20T12:00:00Z");
  const open = "2026-09-24T21:53:54Z";
  const closed = "2026-09-18T21:53:54Z";

  it("allows the latest mapped attempt before the due date", () => {
    const one = attempt({ version: 1, sealed: true, assessment: estimated });
    expect(handInGate({ submission: one, attempts: [one], dueAt: open, now })).toEqual({
      allowed: true,
      reason: null,
    });
  });

  it("refuses an earlier attempt", () => {
    const first = attempt({ version: 1 });
    const second = attempt({ version: 2 });
    expect(handInGate({ submission: first, attempts: [first, second], dueAt: open, now })).toEqual({
      allowed: false,
      reason: "Only the latest attempt can be handed in",
    });
  });

  it("refuses once something is already handed in", () => {
    const first = attempt({ version: 1, final: true, handed_in_at: "2026-09-19T16:12:00Z" });
    const second = attempt({ version: 2 });
    expect(handInGate({ submission: second, attempts: [first, second], dueAt: open, now })).toEqual({
      allowed: false,
      reason: "You already handed in attempt 1",
    });
  });

  it("refuses the handed-in attempt itself", () => {
    const one = attempt({ version: 1, final: true, handed_in_at: "2026-09-19T16:12:00Z" });
    expect(handInGate({ submission: one, attempts: [one], dueAt: open, now }).reason).toBe(
      "This attempt is already handed in",
    );
  });

  it("refuses after the due date", () => {
    const one = attempt({ version: 1 });
    expect(handInGate({ submission: one, attempts: [one], dueAt: closed, now })).toEqual({
      allowed: false,
      reason: "The due date has passed",
    });
    expect(uploadGate(closed, now).allowed).toBe(false);
    expect(uploadGate(open, now).allowed).toBe(true);
    expect(uploadGate(null, now).allowed).toBe(true);
  });

  it("refuses an unmapped attempt, as the backend does", () => {
    const one = attempt({ version: 1, mapping: {} });
    expect(handInGate({ submission: one, attempts: [one], dueAt: open, now }).reason).toBe(
      "Assign pages to every question first",
    );
  });

  it("allows hand in with no due date set", () => {
    const one = attempt({ version: 1 });
    expect(handInGate({ submission: one, attempts: [], dueAt: null, now }).allowed).toBe(true);
  });
});

describe("dates", () => {
  const now = new Date("2026-09-20T12:00:00Z");

  it("says Closed after the due date", () => {
    expect(dueSentence("2026-09-18T21:53:54Z", now)).toBe("Closed");
  });

  it("names the weekday for a due date this week", () => {
    expect(dueSentence("2026-09-24T23:59:00Z", now)).toMatch(/^Due (Wednesday|Thursday), \d/);
  });

  it("says there is no due date when none is set", () => {
    expect(dueSentence(null, now)).toBe("No due date");
  });

  it("stamps an upload as a short date and a lowercase clock", () => {
    expect(stamp("2026-09-19T16:12:00Z")).toMatch(/^Sep \d+, \d+:\d\d (am|pm)$/);
    expect(stamp(null)).toBe("");
  });
});
