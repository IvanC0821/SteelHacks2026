"""Real PDF text locations, display coordinates, and upload safety limits."""

import hashlib
from io import BytesIO
from pathlib import Path

import pytest
from pypdf import PdfReader, PdfWriter
from pypdf.generic import DecodedStreamObject, NameObject, RectangleObject
from verity import documents
from verity.schemas import Block

from .support import make_pdf


def rewrite_pdf(content, edit):
    writer = PdfWriter()
    writer.append(PdfReader(BytesIO(content)))
    edit(writer)
    output = BytesIO()
    writer.write(output)
    return output.getvalue()


def test_demo_has_separate_measured_regions_for_both_incorrect_steps():
    source = Path(__file__).parents[2] / "output/pdf/discrete-math-student-response.pdf"
    content = source.read_bytes()
    result = documents.inspect_pdf(content)
    assert result["sha256"] == hashlib.sha256(content).hexdigest()
    assert result["page_count"] == 1
    assert result["extraction"] == "pdf_text"
    assert not result["has_unreadable_pages"]
    blocks = result["blocks"]
    assert len(blocks) == 18
    assert all(b["id"].startswith("p1-l") and b["bbox"] is not None for b in blocks)
    for block in blocks:
        Block.model_validate(block)
    mistakes = [
        ("1 + 3 + ... + (2k - 1) + (2k - 1)", 372.211, 296.7),
        ("= k^2 + 2k - 1", 416.211, 165.6),
        ("= (k + 1)^2", 438.211, 144.9),
    ]
    regions = []
    for text, top, right in mistakes:
        region = next(b for b in blocks if b["text"] == text)
        assert region["bbox"] == pytest.approx(
            [69 / 612, top / 792, right / 612, (top + 11.5) / 792]
        )
        regions.append(region)
    assert len({b["id"] for b in regions}) == 3
    assert regions[0]["bbox"][3] < regions[1]["bbox"][1]
    assert regions[1]["bbox"][3] < regions[2]["bbox"][1]


@pytest.mark.parametrize(
    ("rotation", "expected"),
    [
        (0, [20 / 520, 30.484 / 180, 28.004 / 520, 42.484 / 180]),
        (90, [137.516 / 180, 20 / 520, 149.516 / 180, 28.004 / 520]),
        (180, [491.996 / 520, 137.516 / 180, 500 / 520, 149.516 / 180]),
        (270, [30.484 / 180, 491.996 / 520, 42.484 / 180, 500 / 520]),
    ],
)
@pytest.mark.parametrize("offset_media_origin", [False, True])
def test_line_box_matches_visible_crop_at_every_page_rotation(
    rotation, expected, offset_media_origin
):
    # Helvetica 12pt X, drawn at (50,740), occupies PDF coordinates
    # (50,737.516)-(58.004,749.516). These expectations are in the
    # displayed 520x180 crop, which becomes 180x520 after quarter-turns.
    def edit(writer):
        page = writer.pages[0]
        if offset_media_origin:
            page.mediabox = RectangleObject((10, 20, 622, 812))
        page.cropbox = RectangleObject((30, 600, 550, 780))
        page.rotate(rotation)

    content = rewrite_pdf(make_pdf([["X"]]), edit)
    result = documents.inspect_pdf(content)
    assert result["blocks"] == [
        {"id": "p1-l1", "page": 1, "text": "X", "bbox": pytest.approx(expected)}
    ]
    assert PdfReader(BytesIO(content)).pages[0].rotation == rotation


@pytest.mark.parametrize("rotation", [90, 180, 270])
def test_rotation_preserves_whole_math_lines_and_reading_order(rotation):
    lines = ["k^2 + 2k - 1", "= (k + 1)^2"]
    content = rewrite_pdf(make_pdf([lines]), lambda w: w.pages[0].rotate(rotation))
    result = documents.inspect_pdf(content)
    assert [b["text"] for b in result["blocks"]] == lines
    assert all(b["bbox"] for b in result["blocks"])


def test_visible_crop_excludes_hidden_text():
    content = rewrite_pdf(
        make_pdf([["Visible line", "Hidden line"]]),
        lambda w: setattr(w.pages[0], "cropbox", RectangleObject((0, 735, 612, 792))),
    )
    assert [b["text"] for b in documents.inspect_pdf(content)["blocks"]] == ["Visible line"]


def test_pages_and_unreadable_pages_are_counted_independently_of_line_count():
    result = documents.inspect_pdf(make_pdf([["First", "Second"], [], ["Last"]]))
    assert result["page_count"] == 3
    assert result["has_unreadable_pages"]
    assert [b["id"] for b in result["blocks"]] == ["p1-l1", "p1-l2", "p2", "p3-l1"]
    assert result["blocks"][2] == {"id": "p2", "page": 2, "text": "", "bbox": None}


def test_geometry_failure_keeps_text_without_fabricating_a_region(monkeypatch):
    def unavailable(*args, **kwargs):
        raise RuntimeError("layout parser cannot handle this page")

    monkeypatch.setattr(documents.pdfplumber, "open", unavailable)
    result = documents.inspect_pdf(make_pdf([["First", "Second"]]))
    assert result["blocks"] == [{"id": "p1", "page": 1, "text": "First\nSecond", "bbox": None}]
    assert not result["has_unreadable_pages"]


def test_size_limit_boundary_and_rejection_before_geometry(monkeypatch):
    content = make_pdf([["At the size limit"]])
    monkeypatch.setattr(documents, "MAX_BYTES", len(content))
    assert documents.inspect_pdf(content)["blocks"][0]["bbox"] is not None

    def unexpected(*args, **kwargs):
        pytest.fail("rejected input must not reach geometry extraction")

    monkeypatch.setattr(documents.pdfplumber, "open", unexpected)
    with pytest.raises(ValueError, match="no larger than 15 MiB"):
        documents.inspect_pdf(content + b"\n")


@pytest.mark.parametrize("failure", ["encrypted", "page_count", "page_text", "page_stream"])
def test_existing_pdf_limits_are_checked_before_geometry(failure, monkeypatch):
    if failure == "page_count":
        content = make_pdf([[]] * 41)
        message = "1–40 pages"
    elif failure == "page_text":
        content = make_pdf([["x" * 20001]])
        message = "Page text is too large"
    elif failure == "encrypted":
        content = rewrite_pdf(make_pdf([["x"]]), lambda w: w.encrypt("password"))
        message = "Encrypted PDFs"
    else:

        def edit(writer):
            stream = DecodedStreamObject()
            stream.set_data(b" " * (5 * 1024 * 1024 + 1))
            writer.pages[0][NameObject("/Contents")] = writer._add_object(stream)

        content = rewrite_pdf(make_pdf([[]]), edit)
        message = "Page content is too large"

    def unexpected(*args, **kwargs):
        pytest.fail("rejected input must not reach geometry extraction")

    monkeypatch.setattr(documents.pdfplumber, "open", unexpected)
    with pytest.raises(ValueError, match=message):
        documents.inspect_pdf(content)
