// Every sentence on the signed-out page, in one place: the vocabulary is exact and the claims
// are the ones the backend can actually keep.

export const LANDING_LINE =
  "Practice feedback under your instructor's rubric. Every final paper is reviewed by a person.";

export interface Step {
  n: number;
  text: string;
}

export const STUDENT_STEPS: Step[] = [
  { n: 1, text: "Upload your paper as a PDF and say which pages hold which question." },
  { n: 2, text: "Click Check my work for an estimated score with flags pinned to the page." },
  { n: 3, text: "Upload a revision as often as you like, then hand in the attempt you want graded." },
];

export const STAFF_STEPS: Step[] = [
  { n: 1, text: "Create an assignment with its questions and points, and upload the paper." },
  { n: 2, text: "Write or request a rubric draft, read every line, then publish it." },
  { n: 3, text: "Grade each handed-in paper beside the original, then release scores." },
];

export const LANDING_FOOTNOTE = "SteelHacks 2026 · fictional demo data";
