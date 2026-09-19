import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Chip } from "./Chip";
import { StatusChip } from "./StatusChip";
import { assessmentState } from "./status";

describe("<Chip>", () => {
  it("applies the tone class", () => {
    const { container } = render(<Chip tone="deduction">Arithmetic</Chip>);
    expect(container.querySelector(".v-chip")).toHaveClass("v-chip--deduction");
  });

  it("always says AI suggested for the ai tone, so colour is never the only signal", () => {
    render(<Chip tone="ai" />);
    expect(screen.getByText("AI suggested")).toBeInTheDocument();
  });

  it("keeps the AI wording even when a detail is passed", () => {
    render(<Chip tone="ai">not met</Chip>);
    expect(screen.getByText("AI suggested")).toBeInTheDocument();
    expect(screen.getByText("not met")).toBeInTheDocument();
  });

  it("always says Test fixture for the fixture tone", () => {
    render(<Chip tone="fixture" />);
    expect(screen.getByText("Test fixture")).toBeInTheDocument();
  });

  it("renders the numbered circle when a number is given", () => {
    const { container } = render(
      <Chip tone="hint" number={2}>
        Justification
      </Chip>,
    );
    expect(container.querySelector(".v-chip__number")?.textContent).toBe("2");
  });

  it("marks a selected chip", () => {
    const { container } = render(<Chip selected>Q1</Chip>);
    expect(container.querySelector(".v-chip")).toHaveClass("is-selected");
  });
});

describe("<StatusChip>", () => {
  it("uses the brief's exact review words", () => {
    const labels = (["not_started", "in_progress", "completed", "released"] as const).map((status) => {
      const { container, unmount } = render(<StatusChip kind="review" status={status} />);
      const text = container.textContent;
      unmount();
      return text;
    });
    expect(labels).toEqual(["Not started", "In review", "Completed", "Released"]);
  });

  it("uses the brief's exact assessment words", () => {
    const labels = (["not_checked", "estimated", "needs_review"] as const).map((status) => {
      const { container, unmount } = render(<StatusChip kind="assessment" status={status} />);
      const text = container.textContent;
      unmount();
      return text;
    });
    expect(labels).toEqual(["Not checked", "Estimated", "Needs review"]);
  });
});

describe("assessmentState", () => {
  it("maps a missing assessment to not_checked, not to a zero score", () => {
    expect(assessmentState(null)).toBe("not_checked");
    expect(assessmentState({ status: "estimated" })).toBe("estimated");
    expect(assessmentState({ status: "needs_review" })).toBe("needs_review");
  });
});
