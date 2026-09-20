import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Sparkles, Trash2 } from "lucide-react";
import { PageHeader } from "../../app/PageHeader";
import { useSession } from "../../app/session-context";
import { rememberCourse } from "../../app/course-selection";
import { ApiError } from "../../api/client";
import type { CourseDeduction, CourseDeductions } from "../../api/types";
import { Button, Field, Notice } from "../../components";
import "./new-course.css";

const blank = (): CourseDeduction => ({ description: "", penalty: null, source_page: null, source_quote: "" });
const ERRORS: Record<string, string> = {
  course_pdf_needs_text: "This PDF has pages without readable text. Use a typed/text-selectable PDF, or enter deductions manually. OCR is not enabled.",
  course_pdf_too_long: "This PDF is too long for autofill. Upload just the pages with grading rules, or enter the rules manually.",
  course_autofill_unavailable: "The configured provider cannot autofill course deductions. You can still enter them manually.",
  course_autofill_failed: "Autofill could not return a source-verified draft. No rules were saved. Retry explicitly or enter them manually.",
  invalid_course_deductions: "Check the course name and deduction descriptions. Keep the name under 200 characters.",
  pdf_too_large: "Choose a PDF no larger than 15 MiB.",
  instructor_required: "Only an instructor can create a course.",
  network: "The backend could not be reached. Your entries are still here; try again.",
};

