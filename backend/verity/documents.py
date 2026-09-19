import hashlib
from io import BytesIO

from pypdf import PdfReader

MAX_BYTES = 15 * 1024 * 1024
MAX_PAGES = 40


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
            if stream and len(stream.get_data()) > 5 * 1024 * 1024:
                raise ValueError("Page content is too large")
            text = (page.extract_text() or "").strip()
            if len(text) > 20000:
                raise ValueError("Page text is too large")
            blocks.append({"id": f"p{i}", "page": i, "text": text, "bbox": None})
    except ValueError:
        raise
    except Exception as exc:
        raise ValueError("PDF could not be parsed") from exc
    return {
        "sha256": hashlib.sha256(content).hexdigest(),
        "page_count": len(blocks),
        "blocks": blocks,
        "extraction": "pdf_text",
        "has_unreadable_pages": any(not b["text"] for b in blocks),
    }
