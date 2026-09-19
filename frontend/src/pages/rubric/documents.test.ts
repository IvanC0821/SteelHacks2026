import { describe, expect, it } from "vitest";
import type { Capabilities, DocumentKind, DocumentMeta } from "../../api/types";
import { formatBytes, latestOfKind, setupChips, uploadError, uploadFailureMessage } from "./documents";

function doc(id: string, kind: DocumentKind, filename: string, page_count: number): DocumentMeta {
  return {
    id,
    assignment_id: "asg_1",
    kind,
    filename,
    page_count,
    sha256: id,
    extraction: "pdf_text",
    has_unreadable_pages: false,
  };
}

const capabilities: Capabilities = {
  provider_id: "dev-fixture",
  mode: "fixture",
  automated_assessment: true,
  ocr: false,
  extraction: "pdf_text_or_staff_transcript",
  max_upload_bytes: 15728640,
  max_pages: 40,
  human_review_required: true,
};

describe("setup strip", () => {
  it("shows the filename and page count of each kind", () => {
    const chips = setupChips([doc("d1", "questions", "homework-1.pdf", 1), doc("d2", "solution", "solution.pdf", 4)]);
    expect(chips.map((c) => c.label)).toEqual(["Blank assignment", "Instructor solution", "Graded examples (0)"]);
    expect(chips[0].detail).toBe("homework-1.pdf · 1 page");
    expect(chips[1].detail).toBe("solution.pdf · 4 pages");
    expect(chips[2].detail).toBeNull();
  });

  it("counts graded examples and shows the latest", () => {
    const chips = setupChips([doc("d1", "graded_example", "a.pdf", 2), doc("d2", "graded_example", "b.pdf", 3)]);
    expect(chips[2].label).toBe("Graded examples (2)");
    expect(chips[2].detail).toBe("b.pdf · 3 pages");
    expect(chips[2].count).toBe(2);
  });

  it("ignores student submissions", () => {
    const chips = setupChips([doc("d9", "submission", "attempt.pdf", 3)]);
    expect(chips.every((c) => c.detail === null)).toBe(true);
    expect(latestOfKind([doc("d9", "submission", "attempt.pdf", 3)], "solution")).toBeNull();
  });

  it("takes the last upload of a kind as the current one", () => {
    const docs = [doc("d1", "solution", "old.pdf", 2), doc("d2", "solution", "new.pdf", 4)];
    expect(latestOfKind(docs, "solution")?.filename).toBe("new.pdf");
  });
});

describe("upload guard", () => {
  it("accepts a PDF under the limit", () => {
    expect(uploadError({ name: "solution.pdf", size: 400_000, type: "application/pdf" }, capabilities)).toBeNull();
  });

  it("refuses anything that is not a PDF", () => {
    expect(uploadError({ name: "solution.png", size: 100, type: "image/png" }, capabilities)).toBe("Upload a PDF");
  });

  it("accepts a PDF whose type the browser did not fill in", () => {
    expect(uploadError({ name: "SOLUTION.PDF", size: 100, type: "" }, capabilities)).toBeNull();
  });

  it("refuses an empty file and one over the capability limit", () => {
    expect(uploadError({ name: "a.pdf", size: 0, type: "application/pdf" }, capabilities)).toBe("That file is empty");
    expect(uploadError({ name: "a.pdf", size: 20 * 1024 * 1024, type: "application/pdf" }, capabilities)).toBe(
      "That file is 20 MB; the limit is 15 MB",
    );
  });

  it("formats sizes the way the sentence reads", () => {
    expect(formatBytes(15728640)).toBe("15 MB");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(512)).toBe("512 bytes");
  });

  it("has a sentence for every upload failure it can name", () => {
    expect(uploadFailureMessage("questions_locked")).toMatch(/locked/);
    expect(uploadFailureMessage("nonsense_code")).toBe("The upload failed. Try again");
  });
});
