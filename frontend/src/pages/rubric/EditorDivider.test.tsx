import { useRef, useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditorDivider } from "./EditorDivider";

let containerWidth = 1384;
let phone = false;
let resize: () => void;

beforeEach(() => {
  containerWidth = 1384;
  phone = false;
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(() => containerWidth);
  vi.stubGlobal("matchMedia", () => ({ matches: phone }));
  vi.stubGlobal("ResizeObserver", class {
    constructor(callback: () => void) { resize = callback; }
    observe() {}
    disconnect() {}
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function Workspace() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(480);
  return <div ref={containerRef}><EditorDivider containerRef={containerRef} width={width} onWidthChange={setWidth} /></div>;
}

describe("rubric editor resizing", () => {
  it("lets keyboard users resize the right panel and reach both size limits", () => {
    render(<Workspace />);
    const divider = screen.getByRole("separator", { name: "Resize rubric editor" });
    fireEvent.keyDown(divider, { key: "ArrowLeft" });
    expect(divider).toHaveAttribute("aria-valuenow", "504");
    fireEvent.keyDown(divider, { key: "ArrowRight" });
    expect(divider).toHaveAttribute("aria-valuenow", "480");
    fireEvent.keyDown(divider, { key: "Home" });
    fireEvent.keyDown(divider, { key: "ArrowRight" });
    expect(divider).toHaveAttribute("aria-valuenow", "320");
    fireEvent.keyDown(divider, { key: "End" });
    fireEvent.keyDown(divider, { key: "ArrowLeft" });
    expect(divider).toHaveAttribute("aria-valuenow", "680");
  });

  it("shrinks the editor when the workspace narrows, leaving room for the reference", () => {
    render(<Workspace />);
    containerWidth = 760;
    act(() => resize());
    const divider = screen.getByRole("separator");
    expect(divider).toHaveAttribute("aria-valuemax", "388");
    expect(divider).toHaveAttribute("aria-valuenow", "388");
    fireEvent.keyDown(divider, { key: "End" });
    expect(divider).toHaveAttribute("aria-valuenow", "388");
  });

  it("preserves the desktop preference while the phone layout hides the divider", () => {
    render(<Workspace />);
    phone = true;
    containerWidth = 390;
    act(() => resize());
    expect(screen.getByRole("separator")).toHaveAttribute("aria-valuenow", "480");
  });
});
