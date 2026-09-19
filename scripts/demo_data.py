"""Fresh fictional PDFs, independent of old Verity source and any student records."""

import hashlib
import json

from verity.provider import ProviderUnavailable
from verity.schemas import RubricInput

ASSIGNMENT = {
    "title": "Linear systems: explain your reasoning",
    "questions": [
        {
            "id": "q1",
            "title": "Solve the system",
            "prompt": "Solve x + y = 5 and x - y = 1. Show a valid derivation. Any valid method is accepted.",
            "max_points": 4,
        }
    ],
}
RUBRIC = {
    "criteria": [
        {
            "id": "x",
            "question_id": "q1",
            "description": "Correct x = 3",
            "points": 1,
            "category": "arithmetic",
        },
        {
            "id": "y",
            "question_id": "q1",
            "description": "Correct y = 2",
            "points": 1,
            "category": "arithmetic",
        },
        {
            "id": "work",
            "question_id": "q1",
            "description": "Show a valid derivation; elimination, substitution and other valid methods accepted",
            "points": 2,
            "category": "justification",
        },
    ],
    "instructor_notes": "Award derivation credit only for justified steps. Accept alternative methods.",
}


def make_pdf(pages: list[list[str]]) -> bytes:
    """Tiny ASCII text-only PDF writer for fixtures. Deterministic bytes, no real records."""
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    page_ids = []
    for lines in pages:
        pid = len(objects) + 1
        page_ids.append(pid)
        objects.append(
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
            f"/Resources << /Font << /F1 3 0 R >> >> /Contents {pid + 1} 0 R >>".encode()
        )
        commands = ["BT /F1 12 Tf 50 740 Td 18 TL"]
        for line in lines:
            escaped = line.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
            commands.append(f"({escaped}) Tj T*")
        stream = ("\n".join(commands) + "\nET").encode("ascii")
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


def demo_pdfs():
    return {
        "questions.pdf": make_pdf(
            [
                [
                    "VERITY - FICTIONAL DEMO ASSIGNMENT",
                    "Question 1 (4 points)",
                    ASSIGNMENT["questions"][0]["prompt"][:100],
                    "Show a valid derivation. Any valid method is accepted.",
                ]
            ]
        ),
        "solution.pdf": make_pdf(
            [
                [
                    "PRIVATE INSTRUCTOR REFERENCE - FICTIONAL DEMO",
                    "Add the two equations: 2x = 6, so x = 3.",
                    "Substitute in x + y = 5 to obtain y = 2.",
                    "Other valid derivations receive full credit.",
                ]
            ]
        ),
        "attempt-1.pdf": make_pdf(
            [["FICTIONAL STUDENT WORK - DEMO ONLY", "Question 1", "x = 3, y = 2"]]
        ),
        "attempt-2.pdf": make_pdf(
            [
                [
                    "FICTIONAL STUDENT WORK - DEMO ONLY",
                    "Question 1",
                    "(x + y) + (x - y) = 5 + 1",
                    "2x = 6, x = 3",
                    "3 + y = 5, y = 2",
                ]
            ]
        ),
        "alternative.pdf": make_pdf(
            [
                [
                    "FICTIONAL STUDENT WORK - DEMO ONLY",
                    "Question 1",
                    "x - y = 1 implies x = y + 1",
                    "(y + 1) + y = 5",
                    "2y = 4, y = 2, x = 3",
                ]
            ]
        ),
        "unreadable.pdf": make_pdf([[]]),
    }


def fingerprint(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()


class DemoProvider:
    id = "scripted-fictional-fixtures-v1"
    mode = "fixture"

    def assess(self, context):
        expected_rubric = {k: context["rubric"][k] for k in RUBRIC}
        if fingerprint(expected_rubric) != fingerprint(
            RubricInput.model_validate(RUBRIC).model_dump(mode="json")
        ):
            raise ProviderUnavailable("Fixture rubric mismatch")
        if context["assignment"]["questions"] != ASSIGNMENT["questions"]:
            raise ProviderUnavailable("Fixture question mismatch")
        if context["submission"]["mapping"] != {"q1": [1]}:
            raise ProviderUnavailable("Fixture mapping mismatch")
        if context["document"]["extraction"] != "pdf_text":
            raise ProviderUnavailable("Fixture transcript mismatch")
        files = demo_pdfs()
        match = next(
            (
                name
                for name, data in files.items()
                if hashlib.sha256(data).hexdigest() == context["document"]["sha256"]
            ),
            None,
        )
        if match not in {"attempt-1.pdf", "attempt-2.pdf", "alternative.pdf", "unreadable.pdf"}:
            raise ProviderUnavailable("No fixture for this document")
        return {
            "decisions": [
                {
                    "criterion_id": c["id"],
                    "outcome": "uncertain"
                    if match == "unreadable.pdf"
                    else ("not_met" if c["id"] == "work" and match == "attempt-1.pdf" else "met"),
                    "evidence_ids": ["p1"],
                    "rationale": (
                        "Scripted illustration: unreadable input."
                        if match == "unreadable.pdf"
                        else "Scripted illustration: reasoning absent."
                        if c["id"] == "work" and match == "attempt-1.pdf"
                        else "Scripted illustration: criterion met."
                    ),
                }
                for c in RUBRIC["criteria"]
            ]
        }

    def draft_rubric(self, context):
        if context["assignment"]["questions"] != ASSIGNMENT["questions"]:
            raise ProviderUnavailable("No fixture rubric for this assignment")
        return RUBRIC


def create_provider():
    return DemoProvider()
