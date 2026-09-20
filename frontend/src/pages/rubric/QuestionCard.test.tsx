import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Criterion, Question } from "../../api/types";
import { QuestionCard } from "./QuestionCard";

const question: Question = { id: "q1", title: "Solve the system", prompt: "", max_points: 8 };
const criterion: Criterion = { id: "c1", question_id: "q1", description: "Show each row operation", points: 8, category: "justification" };

beforeEach(() => vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} }));
afterEach(() => vi.unstubAllGlobals());

function Card({ canEdit = true }: { canEdit?: boolean }) {
  const [expanded, setExpanded] = useState(true);
  const [criteria, setCriteria] = useState([criterion]);
  return <QuestionCard
    question={question}
    criteria={criteria}
    canEdit={canEdit}
    expanded={expanded}
    onToggle={() => setExpanded((current) => !current)}
    onAdd={vi.fn()}
    onRemove={vi.fn()}
    onUpdate={(id, patch) => setCriteria((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item))}
  />;
}

describe("collapsible rubric questions", () => {
  it("keeps unsaved criterion text and point totals when a question is closed and reopened", () => {
    render(<Card />);
    fireEvent.change(screen.getByRole("textbox", { name: "Criterion for Solve the system" }), { target: { value: "Accept any valid elimination sequence" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Points" }), { target: { value: "6" } });
    const toggle = screen.getByRole("button", { name: /^Solve the system/ });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveTextContent("6 of 8 points assigned");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    fireEvent.click(toggle);
    expect(screen.getByRole("textbox")).toHaveValue("Accept any valid elimination sequence");
    expect(screen.getByRole("spinbutton")).toHaveValue(6);
  });

  it("lets TAs open questions while retaining read-only criteria", () => {
    render(<Card canEdit={false} />);
    const toggle = screen.getByRole("button", { name: /^Solve the system/ });
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    expect(screen.getByRole("textbox")).toBeDisabled();
    expect(screen.getByRole("spinbutton")).toBeDisabled();
    expect(screen.queryByRole("button", { name: /Add criterion/ })).not.toBeInTheDocument();
  });
});
