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
    expect(pin).toHaveStyle({left: "92px", top: "280px"});
    expect(container.querySelector(".v-feedback-annotations__region")).toHaveStyle({
      left: "120px", top: "240px", width: "180px", height: "80px",
    });
    expect(container.querySelector(".v-feedback-annotations__pointer")).toHaveAttribute(
      "d", "M 104 280 L 120 280 M 115 276 L 120 280 L 115 284",
    );
    fireEvent.click(pin);
    expect(onSelect).toHaveBeenCalledWith(mark.id);
    expect(screen.getByRole("region", {name: "Feedback 1"})).toHaveTextContent(mark.message!);
    expect(container.querySelector(".v-feedback-annotations__connector")).toHaveAttribute(
      "d", "M 260 338 L 260 320",
    );
    expect(screen.getByRole("region")).toHaveStyle({top: "338px"});
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
    expect(container.querySelector(".v-feedback-annotations__pointer")).toBeNull();
    expect(container.querySelector(".v-feedback-annotations__connector")).toBeNull();
  });

  it("responds to panel selection, supports closing and reopening, and rescales coordinates", () => {
    const view = render(<FeedbackAnnotations marks={[mark]} width={600} height={800} />);
    view.rerender(<FeedbackAnnotations marks={[{...mark, selected:true}]} width={300} height={400} />);
    expect(screen.getByRole("region")).toBeVisible();
    const pin = screen.getByRole("button", {name: "Finding 1 on page 1"});
    expect(pin).toHaveStyle({left:"32px",top:"140px"});
    expect(view.container.querySelector(".v-feedback-annotations__region")).toHaveStyle({
      left:"60px", top:"120px", width:"90px", height:"40px",
    });
    expect(view.container.querySelector(".v-feedback-annotations__pointer")).toHaveAttribute(
      "d", "M 44 140 L 60 140 M 55 136 L 60 140 L 55 144",
    );
    expect(view.container.querySelector(".v-feedback-annotations__connector")).toHaveAttribute(
      "d", "M 150 178 L 150 160",
    );
    fireEvent.click(screen.getByRole("button",{name:"Close feedback"}));
    expect(screen.queryByRole("region")).toBeNull();
    expect(pin).toHaveFocus();
    fireEvent.click(pin);
    expect(screen.getByRole("region")).toBeVisible();
  });

  it("keeps the card inside a narrow page near its bottom right corner", () => {
    const {container} = render(<FeedbackAnnotations marks={[{...mark, bbox:[0.9,0.95,0.99,0.99],selected:true}]} width={250} height={350} />);
    const card=screen.getByRole("region");
    expect(card).toHaveStyle({left:"12px",top:"314.5px",width:"226px",maxHeight:"230px",transform:"translateY(-100%)"});
    expect(container.querySelector(".v-feedback-annotations__connector")).toHaveAttribute(
      "d", "M 225 314.5 L 225 332.5",
    );
    expect(container.querySelector("script")).toBeNull();
  });

  it("points from the right when a line reaches the left page edge", () => {
    const {container} = render(<FeedbackAnnotations marks={[{...mark, bbox:[0.01,0.3,0.5,0.32]}]} width={600} height={800} />);
    expect(screen.getByRole("button")).toHaveStyle({left:"328px",top:"248px"});
    expect(container.querySelector(".v-feedback-annotations__pointer")).toHaveAttribute(
      "d", "M 316 248 L 300 248 M 305 244 L 300 248 L 305 252",
    );
  });

  it("leaves room for the pin when placing a card to the left of a short line", () => {
    const {container} = render(<FeedbackAnnotations marks={[{...mark,bbox:[0.7,0.4,0.9,0.42],selected:true}]} width={600} height={800} />);
    expect(screen.getByRole("button", {name:"Finding 1 on page 1"})).toHaveStyle({left:"392px",top:"328px"});
    expect(screen.getByRole("region")).toHaveStyle({left:"90px",width:"280px"});
    expect(container.querySelector(".v-feedback-annotations__connector")).toHaveAttribute(
      "d", "M 370 328 L 420 328",
    );
  });

  it("removes a previous page's card and targets the next page's selected evidence", () => {
    const view = render(<FeedbackAnnotations marks={[{...mark,selected:true}]} width={600} height={800} />);
    const next = {...mark,id:"q2:flag:b1",page:2,label:2,bbox:[0.2,0.6,0.5,0.62] as Mark["bbox"]};
    view.rerender(<FeedbackAnnotations marks={[next]} width={600} height={800} />);
    expect(screen.queryByRole("region")).toBeNull();
    expect(screen.queryByRole("button",{name:"Finding 1 on page 1"})).toBeNull();
    fireEvent.click(screen.getByRole("button",{name:"Finding 2 on page 2"}));
    expect(screen.getByRole("region",{name:"Feedback 2"})).toHaveTextContent("Marked region on page 2");
    expect(view.container.querySelector(".v-feedback-annotations__pointer")).toHaveAttribute(
      "d", "M 104 488 L 120 488 M 115 484 L 120 488 L 115 492",
    );
  });

  it("treats invalid evidence geometry as page-level feedback", () => {
    const {container} = render(<FeedbackAnnotations marks={[{...mark,bbox:[0.2,0.3,0.1,0.4],selected:true}]} width={600} height={800} />);
    expect(screen.getByText(/Exact location unavailable/)).toBeVisible();
    expect(container.querySelector(".v-feedback-annotations__pointer")).toBeNull();
    expect(container.querySelector(".v-feedback-annotations__region")).toBeNull();
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
