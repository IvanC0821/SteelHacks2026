import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { SessionContext, type SessionValue } from "../../app/session-context";
import { ApiError } from "../../api/client";
import { NewCourse } from "./NewCourse";

afterEach(() => { cleanup(); localStorage.clear(); });

function setup({ role = "instructor", enabled = true } = {}) {
  const extractCourseDeductions = vi.fn().mockResolvedValue({ draft: {
    rules: [{ description: "Missing justification", penalty: "1 point per step", source_page: 1, source_quote: "Deduct 1 point per step." }],
    notes: "No deduction for harmless detours.",
  }, provider_id: "fixture", page_count: 1 });
  const createCourseWithDeductions = vi.fn().mockResolvedValue({ id: "new-course", name: "Concepts" });
  const refresh = vi.fn();
  const value = { client: { extractCourseDeductions, createCourseWithDeductions }, user: { id: "teacher", role },
    capabilities: { course_deduction_extraction: enabled, provider_id: "openrouter:test" }, refresh } as unknown as SessionValue;
  render(<MemoryRouter initialEntries={["/courses/new"]}><SessionContext.Provider value={value}>
    <Routes><Route path="/courses/new" element={<NewCourse />} /><Route path="/c/:id" element={<h1>Saved course</h1>} /></Routes>
  </SessionContext.Provider></MemoryRouter>);
  const file = new File(["%PDF-1.7"], "deductions.pdf", { type: "application/pdf" });
  const upload = () => fireEvent.change(screen.getByLabelText("Upload PDF (optional)"), { target: { files: [file] } });
  return { extractCourseDeductions, createCourseWithDeductions, refresh, upload, file };
}

it("uploads only after explicit autofill and saves edited, reviewed deductions with the PDF", async () => {
  const state = setup();
  fireEvent.change(screen.getByLabelText("Course name"), { target: { value: "Concepts" } });
  state.upload();
  expect(state.extractCourseDeductions).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Autofill deductions" }));
  await screen.findByDisplayValue("Missing justification");
  expect(state.extractCourseDeductions).toHaveBeenCalledWith(state.file);
  fireEvent.change(screen.getByLabelText("Penalty 1"), { target: { value: "2 points per problem" } });
  fireEvent.click(screen.getByRole("button", { name: "Create course" }));
  await screen.findByRole("heading", { name: "Saved course" });
  expect(state.createCourseWithDeductions).toHaveBeenCalledWith("Concepts", expect.objectContaining({
    rules: [expect.objectContaining({ penalty: "2 points per problem", source_page: 1 })],
  }), state.file, expect.any(String));
  expect(state.refresh).toHaveBeenCalledOnce();
});

it("supports manual creation without an AI provider or a PDF", async () => {
  const state = setup({ enabled: false });
  expect(screen.getByRole("button", { name: "Autofill deductions" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Course name"), { target: { value: "Manual course" } });
  fireEvent.click(screen.getByRole("button", { name: "Add deduction" }));
  fireEvent.change(screen.getByLabelText("Rule 1"), { target: { value: "Explain key steps" } });
  fireEvent.click(screen.getByRole("button", { name: "Create course" }));
  await screen.findByRole("heading", { name: "Saved course" });
  expect(state.createCourseWithDeductions).toHaveBeenCalledWith("Manual course", expect.objectContaining({
    rules: [expect.objectContaining({ penalty: null, description: "Explain key steps" })],
  }), null, expect.any(String));
});

it("keeps extraction errors actionable and never silently creates a course", async () => {
  const state = setup();
  state.extractCourseDeductions.mockRejectedValue(new ApiError(422, "course_pdf_needs_text"));
  state.upload(); fireEvent.click(screen.getByRole("button", { name: "Autofill deductions" }));
  await screen.findByText(/OCR is not enabled/);
  expect(state.createCourseWithDeductions).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Autofill deductions" })).toBeEnabled();
});

it("clears a previous draft when the source PDF changes", async () => {
  const state = setup();
  state.upload(); fireEvent.click(screen.getByRole("button", { name: "Autofill deductions" }));
  await screen.findByDisplayValue("Missing justification");
  fireEvent.change(screen.getByLabelText("Upload PDF (optional)"), { target: { files: [new File(["test"], "other.pdf")] } });
  expect(screen.queryByLabelText("Rule 1")).not.toBeInTheDocument();
});

it("rejects non-PDF inputs without calling the provider", () => {
  const state = setup();
  fireEvent.change(screen.getByLabelText("Upload PDF (optional)"), { target: { files: [new File(["test"], "homework.tex")] } });
  expect(screen.getByText("Choose a PDF no larger than 15 MiB.")).toBeInTheDocument();
  expect(state.extractCourseDeductions).not.toHaveBeenCalled();
});

it("keeps the same idempotency key when retrying an unchanged creation request", async () => {
  const state = setup();
  state.createCourseWithDeductions.mockRejectedValue(new ApiError(0, "network"));
  fireEvent.change(screen.getByLabelText("Course name"), { target: { value: "Retry course" } });
  fireEvent.click(screen.getByRole("button", { name: "Create course" }));
  await screen.findByText(/Your entries are still here/);
  fireEvent.click(screen.getByRole("button", { name: "Create course" }));
  await waitFor(() => expect(state.createCourseWithDeductions).toHaveBeenCalledTimes(2));
  expect(state.createCourseWithDeductions.mock.calls[0][3]).toBe(state.createCourseWithDeductions.mock.calls[1][3]);
});

it.each(["student", "ta"])("does not offer creation to %s", (role) => {
  setup({ role });
  expect(screen.queryByRole("button", { name: "Create course" })).not.toBeInTheDocument();
  expect(screen.getByText("Only instructors can create courses.")).toBeInTheDocument();
});