export function NewCourse() {
  const { client, user, capabilities, refresh } = useSession();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [draft, setDraft] = useState<CourseDeductions>({ rules: [], notes: "" });
  const [busy, setBusy] = useState<"extract" | "create" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [extracted, setExtracted] = useState(false);
  const request = useRef<{ signature: string; id: string } | null>(null);
  const canExtract = capabilities.course_deduction_extraction === true;
  const report = (cause: unknown) => {
    if (cause instanceof ApiError && cause.expired) throw cause;
    const code = cause instanceof ApiError ? cause.code : "unknown";
    setError(ERRORS[code] ?? "This operation could not be completed. Check that the file is a valid, unencrypted PDF (1–40 pages), then try again.");
  };
  const update = (index: number, field: "description" | "penalty", value: string) => {
    setDraft((old) => ({ ...old, rules: old.rules.map((rule, i) => i === index ? { ...rule, [field]: value } : rule) }));
  };
  const extract = async () => {
    if (!file) return;
    setBusy("extract"); setError(null);
    try {
      const result = await client.extractCourseDeductions(file);
      setDraft(result.draft); setExtracted(true);
    } catch (cause) { report(cause); }
    finally { setBusy(null); }
  };
  const create = async () => {
    if (!name.trim() || name.trim().length > 200 || draft.rules.some((rule) => !rule.description.trim())) {
      setError("Enter a course name (up to 200 characters) and a description for each deduction, or remove empty rows.");
      return;
    }
    setBusy("create"); setError(null);
    const input = { ...draft, rules: draft.rules.map((rule) => ({ ...rule, description: rule.description.trim(), penalty: rule.penalty?.trim() || null })) };
    const signature = JSON.stringify([name.trim(), input, file?.name, file?.size, file?.lastModified]);
    if (request.current?.signature !== signature) request.current = { signature, id: crypto.randomUUID() };
    try {
      const course = await client.createCourseWithDeductions(name.trim(), input, file, request.current.id);
      rememberCourse(user.id, course.id);
      refresh();
      navigate(`/c/${course.id}`);
    } catch (cause) { report(cause); }
    finally { setBusy(null); }
  };

  if (user.role !== "instructor") return <Notice tone="error">Only instructors can create courses.</Notice>;
  return <>
    <PageHeader title="Create course" subtitle="Upload a grading sheet, review its deductions, and save." />
    <form className="v-new-course" onSubmit={(event) => { event.preventDefault(); void create(); }}>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Field label="Course name" value={name} onChange={setName} disabled={!!busy} required autoFocus placeholder="21-127 Concepts of Mathematics" />
      <section className="v-new-course__section" aria-labelledby="course-pdf-heading">
        <h2 id="course-pdf-heading" className="v-heading-16">Deduction or grading PDF</h2>
        <p className="v-copy-14">Use a course-wide grading sheet or syllabus with explicit deduction rules, not a homework solution. PDF only, up to 15 MiB and 40 pages.</p>
        <label className="v-label-14" htmlFor="course-pdf">Upload PDF (optional)</label>
        <input id="course-pdf" type="file" accept=".pdf,application/pdf" disabled={!!busy}
          onChange={(event) => {
            const selected = event.target.files?.[0] ?? null;
            if (selected && (!selected.name.toLowerCase().endsWith(".pdf") || selected.size > 15 * 1024 * 1024)) {
              setError("Choose a PDF no larger than 15 MiB."); event.target.value = "";
              setFile(null); setDraft({ rules: [], notes: "" }); setExtracted(false); return;
            }
            setFile(selected); setDraft({ rules: [], notes: "" }); setExtracted(false); setError(null);
          }} />
        <p className="v-label-12 v-muted">Autofill sends extracted PDF text to the configured model provider{capabilities.provider_id.startsWith("openrouter:") ? " (OpenRouter)" : ""}. Only use documents you are allowed to share. The original PDF is saved privately when you create the course.</p>
        <Button icon={Sparkles} onClick={() => void extract()} busy={busy === "extract"} disabled={!file || !canExtract || busy === "create"}
          title={!file ? "Choose a PDF first" : !canExtract ? "Autofill is unavailable; enter deductions below" : busy ? "Please wait" : undefined}>
          {extracted ? "Re-extract deductions" : "Autofill deductions"}
        </Button>
        {busy === "extract" ? <p role="status" className="v-copy-14">Reading deduction rules… this can take up to a minute.</p> : null}
        {!canExtract ? <Notice>Autofill is not available on this backend. You can still enter deductions manually.</Notice> : null}
      </section>
      <section className="v-new-course__section" aria-labelledby="course-rules-heading">
        <h2 id="course-rules-heading" className="v-heading-16">Review deductions</h2>
        <p className="v-copy-14">Check the amount, units, scope, caps, and exceptions. A blank penalty means unspecified, not zero. These rules guide new homework rubric drafts; grading still uses the instructor-published homework rubric.</p>
        {extracted && draft.rules.length === 0 ? <Notice>No explicit deduction rules were found. Add your own below or create the course without deductions.</Notice> : null}
        <ol className="v-new-course__rules">
          {draft.rules.map((rule, index) => <li key={index} className="v-new-course__rule">
            <div className="v-new-course__rule-heading"><h3 className="v-heading-14">Deduction {index + 1}</h3>
              <Button icon={Trash2} iconOnly aria-label={`Remove deduction ${index + 1}`} disabled={!!busy} title={busy ? "Please wait" : undefined}
                onClick={() => setDraft((old) => ({ ...old, rules: old.rules.filter((_, i) => i !== index) }))} />
            </div>
            <Field label={`Rule ${index + 1}`} as="textarea" rows={2} value={rule.description} onChange={(value) => update(index, "description", value)} disabled={!!busy} required />
            <Field label={`Penalty ${index + 1}`} value={rule.penalty ?? ""} onChange={(value) => update(index, "penalty", value)} disabled={!!busy}
              placeholder="For example: 1 point per missing justification, capped at 3 points per problem" />
            {rule.source_quote ? <details className="v-copy-14"><summary>PDF source, page {rule.source_page}</summary><blockquote>{rule.source_quote}</blockquote></details> : null}
          </li>)}
        </ol>
        <Button icon={Plus} disabled={!!busy || draft.rules.length >= 100} title={busy ? "Please wait" : draft.rules.length >= 100 ? "Maximum 100 rules" : undefined}
          onClick={() => setDraft((old) => ({ ...old, rules: [...old.rules, blank()] }))}>Add deduction</Button>
        <Field label="Notes and exceptions" as="textarea" rows={3} value={draft.notes} disabled={!!busy} onChange={(notes) => setDraft((old) => ({ ...old, notes }))} />
      </section>
      <div className="v-new-course__actions">
        <Button onClick={() => navigate(-1)} disabled={!!busy} title={busy ? "Please wait" : undefined}>Cancel</Button>
        <Button type="submit" variant="primary" busy={busy === "create"} disabled={busy === "extract"} title={busy === "extract" ? "Wait for the draft, then review it" : undefined}>Create course</Button>
      </div>
      <p className="v-label-12 v-muted">Creating confirms your reviewed rules and enrolls you as instructor. Enroll students and TAs from the course roster afterward.</p>
    </form>
  </>;
}
