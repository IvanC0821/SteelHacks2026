import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CourseSwitcher } from "./CourseSwitcher";
import { SessionContext, type SessionValue } from "./session-context";
import { MemoryRouter } from "react-router-dom";

afterEach(cleanup);

function setup(collapsed = false, role = "student", count = 2) {
  const courses = [{ id: "algebra", name: "Linear Algebra" }, { id: "concepts", name: "21-127" }].slice(0, count);
  const selectCourse = vi.fn();
  const value = { courses, activeCourse: courses[0], selectCourse, user: { role } } as unknown as SessionValue;
  render(<MemoryRouter><SessionContext.Provider value={value}><CourseSwitcher collapsed={collapsed} /></SessionContext.Provider></MemoryRouter>);
  return selectCourse;
}

it("opens by clicking the course name and chooses another course", () => {
  const selectCourse = setup();
  const trigger = screen.getByRole("button", { name: "Linear Algebra" });
  expect(trigger).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(trigger);
  expect(screen.getAllByRole("button", { name: "Linear Algebra" })).toHaveLength(1);
  expect(trigger).toHaveAttribute("aria-expanded", "true");
  fireEvent.click(screen.getByRole("button", { name: "21-127" }));
  expect(selectCourse).toHaveBeenCalledWith("concepts");
  expect(trigger).toHaveAttribute("aria-expanded", "false");
});

it("offers create course to instructors even with no courses", () => {
  setup(false, "instructor", 0);
  expect(screen.getByRole("link", { name: "Create course" })).toHaveAttribute("href", "/courses/new");
});

it("does not show a one-course dropdown or offer students course creation", () => {
  const selectCourse = setup(false, "student", 1);
  const trigger = screen.getByRole("button", { name: "Linear Algebra" });
  expect(trigger).not.toHaveAttribute("aria-expanded");
  fireEvent.click(trigger);
  expect(selectCourse).toHaveBeenCalledWith("algebra");
  expect(screen.queryByRole("link", { name: "Create course" })).not.toBeInTheDocument();
});

it("closes with Escape and restores trigger focus", () => {
  setup();
  const trigger = screen.getByRole("button", { name: "Linear Algebra" });
  fireEvent.click(trigger);
  const option = screen.getByRole("button", { name: "21-127" });
  option.focus();
  fireEvent.keyDown(option, { key: "Escape" });
  expect(trigger).toHaveFocus();
  expect(trigger).toHaveAttribute("aria-expanded", "false");
});

it("also switches from the compact paper-view rail", () => {
  const selectCourse = setup(true);
  fireEvent.click(screen.getByRole("button", { name: "Switch course: Linear Algebra" }));
  fireEvent.click(screen.getByRole("button", { name: "21-127" }));
  expect(selectCourse).toHaveBeenCalledWith("concepts");
});
