"""Seed a local backend with a FICTIONAL course for frontend development.

Everything here is invented: course, people, homework, handwriting stand-ins. No real student
work, names, or grades. The PDFs are typed text so PDF.js has real pages to render and the
backend's text extraction has blocks to anchor flags to.

Usage (backend running on 127.0.0.1:8026 with the dev provider):

    PYTHONPATH=backend:. .venv/bin/python -m tools.seed_dev

Writes bearer tokens for every fictional identity to frontend/.dev/session.json (gitignored).
Re-running creates a fresh course; old ones stay in the database.
"""

import json
import os
import sys
import time
from datetime import UTC, datetime, timedelta
from pathlib import Path

import httpx
from verity.store import Store

API = os.getenv("VERITY_API", "http://127.0.0.1:8026")
DATA_DIR = os.getenv("VERITY_DATA_DIR", ".data")
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "frontend" / ".dev" / "session.json"

COURSE = "21-241 Linear Algebra (fictional section)"

QUESTIONS = [
    {
        "id": "q1",
        "title": "Solve the system",
        "prompt": "Solve the linear system by row reduction. Label every row operation and "
        "write the solution as a column vector.",
        "max_points": 8,
    },
    {
        "id": "q2",
        "title": "Rank and nullity",
        "prompt": "Find the rank and nullity of the matrix A and give a basis for its null space.",
        "max_points": 6,
    },
    {
        "id": "q3",
        "title": "Subspace proof",
        "prompt": "Prove that W = { (x, y, z) : x + 2y - z = 0 } is a subspace of R^3.",
        "max_points": 8,
    },
    {
        "id": "q4",
        "title": "Inverse",
        "prompt": "Find A^{-1} using the augmented matrix [A | I] and verify with one product.",
        "max_points": 8,
    },
]

RUBRIC = {
    "criteria": [
        {"id": "q1-ops", "question_id": "q1", "points": 3, "category": "presentation",
         "description": "Every row operation is labeled (R2 <- R2 - 2R1, etc.)"},
        {"id": "q1-arith", "question_id": "q1", "points": 3, "category": "arithmetic",
         "description": "Row reduction is carried out without arithmetic errors"},
        {"id": "q1-vector", "question_id": "q1", "points": 2, "category": "notation",
         "description": "Solution is written as a column vector, not a list"},
        {"id": "q2-rank", "question_id": "q2", "points": 2, "category": "arithmetic",
         "description": "Rank is correct and follows from the row-reduced form"},
        {"id": "q2-nullity", "question_id": "q2", "points": 1, "category": "logic",
         "description": "Nullity follows from rank-nullity, stated explicitly"},
        {"id": "q2-basis", "question_id": "q2", "points": 3, "category": "justification",
         "description": "Null-space basis vectors are derived, not guessed"},
        {"id": "q3-closure-add", "question_id": "q3", "points": 3, "category": "logic",
         "description": "Closure under addition is shown for arbitrary vectors"},
        {"id": "q3-closure-scalar", "question_id": "q3", "points": 3, "category": "logic",
         "description": "Closure under scalar multiplication is shown for arbitrary scalar"},
        {"id": "q3-zero", "question_id": "q3", "points": 1, "category": "justification",
         "description": "The zero vector is shown to be in W"},
        {"id": "q3-conclusion", "question_id": "q3", "points": 1, "category": "presentation",
         "description": "Proof ends with the universal conclusion, not an example"},
        {"id": "q4-augment", "question_id": "q4", "points": 2, "category": "presentation",
         "description": "Augmented matrix [A | I] is set up and reduced with labeled steps"},
        {"id": "q4-arith", "question_id": "q4", "points": 4, "category": "arithmetic",
         "description": "Inverse entries are correct"},
        {"id": "q4-verify", "question_id": "q4", "points": 2, "category": "justification",
         "description": "One product A A^{-1} = I is computed as verification"},
    ],
    "instructor_notes": "Alternative correct methods (Cramer, adjugate) earn full credit for "
    "arithmetic and justification. Presentation criteria are about labels and notation only.",
}

STUDENTS = [
    ("Amara Okafor", 2, True),
    ("Ben Castellano", 1, True),
    ("Chloe Nguyen", 2, True),
    ("Dev Patel", 1, True),
    ("Elena Petrova", 1, False),
    ("Farah Aziz", 2, False),
]


