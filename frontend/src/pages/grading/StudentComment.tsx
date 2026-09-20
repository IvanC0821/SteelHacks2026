import { useState } from "react";
import { Button, Field } from "../../components";
import type { ReviewController } from "./useReview";

export function StudentComment({ questionId, studentName, savedText, controller }: {
  questionId: string;
  studentName: string;
  savedText: string;
  controller: ReviewController;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [saved, setSaved] = useState(false);
  const text = draft ?? savedText;
  const busy = controller.busy !== null;

  async function save() {
    if (text.trim().length > 4000) {
      setError("Keep the comment under 4,000 characters.");
      return;
    }
    const result = await controller.saveStudentComment(questionId, text.trim());
    if (result.ok) {
      setDraft(null);
      setSaved(true);
      setError(undefined);
    } else {
      setError(result.stale
        ? "Another staff member changed this review. Your text is kept. Check the saved comment before trying again."
        : "The comment could not be saved. Your text is kept. Try again.");
    }
  }

  return (
    <section className="v-grade-pane__block v-grade-student-comment" aria-label="Student comment">
      <Field
        as="textarea"
        label="Comment to student"
        value={text}
        rows={3}
        onChange={(value) => { setDraft(value); setSaved(false); setError(undefined); }}
        hint={`Visible to ${studentName} as soon as you save. Grades are released separately.`}
        placeholder="Point out what to revisit and suggest a next step"
        error={error}
        disabled={busy}
      />
      {error && savedText ? <p className="v-copy-14">Latest saved comment: {savedText}</p> : null}
      <Button variant="secondary" disabled={busy || text.trim() === savedText} onClick={() => void save()}>
        {!text.trim() && savedText ? "Remove comment" : "Save comment"}
      </Button>
      {saved ? <p className="v-label-12" role="status">{savedText ? `Comment shared with ${studentName}` : "Comment removed"}</p> : null}
    </section>
  );
}
