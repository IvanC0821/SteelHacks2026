import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FeedbackAnnotations } from "./FeedbackAnnotations";
import type { Mark } from "./marks";

afterEach(cleanup);
const mark: Mark = { id: "q1:flag:a1", page: 1, label: 1, tone: "hint", bbox: [0.2, 0.3, 0.5, 0.4], message: "Check the sign in this step.", title: "Arithmetic" };

describe("PDF feedback annotations", () => {
  it("opens a connected card at an evidence region and restores focus on Escape", () => {
    const onSelect = vi.fn();
    const {container} = render(<FeedbackAnnotations marks={[mark]} width={600} height={800} onMarkSelect={onSelect} />);
    const pin = screen.getByRole("button", {name: "Finding 1 on page 1"});
    expect(pin).toHaveStyle({left: "120px", top: "240px"});
    fireEvent.click(pin);
    expect(onSelect).toHaveBeenCalledWith(mark.id);
    expect(screen.getByRole("region", {name: "Feedback 1"})).toHaveTextContent(mark.message!);
    expect(container.querySelector("svg path")).toBeTruthy();
    expect(pin).toHaveAttribute("aria-expanded", "true");
    fireEvent.keyDown(screen.getByRole("button", {name: "Close feedback"}), {key: "Escape"});
    expect(screen.queryByRole("region")).toBeNull();
    expect(pin).toHaveFocus();
  });

  it("keeps page-only feedback in the margin and labels its location honestly", () => {
    const {container} = render(<FeedbackAnnotations marks={[{...mark, bbox: null}]} width={300} height={400} />);
    const pin = screen.getByRole("button", {name: "Finding 1 on page 1"});
    expect(pin).toHaveStyle({left: "-16px"});
    fireEvent.click(pin);
    expect(screen.getByText(/Exact location unavailable/)).toBeVisible();
    expect(container.querySelector(".v-feedback-annotations__region")).toBeNull();
  });

  it("responds to panel selection, supports closing and reopening, and rescales coordinates", () => {
    const view = render(<FeedbackAnnotations marks={[mark]} width={600} height={800} />);
    view.rerender(<FeedbackAnnotations marks={[{...mark, selected:true}]} width={300} height={400} />);
    expect(screen.getByRole("region")).toBeVisible();
    const pin = screen.getByRole("button", {name: "Finding 1 on page 1"});
    expect(pin).toHaveStyle({left:"60px",top:"120px"});
    fireEvent.click(screen.getByRole("button",{name:"Close feedback"}));
    expect(screen.queryByRole("region")).toBeNull();
    fireEvent.click(pin);
    expect(screen.getByRole("region")).toBeVisible();
  });

  it("keeps the card inside a narrow page near its bottom right corner", () => {
    const {container} = render(<FeedbackAnnotations marks={[{...mark, bbox:[0.9,0.95,0.99,0.99],selected:true}]} width={250} height={350} />);
    const card=screen.getByRole("region");
    expect(card).toHaveStyle({left:"12px",top:"108px",width:"226px"});
    expect(container.querySelector("script")).toBeNull();
  });
});

it("keeps the clicked anchor active when one finding selects several regions", () => {
  const second = {...mark, id:"q1:flag:a2", bbox:[0.2,0.6,0.5,0.7] as Mark["bbox"]};
  const view = render(<FeedbackAnnotations marks={[mark, second]} width={600} height={800} />);
  const pins = screen.getAllByRole("button", {name:"Finding 1 on page 1"});
  fireEvent.click(pins[1]);
  view.rerender(<FeedbackAnnotations marks={[{...mark,selected:true},{...second,selected:true}]} width={600} height={800} />);
  expect(pins[1]).toHaveAttribute("aria-expanded", "true");
  expect(pins[0]).toHaveAttribute("aria-expanded", "false");
});