def make_pdf(pages: list[list[str]], title: str) -> bytes:
    """Deterministic text-only PDF. Letter size, Helvetica, one block per line."""
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    ]
    page_ids = []
    for number, lines in enumerate(pages, 1):
        pid = len(objects) + 1
        page_ids.append(pid)
        objects.append(
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
            f"/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents {pid + 1} 0 R >>".encode()
        )
        commands = [
            "BT /F2 11 Tf 54 750 Td",
            f"({esc(title)}    page {number} of {len(pages)}) Tj",
            "ET",
            "BT /F1 13 Tf 54 700 Td 22 TL",
        ]
        for line in lines:
            commands.append(f"({esc(line)}) Tj T*")
        commands.append("ET")
        stream = "\n".join(commands).encode("ascii")
        objects.append(f"<< /Length {len(stream)} >>\nstream\n".encode() + stream + b"\nendstream")
    objects[1] = (
        f"<< /Type /Pages /Count {len(pages)} /Kids ["
        + " ".join(f"{n} 0 R" for n in page_ids)
        + "] >>"
    ).encode()
    output = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for n, obj in enumerate(objects, 1):
        offsets.append(len(output))
        output.extend(f"{n} 0 obj\n".encode() + obj + b"\nendobj\n")
    xref = len(output)
    output.extend(f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode())
    for offset in offsets[1:]:
        output.extend(f"{offset:010d} 00000 n \n".encode())
    output.extend(
        f"trailer << /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
    )
    return bytes(output)


def esc(s: str) -> str:
    return s.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def questions_pdf():
    return make_pdf(
        [
            ["Homework 1", "", *(f"{i}. {q['title']}. {q['prompt']}" for i, q in enumerate(QUESTIONS, 1))],
        ],
        "Homework 1 (fictional)",
    )


def solution_pdf():
    return make_pdf(
        [
            ["Q1. Augmented matrix [2 1 -1 | 8; -3 -1 2 | -11; -2 1 2 | -3]",
             "R1 <- R1/2.  R2 <- R2 + 3R1.  R3 <- R3 + 2R1.",
             "R3 <- R3 - 4R2.  Back-substitute.",
             "x = [2, 3, -1]^T  (column vector)"],
            ["Q2. rref(A) has two pivots so rank A = 2.",
             "Nullity = 3 - 2 = 1 by rank-nullity.",
             "Null space basis: { (-1, 2, 1)^T }."],
            ["Q3. Let u, v in W, c in R. (u + v) satisfies x + 2y - z = 0 by linearity.",
             "(cu) satisfies it as well. 0 in W since 0 + 0 - 0 = 0.",
             "Therefore W is a subspace of R^3."],
            ["Q4. [A | I] -> [I | A^-1] with labeled operations.",
             "A^-1 = [ 1 -1 0; 0 1 -1; 0 0 1 ].  Check: A A^-1 = I."],
        ],
        "Instructor solution (fictional)",
    )


def student_pdf(name: str, version: int):
    """Two or three pages. Version 2 fixes the labels and the conclusion."""
    labels = version >= 2
    p1 = [
        f"{name} - Homework 1" + (" (revision)" if version > 1 else ""),
        "Q1. [2 1 -1 | 8; -3 -1 2 | -11; -2 1 2 | -3]",
        ("R2 <- R2 + 1.5R1, R3 <- R3 + R1" if labels else "-> [2 1 -1 | 8; 0 0.5 0.5 | 1; 0 2 1 | 5]"),
        "-> [2 1 -1 | 8; 0 0.5 0.5 | 1; 0 0 -1 | 1]",
        ("x = [2, 3, -1]^T" if labels else "x = 2, y = 3, z = -1"),
        "",
        "Q2. rref has 2 pivots, rank = 2, nullity = 1",
        "null space: (-1, 2, 1)",
    ]
    p2 = [
        "Q3. Take (1, 0, 1) and (0, 1, 2), both in W.",
        "Sum is (1, 1, 3): 1 + 2 - 3 = 0, so in W.",
        "3 * (1, 0, 1) = (3, 0, 3): 3 + 0 - 3 = 0, in W.",
        ("For arbitrary u, v in W and c in R the same identity holds by linearity," if labels else ""),
        ("so W is a subspace of R^3." if labels else "So W is a subspace."),
    ]
    p3 = [
        "Q4. [A | I] = [1 1 1 | 1 0 0; 0 1 1 | 0 1 0; 0 0 1 | 0 0 1]",
        ("R1 <- R1 - R2, R2 <- R2 - R3" if labels else "-> [1 0 0 | 1 -1 0; 0 1 0 | 0 1 -1; 0 0 1 | 0 0 1]"),
        "A^-1 = [1 -1 0; 0 1 -1; 0 0 1]",
        ("Check: A A^-1 = I" if labels else ""),
    ]
    return make_pdf([p1, p2, p3], f"{name} (fictional)")


class Client:
    def __init__(self, token):
        self.http = httpx.Client(base_url=API + "/api", headers={"Authorization": f"Bearer {token}"}, timeout=30)

    def call(self, method, path, **kw):
        r = self.http.request(method, path, **kw)
        if not r.is_success:
            sys.exit(f"{method} {path} -> {r.status_code} {r.text}")
        return r.json() if r.content else None


def wait_job(client, job_id):
    for _ in range(200):
        job = client.call("GET", f"/jobs/{job_id}")
        if job["status"] in {"succeeded", "failed"}:
            return job
        time.sleep(0.1)
    sys.exit(f"job {job_id} did not finish")


