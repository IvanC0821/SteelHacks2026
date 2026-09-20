import { describe, expect, it } from "vitest";
import type { Capabilities, DocumentKind, DocumentMeta } from "../../api/types";
import { formatBytes, latestOfKind, referenceDocuments, referenceLabel, uploadError, uploadFailureMessage } from "./documents";

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

describe("reference picker", () => {
  it("defaults to the solution and omits empty categories", () => {
    const references = referenceDocuments([doc("d1", "questions", "homework-1.pdf", 1), doc("d2", "solution", "solution.pdf", 4)]);
    expect(references.map(referenceLabel)).toEqual(["Instructor solution — solution.pdf", "Blank assignment — homework-1.pdf"]);
  });

  it("makes every graded example independently selectable", () => {
    const references = referenceDocuments([doc("d1", "graded_example", "a.pdf", 2), doc("d2", "graded_example", "b.pdf", 3)]);
    expect(references.map((document) => document.id)).toEqual(["d1", "d2"]);
    expect(references.map(referenceLabel)).toEqual(["Graded example — a.pdf", "Graded example — b.pdf"]);
  });

  it("ignores student submissions", () => {
    expect(referenceDocuments([doc("d9", "submission", "attempt.pdf", 3)])).toEqual([]);
    expect(latestOfKind([doc("d9", "submission", "attempt.pdf", 3)], "solution")).toBeNull();
  });

  it("takes the last upload of a kind as the current one", () => {
    const docs = [doc("d1", "solution", "old.pdf", 2), doc("d2", "solution", "new.pdf", 4), doc("d3", "questions", "homework.pdf", 1)];
    expect(latestOfKind(docs, "solution")?.filename).toBe("new.pdf");
    expect(referenceDocuments(docs).map((document) => document.id)).toEqual(["d2", "d3"]);
    expect(referenceDocuments(docs.filter((document) => document.kind !== "solution"))[0].id).toBe("d3");
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
