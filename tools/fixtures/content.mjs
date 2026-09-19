/**
 * Fictional Homework 1 content for the Verity demo fixtures.
 *
 * Everything here is invented: the course, the people, the papers. The mathematical content
 * mirrors `tools/seed_dev.py` exactly (same four questions, same v1 mistakes, same v2 fixes) so
 * the seeded rubric, the TA review text and the flags in the frontend still line up. The only
 * additions are per-student surface variations: a caught-and-crossed-out line on two v1 papers
 * and a small arithmetic slip on two students.
 */

export const COURSE = "21-241 Linear Algebra (fictional section)";
export const ASSIGNMENT = "Homework 1";

export const QUESTIONS = [
  {
    id: "q1",
    n: 1,
    title: "Solve the system",
    prompt:
      "Solve the linear system by row reduction. Label every row operation and write the " +
      "solution as a column vector.",
    points: 8,
  },
  {
    id: "q2",
    n: 2,
    title: "Rank and nullity",
    prompt: "Find the rank and nullity of the matrix A and give a basis for its null space.",
    points: 6,
  },
  {
    id: "q3",
    n: 3,
    title: "Subspace proof",
    prompt: "Prove that W = { (x, y, z) : x + 2y - z = 0 } is a subspace of R^3.",
    points: 8,
  },
  {
    id: "q4",
    n: 4,
    title: "Inverse",
    prompt: "Find A^{-1} using the augmented matrix [A | I] and verify with one product.",
    points: 8,
  },
];

export const SYSTEM_MATRIX = [
  ["2", "1", "-1", "8"],
  ["-3", "-1", "2", "-11"],
  ["-2", "1", "2", "-3"],
];

/** name -> [versions, handsIn] must stay in sync with STUDENTS in tools/seed_dev.py. */
export const STUDENTS = [
  { name: "Amara Okafor", versions: 2 },
  { name: "Ben Castellano", versions: 1 },
  { name: "Chloe Nguyen", versions: 2 },
  { name: "Dev Patel", versions: 1 },
  { name: "Elena Petrova", versions: 1 },
  { name: "Farah Aziz", versions: 2 },
];

/** Per-student pen, paper and hand. Seeds keep every render byte-stable. */
export const HANDS = {
  "Amara Okafor": { font: "caveat", weight: 600, size: 25, ink: "#1d2a5e", paper: "ruled", tilt: -0.5, seed: 11 },
  "Ben Castellano": { font: "patrick", weight: 400, size: 21, ink: "#20242c", paper: "plain", tilt: 0.7, seed: 23 },
  "Chloe Nguyen": { font: "caveat", weight: 400, size: 26, ink: "#2b2f6b", paper: "ruled", tilt: 0.4, seed: 37 },
  "Dev Patel": { font: "patrick", weight: 400, size: 22, ink: "#14233a", paper: "ruled", tilt: -0.8, seed: 41 },
  "Elena Petrova": { font: "caveat", weight: 600, size: 24, ink: "#35322c", paper: "plain", tilt: 0.3, seed: 53 },
  "Farah Aziz": { font: "patrick", weight: 400, size: 21, ink: "#232a4d", paper: "ruled", tilt: -0.3, seed: 67 },
};

/** Students who leave a visible arithmetic slip. Amara's persists into v2 (the TA flags it). */
const SIGN_SLIP = "Amara Okafor";
const ARITH_SLIP = "Dev Patel";
/** Students whose v1 shows a line struck out and rewritten. */
const CROSSED_OUT = new Set(["Amara Okafor", "Chloe Nguyen"]);

const line = (text, extra = {}) => ({ t: "line", text, ...extra });
const head = (text) => ({ t: "head", text });
const gap = (rows = 1) => ({ t: "gap", rows });
const matrix = (rows, aug, lead, trail) => ({ t: "matrix", rows, aug, lead, trail });

/**
 * Three pages of student work: page 1 = Q1 + Q2, page 2 = Q3, page 3 = Q4.
 * v1 leaves the row operations unlabeled, writes the solution as a list, proves the subspace
 * claim by example and skips the verification. v2 fixes all four.
 */
