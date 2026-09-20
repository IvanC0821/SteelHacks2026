"""Generate matching editable TeX and text-extractable PDFs; never run untrusted TeX.

Run with the artifact environment: .venv/bin/python -m tools.build_concepts127
Requires reportlab, pylatexenc and pypdf (authoring dependencies, not backend dependencies).
"""

import json
import os
from html import escape
from pathlib import Path
from zipfile import ZipFile

from pylatexenc.latex2text import LatexNodes2Text
from pypdf import PdfReader
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import KeepTogether, PageBreak, Paragraph, SimpleDocTemplate, Spacer

from tools.concepts127_materials import HOMEWORKS

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output/pdf/21-127"
PRIVATE = ROOT / ".data/21-127-private"
TEX = LatexNodes2Text()


def plain(text):
    return TEX.latex_to_text(text).strip().replace("–", "-").replace("—", "-")


def setup_fonts():
    regular = Path(
        os.getenv("VERITY_PDF_FONT", "/System/Library/Fonts/Supplemental/Arial Unicode.ttf")
    )
    bold = Path(
        os.getenv("VERITY_PDF_BOLD_FONT", "/System/Library/Fonts/Supplemental/Arial Bold.ttf")
    )
    pdfmetrics.registerFont(TTFont("Concepts", str(regular)))
    pdfmetrics.registerFont(TTFont("ConceptsBold", str(bold)))
    all_text = "".join(
        plain(p)
        for hw in HOMEWORKS
        for q in hw["questions"]
        for k in ("prompt", "reference", "clean", "mixed")
        for p in q[k]
    )
    font = pdfmetrics.getFont("Concepts")
    missing = sorted(
        {c for c in all_text if not c.isspace() and ord(c) not in font.face.charToGlyph}
    )
    if missing:
        raise ValueError(f"Body font is missing glyphs: {missing!r}")


def make_pdf(path, hw, kind, variant=None):
    body = ParagraphStyle("body", fontName="Concepts", fontSize=11, leading=17, spaceAfter=12)
    heading = ParagraphStyle(
        "heading",
        fontName="ConceptsBold",
        fontSize=19,
        leading=24,
        textColor=colors.HexColor("#16474e"),
        spaceAfter=16,
    )
    subheading = ParagraphStyle("question", parent=heading, fontSize=13, leading=18, spaceAfter=12)
    label = ParagraphStyle(
        "label",
        fontName="Concepts",
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#56666a"),
        spaceAfter=12,
    )
    doc = SimpleDocTemplate(
        str(path),
        pagesize=(612, 792),
        rightMargin=54,
        leftMargin=54,
        topMargin=82,
        bottomMargin=58,
        title=f"21-127 | {hw['title']}",
        author="Verity fictional course materials",
    )

    def page_frame(canvas, _doc):
        canvas.setStrokeColor(colors.HexColor("#c9d9dc"))
        canvas.line(54, 744, 558, 744)
        canvas.setFont("ConceptsBold", 10)
        canvas.setFillColor(colors.HexColor("#16474e"))
        canvas.drawString(54, 760, "21-127  /  CONCEPTS OF MATHEMATICS")
        canvas.setFont("Concepts", 8)
        canvas.setFillColor(colors.HexColor("#56666a"))
        canvas.drawString(
            54, 35, "Original fictional practice material - not an official course handout"
        )
        canvas.drawRightString(558, 35, f"{_doc.page}")

    story = []
    if kind == "questions":
        story += [
            Paragraph(escape(hw["title"]), heading),
            Paragraph("Five questions. Each question is worth 10 points (50 total).", label),
            Paragraph(
                "Write a clear argument when requested. Valid alternative proofs and clear detours are welcome. "
                "Follow each exercise's specific requirements. This handout contains no solutions.",
                body,
            ),
        ]
    for i, q in enumerate(hw["questions"], 1):
        if kind != "questions":
            if i > 1:
                story.append(PageBreak())
            story += [
                Paragraph(escape(hw["title"]), heading),
                Paragraph(
                    "Staff reference - not a student upload"
                    if kind == "reference"
                    else f"Practice submission {variant.upper()} | Student: Fictional learner",
                    label,
                ),
            ]
        title = Paragraph(f"Question {i}. {escape(q['title'])}", subheading)
        paragraphs = [
            Paragraph(escape(plain(p)), body) for p in q["prompt" if kind == "questions" else kind]
        ]
        story.append(KeepTogether([title, paragraphs[0]]))
        story.extend(paragraphs[1:])
        story.append(Spacer(1, 14))
    doc.build(story, onFirstPage=page_frame, onLaterPages=page_frame)
    reader = PdfReader(path)
    if kind != "questions":
        assert len(reader.pages) == 5, f"Expected one page per problem: {path}"
        for i, page in enumerate(reader.pages, 1):
            assert f"Question {i}." in page.extract_text()
    assert all(len(page.extract_text().strip()) > 100 for page in reader.pages)


def make_tex(path, hw, kind, variant):
    parts = [
        r"\documentclass[11pt]{article}",
        r"\usepackage[margin=1in]{geometry}",
        r"\usepackage{amsmath,amssymb}",
        r"\setlength{\parindent}{0pt}",
        r"\setlength{\parskip}{0.7em}",
        r"\begin{document}",
    ]
    for i, q in enumerate(hw["questions"], 1):
        if i > 1:
            parts.append(r"\newpage")
        parts += [
            r"\textbf{21-127 Concepts of Mathematics (fictional)}",
            "",
            rf"{hw['title']} --- Practice submission {variant.upper()}",
            "",
            r"Student: Fictional learner",
            "",
            rf"\section*{{Question {i}: {q['title']}}}",
            "",
        ]
        parts += [p + "\n" for p in q[kind]]
    parts.append(r"\end{document}")
    path.write_text("\n".join(parts) + "\n")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    PRIVATE.mkdir(parents=True, exist_ok=True, mode=0o700)
    PRIVATE.chmod(0o700)
    setup_fonts()
    manifest = []
    for number, hw in enumerate(HOMEWORKS, 1):
        questions = OUT / f"{hw['slug']}-questions.pdf"
        reference = PRIVATE / f"{hw['slug']}-solutions.pdf"
        make_pdf(questions, hw, "questions")
        make_pdf(reference, hw, "reference")
        reference.chmod(0o600)
        row = {
            "slug": hw["slug"],
            "questions": str(questions),
            "reference": str(reference),
            "samples": [],
        }
        for variant, kind in (("a", "clean"), ("b", "mixed")):
            stem = f"21-127-hw{number}-student-{variant}"
            pdf, tex = OUT / f"{stem}.pdf", OUT / f"{stem}.tex"
            make_pdf(pdf, hw, kind, variant)
            make_tex(tex, hw, kind, variant)
            row["samples"].append(
                {"variant": variant, "kind": kind, "pdf": str(pdf), "tex": str(tex)}
            )
        manifest.append(row)
    (PRIVATE / "materials.json").write_text(json.dumps(manifest, indent=2) + "\n")
    with ZipFile(OUT / "21-127-upload-samples.zip", "w") as archive:
        for row in manifest:
            archive.write(row["questions"], Path(row["questions"]).name)
            for sample in row["samples"]:
                for kind in ("pdf", "tex"):
                    archive.write(sample[kind], Path(sample[kind]).name)
        archive.write(OUT / "README.md", "README.md")
    print(
        json.dumps({"pdfs": 8, "student_pairs": 4, "output": str(OUT), "references_private": True})
    )


if __name__ == "__main__":
    main()