def main():
    try:
        httpx.get(API + "/health", timeout=3).raise_for_status()
    except Exception as exc:  # noqa: BLE001
        sys.exit(f"Backend not reachable at {API}: {exc}")

    store = Store(DATA_DIR)
    session = {"api": API, "users": {}}

    def user(name, role):
        u, token = store.provision_user(name, role, lifetime_hours=72)
        session["users"][name] = {"id": u["id"], "role": role, "token": token}
        return u["id"], Client(token)

    instructor_id, instructor = user("Dana Whitfield", "instructor")
    ta_id, ta = user("Sam Reyes", "ta")
    students = {name: user(name, "student") for name, _, _ in STUDENTS}

    course = instructor.call("POST", "/courses", json={"name": COURSE})
    cid = course["id"]
    instructor.call("POST", f"/courses/{cid}/members", json={"user_id": ta_id, "role": "ta"})
    for name, (sid, _) in students.items():
        instructor.call("POST", f"/courses/{cid}/members", json={"user_id": sid, "role": "student"})

    due = (datetime.now(UTC) + timedelta(days=5)).isoformat()
    hw = instructor.call(
        "POST",
        f"/courses/{cid}/assignments",
        json={"title": "Homework 1", "questions": QUESTIONS, "due_at": due},
    )
    aid = hw["id"]
    for kind, data, filename in (
        ("questions", questions_pdf(), "homework-1.pdf"),
        ("solution", solution_pdf(), "homework-1-solution.pdf"),
    ):
        instructor.call(
            "POST",
            f"/assignments/{aid}/documents",
            params={"kind": kind},
            files={"file": (filename, data, "application/pdf")},
        )
    instructor.call("PUT", f"/assignments/{aid}/rubric-draft", json=RUBRIC)
    instructor.call("POST", f"/assignments/{aid}/rubric-publish")

    # A second assignment with no rubric yet, so the assignment list shows two statuses.
    instructor.call(
        "POST",
        f"/courses/{cid}/assignments",
        json={
            "title": "Homework 2",
            "questions": [
                {"id": "q1", "title": "Determinants", "prompt": "Compute det(A) by cofactor expansion.", "max_points": 10},
                {"id": "q2", "title": "Eigenvalues", "prompt": "Find the eigenvalues of A and one eigenvector each.", "max_points": 10},
            ],
        },
    )

    mapping = {"questions": {"q1": [1], "q2": [1], "q3": [2], "q4": [3]}}
    finals = []
    for name, versions, hand_in in STUDENTS:
        _, client = students[name]
        latest = None
        for v in range(1, versions + 1):
            sub = client.call(
                "POST",
                f"/assignments/{aid}/documents",
                params={"kind": "submission"},
                files={"file": (f"hw1-{name.split()[0].lower()}-v{v}.pdf", student_pdf(name, v), "application/pdf")},
            )
            client.call("PUT", f"/submissions/{sub['id']}/mapping", json=mapping)
            job = client.call("POST", f"/submissions/{sub['id']}/assessment-jobs")
            wait_job(client, job["id"])
            latest = sub
        if hand_in and latest:
            client.call("POST", f"/submissions/{latest['id']}/hand-in")
            finals.append((name, latest["id"]))

    # One paper fully reviewed and released, one half reviewed, the rest untouched.
    if finals:
        name, sid = finals[0]
        review = ta.call(
            "PUT",
            f"/submissions/{sid}/review",
            json={
                "expected_revision": 0,
                "questions": {
                    "q1": {"score": 7, "reason": "Row operations labeled after revision; one sign slip."},
                    "q2": {"score": 6, "reason": "Complete."},
                    "q3": {"score": 6, "reason": "Closure shown for arbitrary vectors; zero vector not stated."},
                    "q4": {"score": 8, "reason": "Correct with verification."},
                },
            },
        )
        rev = review["revision"]
        done = ta.call("POST", f"/submissions/{sid}/review/complete", json={"expected_revision": rev})
        rev = done["revision"]
        instructor.call("POST", f"/submissions/{sid}/review/release", json={"expected_revision": rev})
    if len(finals) > 1:
        name, sid = finals[1]
        ta.call(
            "PUT",
            f"/submissions/{sid}/review",
            json={
                "expected_revision": 0,
                "questions": {
                    "q1": {"score": 5, "reason": "Unlabeled operations, solution as a list."},
                    "q2": {"score": 6, "reason": "Complete."},
                },
            },
        )
    # One student asks for help on Q3.
    if len(finals) > 2:
        name, sid = finals[2]
        students[name][1].call(
            "POST",
            f"/submissions/{sid}/reports",
            json={"question_id": "q3", "kind": "help", "message": "I don't see what is missing from my subspace proof."},
        )

    session["course_id"] = cid
    session["assignment_id"] = aid
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(session, indent=2))
    print(f"Seeded course {cid}, assignment {aid}. Tokens in {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