export function studentPages(name, version) {
  const labels = version >= 2;
  const signSlip = name === SIGN_SLIP;
  const arithSlip = name === ARITH_SLIP;
  const crossed = version === 1 && CROSSED_OUT.has(name);

  const page1 = [
    head("Q1.  Solve the system"),
    matrix(SYSTEM_MATRIX, 1),
    ...(labels
      ? [line(signSlip ? "R2 ← R2 + 1.5 R1 ,   R3 ← R3 − R1" : "R2 ← R2 + 1.5 R1 ,   R3 ← R3 + R1")]
      : []),
    matrix(
      [
        ["2", "1", "-1", "8"],
        ["0", "0.5", "0.5", "1"],
        ["0", "2", "1", "5"],
      ],
      1,
      labels ? null : "→",
    ),
    ...(labels ? [line("R3 ← R3 − 4 R2")] : []),
    matrix(
      [
        ["2", "1", "-1", "8"],
        ["0", "0.5", "0.5", "1"],
        ["0", "0", "-1", "1"],
      ],
      1,
      labels ? null : "→",
    ),
    ...(crossed
      ? [line("back-sub:   z = 1", { strike: true }), line("back-sub:   z = −1 ,  0.5y − 0.5 = 1  ⇒  y = 3 ,  2x + 3 + 1 = 8  ⇒  x = 2")]
      : [line("back-sub:   z = −1 ,  0.5y − 0.5 = 1  ⇒  y = 3 ,  2x + 3 + 1 = 8  ⇒  x = 2")]),
    labels
      ? { t: "answer", label: "x =", column: ["2", "3", "-1"] }
      : line("x = 2 ,  y = 3 ,  z = −1"),
    gap(1),
    head("Q2.  Rank and nullity"),
    line("rref has 2 pivots, so rank A = 2"),
    line("nullity = 3 − 2 = 1"),
    line("null space:  ( −1 , 2 , 1 )"),
  ];

  // Neither version states the zero vector: the seeded TA review says so in as many words.
  const page2 = [
    head("Q3.  Subspace proof"),
    line("W = { (x, y, z) :  x + 2y − z = 0 }"),
    line("Need: closure under + and under scalar multiplication."),
    gap(1),
    line("Take ( 1 , 0 , 1 ) and ( 0 , 1 , 2 ) , both in W."),
    line("Sum is ( 1 , 1 , 3 ) :   1 + 2 − 3 = 0 , so in W."),
    line("3 · ( 1 , 0 , 1 ) = ( 3 , 0 , 3 ) :   3 + 0 − 3 = 0 , in W."),
    gap(1),
    ...(labels
      ? [
          line("For arbitrary u , v in W and c in R the same identity holds by linearity:"),
          line("( u₁ + v₁ ) + 2 ( u₂ + v₂ ) − ( u₃ + v₃ )"),
          line("     = ( u₁ + 2u₂ − u₃ ) + ( v₁ + 2v₂ − v₃ ) = 0 + 0 = 0"),
          line("c u₁ + 2 c u₂ − c u₃ = c ( u₁ + 2u₂ − u₃ ) = c · 0 = 0"),
          gap(1),
          line("so W is a subspace of R³.", { box: true }),
        ]
      : [line("So W is a subspace.", { box: true })]),
  ];

  // Dev Patel drops the minus sign in the (2,3) entry of the reduced right half.
  const invRows = [
    ["1", "0", "0", "1", "-1", "0"],
    ["0", "1", "0", "0", "1", arithSlip ? "1" : "-1"],
    ["0", "0", "1", "0", "0", "1"],
  ];

  const page3 = [
    head("Q4.  Inverse"),
    line("[ A | I ]  ="),
    matrix(
      [
        ["1", "1", "1", "1", "0", "0"],
        ["0", "1", "1", "0", "1", "0"],
        ["0", "0", "1", "0", "0", "1"],
      ],
      3,
    ),
    ...(labels ? [line("R1 ← R1 − R2")] : []),
    matrix(
      [
        ["1", "0", "0", "1", "-1", "0"],
        ["0", "1", "1", "0", "1", "0"],
        ["0", "0", "1", "0", "0", "1"],
      ],
      3,
      labels ? null : "→",
    ),
    ...(labels ? [line("R2 ← R2 − R3")] : []),
    matrix(invRows, 3, labels ? null : "→"),
    gap(1),
    { t: "answer", label: "A⁻¹ =", grid: [["1", "-1", "0"], ["0", "1", "-1"], ["0", "0", "1"]] },
    ...(labels
      ? [
          gap(1),
          line("Check:   A A⁻¹ ="),
          matrix([["1", "0", "0"], ["0", "1", "0"], ["0", "0", "1"]], 0, null, "= I  ✓"),
        ]
      : []),
  ];

  return [page1, page2, page3];
}

/** Instructor's blank assignment sheet: typed, clean, no working. */
export const QUESTION_SHEET = {
  title: ASSIGNMENT,
  course: COURSE,
  subtitle: "Due in five days · show all work · fictional coursework",
  intro:
    "Answer all four questions. Row operations must be labeled and final answers written in the " +
    "notation requested. Work is graded against the published rubric.",
  matrixCaption: "Use this system and matrix A for questions 1 and 2:",
  questions: QUESTIONS,
};

/** Instructor solution: typed, clean, private to staff. */
export const SOLUTION_SHEET = {
  title: "Instructor solution",
  course: COURSE,
  subtitle: `${ASSIGNMENT} · staff only · fictional coursework`,
  parts: [
    {
      heading: "Q1. Solve the system",
      lines: [
        "Augmented matrix [ 2 1 -1 | 8 ; -3 -1 2 | -11 ; -2 1 2 | -3 ].",
        "R1 ← R1 / 2.   R2 ← R2 + 3 R1.   R3 ← R3 + 2 R1.",
        "R3 ← R3 − 4 R2.   Back-substitute.",
      ],
      answer: { label: "x =", column: ["2", "3", "-1"] },
      note: "Full credit requires every operation labeled and the answer as a column vector.",
    },
    {
      heading: "Q2. Rank and nullity",
      lines: [
        "rref(A) has two pivots, so rank A = 2.",
        "Nullity = 3 − 2 = 1 by rank-nullity.",
        "Null space basis: { ( -1 , 2 , 1 )ᵀ }.",
      ],
      note: "The basis has to be derived from the reduced form, not asserted.",
    },
    {
      heading: "Q3. Subspace proof",
      lines: [
        "Let u, v ∈ W and c ∈ R. Then (u + v) satisfies x + 2y − z = 0 by linearity.",
        "(c u) satisfies it as well. 0 ∈ W since 0 + 0 − 0 = 0.",
        "Therefore W is a subspace of R³.",
      ],
      note: "A pair of worked examples is not a proof; the conclusion must be universal.",
    },
    {
      heading: "Q4. Inverse",
      lines: [
        "[ A | I ] → [ I | A⁻¹ ] with labeled operations.",
        "Verification: A A⁻¹ = I.",
      ],
      answer: { label: "A⁻¹ =", grid: [["1", "-1", "0"], ["0", "1", "-1"], ["0", "0", "1"]] },
      note: "Cramer or adjugate earn full arithmetic and justification credit.",
    },
  ],
};

export const slugFor = (name) => name.split(" ")[0].toLowerCase();
