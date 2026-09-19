import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { SessionContext, type SessionValue } from "../../app/session-context";
import type { Capabilities } from "../../api/types";
import { UploadZone } from "./UploadZone";

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

function withSession(children: ReactNode) {
  const value = { capabilities } as unknown as SessionValue;
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

describe("UploadZone", () => {
  it("states the real limits from capabilities", () => {
    render(withSession(<UploadZone onFile={vi.fn()} />));
    expect(screen.getByText("PDF only, up to 15 MB, 40 pages at most.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Choose a PDF" })).toBeEnabled();
  });

  it("closes itself with the reason after the due date", () => {
    render(withSession(<UploadZone onFile={vi.fn()} disabledReason="The due date has passed, so uploads are closed" />));
    expect(screen.getByText("The due date has passed, so uploads are closed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Choose a PDF" })).toBeDisabled();
  });

  it("shows the upload failure the caller passes back", () => {
    render(withSession(<UploadZone onFile={vi.fn()} failure="PDF must contain 1–40 pages." />));
    expect(screen.getByText("PDF must contain 1–40 pages.")).toBeInTheDocument();
  });
});
