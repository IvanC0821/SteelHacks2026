"""Build the discrete math demo PDFs from the shared, extractable-text content.

Run from the repository root: python tools/discrete_math/build_pdfs.py
Requires reportlab. The output contains only fictional student information.
"""

from __future__ import annotations

import json
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import simpleSplit
from reportlab.pdfgen.canvas import Canvas
from reportlab.platypus import Paragraph

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "output" / "pdf"
CONTENT = json.loads(Path(__file__).with_name("content.json").read_text())

INK = colors.HexColor("#142A3C")
MUTED = colors.HexColor("#596B77")
ACCENT = colors.HexColor("#087C80")
PALE = colors.HexColor("#EDF6F5")
RULE = colors.HexColor("#D8E2E7")
WIDTH, HEIGHT = 612, 792
LEFT, RIGHT = 52, 560


class Page:
    def __init__(self, filename: str, kind: str, title: str, subtitle: str):
        self.canvas = Canvas(str(OUTPUT / filename), pagesize=(WIDTH, HEIGHT), invariant=1)
        self.canvas.setTitle(title)
        self.canvas.setAuthor("Verity demo")
        self.canvas.setSubject("Discrete mathematics - fictional educational demo")
        self.canvas.setFillColor(ACCENT)
        self.canvas.rect(LEFT, 741, 34, 4, fill=1, stroke=0)
        self.canvas.setFont("Helvetica-Bold", 9)
        self.canvas.drawString(LEFT + 45, 738, "VERITY  /  DISCRETE MATHEMATICS")
        self.canvas.setFillColor(MUTED)
        self.canvas.setFont("Helvetica", 9)
        self.canvas.drawRightString(RIGHT, 738, kind.upper())
        self.y = 698
        self.heading(title, size=24, after=8)
        self.paragraph(subtitle, size=10, color=MUTED, after=23)

    def heading(self, text: str, size: float = 12, after: float = 9):
        self.canvas.setFillColor(INK)
        self.canvas.setFont("Helvetica-Bold", size)
        for line in simpleSplit(text, "Helvetica-Bold", size, RIGHT - LEFT):
            self.canvas.drawString(LEFT, self.y, line)
            self.y -= size * 1.18
        self.y -= after

    def paragraph(
        self,
        text: str,
        size: float = 11,
        color=INK,
        after: float = 13,
        left: float = LEFT,
        width: float = RIGHT - LEFT,
    ):
        style = ParagraphStyle(
            "body",
            fontName="Helvetica",
            fontSize=size,
            leading=size * 1.42,
            textColor=color,
            alignment=TA_LEFT,
        )
        paragraph = Paragraph(escape(text), style)
        _, height = paragraph.wrap(width, HEIGHT)
        paragraph.drawOn(self.canvas, left, self.y - height + size * 0.24)
        self.y -= height + after

    def equations(self, equations: list[str], size: float = 12, after: float = 18):
        height = len(equations) * 22 + 22
        top = self.y + 6
        self.canvas.setFillColor(PALE)
        self.canvas.roundRect(LEFT, top - height, RIGHT - LEFT, height, 7, fill=1, stroke=0)
        self.canvas.setFillColor(INK)
        self.canvas.setFont("Courier", size)
        for index, equation in enumerate(equations):
            self.canvas.drawString(LEFT + 17, top - 24 - 22 * index, equation)
        self.y = top - height - after

    def finish(self, note: str):
        if self.y < 68:
            raise ValueError(f"Content overlaps footer: y={self.y:.1f}")
        self.canvas.setStrokeColor(RULE)
        self.canvas.setLineWidth(0.6)
        self.canvas.line(LEFT, 49, RIGHT, 49)
        self.canvas.setFillColor(MUTED)
        self.canvas.setFont("Helvetica", 8)
        self.canvas.drawString(LEFT, 34, note)
        self.canvas.drawRightString(RIGHT, 34, "1 / 1")
        self.canvas.showPage()
        self.canvas.save()


