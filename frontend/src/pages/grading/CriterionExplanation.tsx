import { useState } from "react";
import { Button, Field } from "../../components";
import type { ReviewController } from "./useReview";

interface Props {
  criterionId: string;
  original: string;
  correction?: string;
  isFixture: boolean;
  readOnly: boolean;
  controller: ReviewController;
}

export function CriterionExplanation({ criterionId, original, correction, isFixture, readOnly, controller }: Props) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [saved, setSaved] = useState(false);
  const busy = controller.busy !== null;

  async function save() {
    const value = text.trim();
    if (!value || value.length > 2000) {
      setError(!value ? "Write an explanation before saving." : "Keep the explanation under 2,000 characters.");
      return;
    }
    const result = await controller.saveExplanation(criterionId, value);
    if (result.ok) {
      setEditing(false);
      setSaved(true);
      setError(undefined);
    } else {
      setError(result.stale
        ? "Another staff member changed this review. Your text is kept. Check the latest explanation before saving again."
        : "The explanation could not be saved. Your text is kept. Try again.");
    }
  }

  return (
    <details className="v-grade-criterion__why">
      <summary className="v-label-12">Why</summary>
      {editing && !readOnly ? (
        <div className="v-grade-explanation__editor">
          <Field
            as="textarea"
            label="Explanation"
            value={text}
            onChange={(value) => { setText(value); setError(undefined); }}
            hint="Only for this paper. Private to staff. The score is saved separately."
            error={error}
            disabled={busy}
            autoFocus
          />
          {error && correction ? <p className="v-copy-14">Latest saved explanation: {correction}</p> : null}
          <div className="v-grade-explanation__actions">
            <Button variant="primary" disabled={busy} onClick={() => void save()}>Save explanation</Button>
            <Button variant="quiet" disabled={busy} onClick={() => { setEditing(false); setError(undefined); }}>Cancel</Button>
          </div>
        </div>
      ) : (
        <>
          <p className="v-copy-14 v-grade-explanation__text">{correction ?? original}</p>
          {correction ? <p className="v-label-12">Edited by staff</p> : null}
          {!readOnly ? (
            <Button variant="quiet" disabled={busy} onClick={() => {
              setText(correction ?? original);
              setError(undefined);
              setSaved(false);
              setEditing(true);
            }}>Edit explanation</Button>
          ) : null}
          {saved ? <p className="v-label-12" role="status">Explanation saved</p> : null}
        </>
      )}
      {correction ? (
        <details className="v-grade-explanation__original">
          <summary className="v-label-12">{isFixture ? "Original example" : "Original model explanation"}</summary>
          <p className="v-copy-14">{original}</p>
        </details>
      ) : null}
    </details>
  );
}
