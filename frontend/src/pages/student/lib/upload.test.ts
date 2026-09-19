import { describe, expect, it } from "vitest";
import type { Capabilities } from "../../../api/types";
import { formatBytes, isPdf, uploadError, uploadFailure, uploadHint } from "./upload";

const capabilities: Capabilities = {
  provider_id: "dev-fixture",
  mode: "fixture",
  automated_assessment: true,
  ocr: false,
  extraction: "pdf_text",
  max_upload_bytes: 15 * 1024 * 1024,
  max_pages: 40,
  human_review_required: true,
};

describe("drop zone", () => {
  it("accepts a PDF inside the limit", () => {
    expect(uploadError({ name: "hw1.pdf", type: "application/pdf", size: 120_000 }, capabilities)).toBeNull();
  });

  it("accepts a PDF whose type the browser did not fill in", () => {
    expect(isPdf({ name: "hw1.PDF", type: "" })).toBe(true);
    expect(isPdf({ name: "hw1.png", type: "image/png" })).toBe(false);
  });

  it("refuses anything that is not a PDF", () => {
    expect(uploadError({ name: "photo.png", type: "image/png", size: 100 }, capabilities)).toBe(
      "Upload a PDF. Other file types are not accepted.",
    );
  });

  it("refuses an empty file", () => {
    expect(uploadError({ name: "hw1.pdf", type: "application/pdf", size: 0 }, capabilities)).toBe(
      "That file is empty.",
    );
  });

  it("refuses a PDF over the capability limit and names the limit", () => {
    expect(
      uploadError({ name: "hw1.pdf", type: "application/pdf", size: 20 * 1024 * 1024 }, capabilities),
    ).toBe("That PDF is larger than the 15 MB limit.");
  });

  it("states the limits before anything fails", () => {
    expect(uploadHint(capabilities)).toBe("PDF only, up to 15 MB, 40 pages at most.");
    expect(uploadHint(null)).toBe("PDF only.");
  });

  it("formats sizes without a decimal tail on whole megabytes", () => {
    expect(formatBytes(15 * 1024 * 1024)).toBe("15 MB");
    expect(formatBytes(1_600_000)).toBe("1.5 MB");
    expect(formatBytes(4_000)).toBe("4 KB");
  });
});

describe("upload failures", () => {
  it("passes the backend's written reason through", () => {
    expect(uploadFailure("PDF must contain 1–40 pages")).toBe("PDF must contain 1–40 pages.");
    expect(uploadFailure("Encrypted PDFs are not supported")).toBe("Encrypted PDFs are not supported.");
  });

  it("explains a closed assignment", () => {
    expect(uploadFailure("deadline_passed")).toBe(
      "The due date has passed, so this assignment no longer takes uploads.",
    );
  });

  it("falls back to one plain sentence for an unknown code", () => {
    expect(uploadFailure("http_500")).toBe("The upload did not go through. Try again.");
  });
});