def build_problem():
    question = CONTENT["question"]
    page = Page(
        "discrete-math-problem.pdf",
        "Problem sheet",
        "Odd numbers, square sums",
        "Question 1  |  Mathematical induction  |  10 points",
    )
    page.heading("Prove the identity")
    page.paragraph("For every integer n >= 1, prove:")
    page.equations(["1 + 3 + 5 + ... + (2n - 1) = n^2"], size=14, after=26)
    page.paragraph(question["prompt"])
    page.y -= 8
    page.heading("What to include")
    for item in [
        "1. A verified base case.",
        "2. An induction hypothesis for an arbitrary integer k >= 1.",
        "3. The transition from k terms to k + 1 terms.",
        "4. The algebra and final induction conclusion.",
    ]:
        page.paragraph(item, after=8)
    page.y -= 17
    page.heading("Write a connected proof")
    page.paragraph(
        "Explain why each step follows. You may use ordinary algebra and the definition of "
        "mathematical induction. State which part of your induction step uses the hypothesis.",
        color=MUTED,
    )
    page.finish("Demonstration assignment | Original educational problem")


def build_student():
    student = CONTENT["student"]
    page = Page(
        "discrete-math-student-response.pdf",
        "Student submission",
        "A proof by induction",
        f"{student['name']}  |  Fictional sample student  |  Question 1",
    )
    page.paragraph("Claim: 1 + 3 + ... + (2n - 1) = n^2 for every integer n >= 1.", after=22)
    for step in student["steps"]:
        page.heading(step["label"], after=5)
        page.paragraph(step["text"], after=18)
        if "equations" in step:
            page.equations(step["equations"], size=11.5, after=22)
    page.finish("Fictional sample submission | Created for a grading demonstration")


def build_guide():
    page = Page(
        "discrete-math-instructor-guide.pdf",
        "Instructor guide",
        "Solution and scoring guide",
        "Question 1  |  10 points total  |  Fictional sample: Farah Aziz",
    )
    page.heading("A complete proof", after=5)
    proof = CONTENT["correct_proof"]
    page.paragraph(f"{proof['base']} {proof['hypothesis']} {proof['extension']}", size=10, after=11)
    page.equations(proof["equations"], size=11, after=14)
    page.paragraph(proof["conclusion"], size=10, after=17)
    page.heading("Rubric and illustrative manual score: 4 / 10", after=6)
    page.paragraph(
        "Each criterion earns all of its points if met, or zero if not met. The sample earns:",
        size=9.5,
        after=11,
    )
    rows = [
        ("Base case", "2 / 2", "Correctly verifies n = 1: both sides equal 1."),
        ("Induction hypothesis", "2 / 2", "Correctly assumes the identity for arbitrary k >= 1."),
        ("Correct extension", "0 / 3", "Repeats 2k - 1. The next term is 2k + 1."),
        ("Valid successor algebra", "0 / 3", "k^2 + 2k - 1 is not (k + 1)^2; it is 2 smaller."),
    ]
    for title, score, explanation in rows:
        page.canvas.setFillColor(INK)
        page.canvas.setFont("Helvetica-Bold", 10)
        page.canvas.drawString(LEFT, page.y, title)
        page.canvas.drawRightString(RIGHT, page.y, score)
        page.y -= 17
        page.paragraph(explanation, size=9.5, color=MUTED, after=8)
        page.canvas.setStrokeColor(RULE)
        page.canvas.setLineWidth(0.5)
        page.canvas.line(LEFT, page.y + 3, RIGHT, page.y + 3)
        page.y -= 11
    page.y -= 3
    page.heading("Feedback to guide a revision", after=5)
    page.paragraph(CONTENT["manual_reference"]["feedback"], size=9.5, after=9)
    page.paragraph(
        "The 4/10 score is a manually checked reference. An automated result still requires "
        "instructor review before release.",
        size=8.5,
        color=MUTED,
        after=0,
    )
    page.finish("Instructor reference | Deliberate errors occur only in the sample response")


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    build_problem()
    build_student()
    build_guide()
    for path in sorted(OUTPUT.glob("discrete-math-*.pdf")):
        print(path.relative_to(ROOT))


if __name__ == "__main__":
    main()
