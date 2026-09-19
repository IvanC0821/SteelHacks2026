"""In-memory API test inputs and a provider stub. No training or demo corpus."""

import hashlib
import json

from verity.provider import ProviderUnavailable
from verity.schemas import RubricInput

ASSIGNMENT = {
    "title": "API test assignment",
    "questions": [{"id": "q1", "title": "Question", "prompt": "Test prompt", "max_points": 4}],
}
RUBRIC = {
    "criteria": [
        {
            "id": "c1",
            "question_id": "q1",
            "description": "Private criterion one",
            "points": 1,
            "category": "arithmetic",
        },
        {
            "id": "c2",
            "question_id": "q1",
            "description": "Private criterion two",
            "points": 1,
            "category": "arithmetic",
        },
        {
            "id": "c3",
            "question_id": "q1",
            "description": "Private criterion three",
            "points": 2,
            "category": "justification",
        },
    ],
    "instructor_notes": "Private test notes",
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


def pdf_inputs():
    """Minimal parser inputs generated in memory for temporary test storage only."""
    return {
        "reference.pdf": make_pdf([["Private reference test payload"]]),
        "attempt-1.pdf": make_pdf([["API test case A"]]),
        "attempt-2.pdf": make_pdf([["API test case B"]]),
        "attempt-3.pdf": make_pdf([["API test case C"]]),
        "unreadable.pdf": make_pdf([[]]),
    }


def fingerprint(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()


class StubProvider:
    id = "api-test-stub"
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
        files = pdf_inputs()
        match = next(
            (
                name
                for name, data in files.items()
                if hashlib.sha256(data).hexdigest() == context["document"]["sha256"]
            ),
            None,
        )
        if match not in {"attempt-1.pdf", "attempt-2.pdf", "attempt-3.pdf", "unreadable.pdf"}:
            raise ProviderUnavailable("No fixture for this document")
        return {
            "decisions": [
                {
                    "criterion_id": c["id"],
                    "outcome": "uncertain"
                    if match == "unreadable.pdf"
                    else ("not_met" if c["id"] == "c3" and match == "attempt-1.pdf" else "met"),
                    "evidence_ids": ["p1"],
                    "rationale": (
                        "Test-only uncertain outcome."
                        if match == "unreadable.pdf"
                        else "Test-only negative outcome."
                        if c["id"] == "c3" and match == "attempt-1.pdf"
                        else "Test-only positive outcome."
                    ),
                }
                for c in RUBRIC["criteria"]
            ]
        }

    def draft_rubric(self, context):
        if context["assignment"]["questions"] != ASSIGNMENT["questions"]:
            raise ProviderUnavailable("No fixture rubric for this assignment")
        return RUBRIC
