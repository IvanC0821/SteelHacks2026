import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Score } from "./Score";
import { formatDelta, formatPoints, deltaToneClass } from "./score-format";

describe("formatPoints", () => {
  it("drops a trailing zero and keeps one decimal", () => {
    expect(formatPoints(8)).toBe("8");
    expect(formatPoints(8.0)).toBe("8");
    expect(formatPoints(7.5)).toBe("7.5");
    expect(formatPoints(7.46)).toBe("7.5");
  });
});

describe("formatDelta", () => {
  it("signs the number and uses a real minus sign", () => {
    expect(formatDelta(2)).toBe("+2");
    expect(formatDelta(-1.5)).toBe("−1.5");
    expect(formatDelta(0)).toBe("0");
  });
});

describe("deltaToneClass", () => {
  it("is credit above zero, deduction below, neutral at zero", () => {
    expect(deltaToneClass(1)).toBe("v-score--credit");
    expect(deltaToneClass(-1)).toBe("v-score--deduction");
    expect(deltaToneClass(0)).toBe("v-score--neutral");
  });
});

describe("<Score>", () => {
  it("renders null as Needs review, never 0", () => {
    render(<Score value={null} />);
    expect(screen.getByText("Needs review")).toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("accepts a different null label without inventing a number", () => {
    render(<Score value={null} nullLabel="Not checked" />);
    expect(screen.getByText("Not checked")).toBeInTheDocument();
  });

  it("renders a real zero as 0", () => {
    render(<Score value={0} max={8} />);
    expect(screen.getByText(/^0$/)).toBeInTheDocument();
  });

  it("adds the Estimated label only when asked", () => {
    const { unmount } = render(<Score value={19} max={30} estimated />);
    expect(screen.getByText("Estimated")).toBeInTheDocument();
    unmount();
    render(<Score value={19} max={30} />);
    expect(screen.queryByText("Estimated")).not.toBeInTheDocument();
  });

  it("prints the max beside the value", () => {
    render(<Score value={19} max={30} />);
    expect(screen.getByText("/ 30")).toBeInTheDocument();
  });

  it("colours a delta by sign", () => {
    const { container } = render(<Score value={-2} delta />);
    const node = container.querySelector(".v-score-value");
    expect(node).toHaveClass("v-score--deduction");
    expect(node?.textContent).toBe("−2");
  });

  it("colours a positive delta green", () => {
    const { container } = render(<Score value={2} delta />);
    expect(container.querySelector(".v-score-value")).toHaveClass("v-score--credit");
  });
});
