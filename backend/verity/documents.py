import hashlib
from io import BytesIO
from math import isfinite

import pdfplumber
from pypdf import PdfReader, PdfWriter

MAX_BYTES = 15 * 1024 * 1024
MAX_PAGES = 40


def _visible_box(page):
    """PDF.js displays the intersection of the crop and media boxes."""
    media = tuple(float(v) for v in page.mediabox)
    crop = tuple(float(v) for v in page.cropbox)
    box = (
        max(media[0], crop[0]),
        max(media[1], crop[1]),
        min(media[2], crop[2]),
        min(media[3], crop[3]),
    )
    return box if box[0] < box[2] and box[1] < box[3] else media


def _line_blocks(page, original_page, page_number):
    left, bottom, right, top = _visible_box(original_page)
    width, height = right - left, top - bottom
    if not all(isfinite(v) for v in (left, bottom, right, top)) or min(width, height) <= 0:
        return []

    # pdfplumber uses top-origin coordinates; its unrotated y origin is the
    # media-box height even when the media box itself has a nonzero origin.
    crop_top = page.height - top
    visible = page.crop((left, crop_top, right, page.height - bottom), strict=False)
    lines = visible.extract_text_lines(return_chars=False)
    blocks = []
    for line in lines:
        text = line["text"].strip()
        if not text:
            continue
        box = [
            (line["x0"] - left) / width,
            (line["top"] - crop_top) / height,
            (line["x1"] - left) / width,
            (line["bottom"] - crop_top) / height,
        ]
        if not all(isfinite(v) for v in box):
            continue
        x0, y0, x1, y1 = (max(0.0, min(1.0, v)) for v in box)
        if x0 >= x1 or y0 >= y1:
            continue
        # Rotate measured coordinates into the original displayed viewport.
        box = {
            0: [x0, y0, x1, y1],
            90: [1 - y1, x0, 1 - y0, x1],
            180: [1 - x1, 1 - y1, 1 - x0, 1 - y0],
            270: [y0, 1 - x1, y1, 1 - x0],
        }[original_page.rotation % 360]
        blocks.append(
            {
                "id": f"p{page_number}-l{len(blocks) + 1}",
                "page": page_number,
                "text": text,
                "bbox": box,
            }
        )
    return blocks


def _add_line_geometry(reader, fallback_blocks):
    # Extract logical lines with page rotation removed, otherwise rotated math
    # can be fragmented into individual words. The uploaded PDF is unchanged.
    pdf = None
    try:
        writer = PdfWriter()
        for page in reader.pages:
            writer.add_page(page).rotation = 0
        stream = BytesIO()
        writer.write(stream)
        stream.seek(0)
        pdf = pdfplumber.open(stream)
        pages = pdf.pages
        if len(pages) != len(fallback_blocks):
            pdf.close()
            return fallback_blocks
    except Exception:
        if pdf is not None:
            pdf.close()
        return fallback_blocks

    blocks = []
    with pdf:
        for i, fallback in enumerate(fallback_blocks):
            try:
                lines = _line_blocks(pages[i], reader.pages[i], i + 1)
            except Exception:
                # Text without reliable geometry must never acquire an invented
                # location; the existing text-only fallback remains usable.
                lines = []
            if sum(len(line["text"]) for line in lines) > 20000:
                raise ValueError("Page text is too large")
            blocks.extend(lines or [fallback])
            pages[i].close()
    return blocks


def inspect_pdf(content: bytes):
    if not content.startswith(b"%PDF-") or len(content) > MAX_BYTES:
        raise ValueError("Upload a PDF no larger than 15 MiB")
    try:
        reader = PdfReader(BytesIO(content), strict=True)
        if reader.is_encrypted:
            raise ValueError("Encrypted PDFs are not supported")
        if not 1 <= len(reader.pages) <= MAX_PAGES:
            raise ValueError("PDF must contain 1–40 pages")
        blocks = []
        for i, page in enumerate(reader.pages, 1):
            # Limit decompressed content before extraction where pypdf exposes it.
            stream = page.get_contents()
            if stream is not None and len(stream.get_data()) > 5 * 1024 * 1024:
                raise ValueError("Page content is too large")
            text = (page.extract_text() or "").strip()
            if len(text) > 20000:
                raise ValueError("Page text is too large")
            blocks.append({"id": f"p{i}", "page": i, "text": text, "bbox": None})
        # All original size, encryption and page limits are checked before a
        # second parser touches the document.
        blocks = _add_line_geometry(reader, blocks)
    except ValueError:
        raise
    except Exception as exc:
        raise ValueError("PDF could not be parsed") from exc
    return {
        "sha256": hashlib.sha256(content).hexdigest(),
        "page_count": len(reader.pages),
        "blocks": blocks,
        "extraction": "pdf_text",
        "has_unreadable_pages": any(not b["text"] for b in blocks),
    }
