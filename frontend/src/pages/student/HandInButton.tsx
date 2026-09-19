import { useState } from "react";
import { Button, Dialog, useToast } from "../../components";
import { useClient } from "../../app";
import { ApiError } from "../../api/client";
import type { StudentSubmission } from "../../api/types";
import { handInGate } from "./lib/attempts";

export interface HandInButtonProps {
  submission: StudentSubmission;
  attempts: StudentSubmission[];
  dueAt: string | null;
  /** refetch the submission and the attempt list once the hand-in lands */
  onDone: () => void;
  variant?: "primary" | "secondary";
  size?: "md" | "lg";
  /** hides the button entirely instead of disabling it, for rows where it would be noise */
  hideWhenBlocked?: boolean;
}

const CONFLICTS: Record<string, string> = {
  already_handed_in: "You already handed in an attempt for this assignment.",
  hand_in_latest_attempt: "Only the latest attempt can be handed in.",
  mapping_required: "Assign pages to every question before you hand in.",
  deadline_passed: "The due date has passed, so hand in is closed.",
};

/** Hand in is irreversible, so it is the one student action behind a dialog. The gate mirrors the
 *  backend's rules; a 409 still wins and is explained rather than retried. */
export function HandInButton({
  submission,
  attempts,
  dueAt,
  onDone,
  variant = "primary",
  size = "lg",
  hideWhenBlocked = false,
}: HandInButtonProps) {
  const client = useClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const gate = handInGate({ submission, attempts, dueAt });
  if (!gate.allowed && hideWhenBlocked) return null;

  async function confirm() {
    setBusy(true);
    try {
      await client.handIn(submission.id);
      setOpen(false);
      toast({ message: "Handed in" });
      onDone();
    } catch (cause) {
      const code = cause instanceof ApiError ? cause.code : "network";
      setOpen(false);
      toast({ message: CONFLICTS[code] ?? "Hand in did not go through. Try again.", tone: "error" });
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        disabled={!gate.allowed}
        title={gate.reason ?? undefined}
        onClick={() => setOpen(true)}
      >
        Hand in
      </Button>
      <Dialog
        open={open}
        title={`Hand in attempt ${submission.version}?`}
        description="Later uploads stay practice and cannot replace it."
        onClose={() => setOpen(false)}
        primary={{ label: "Hand in", onClick: () => void confirm(), busy }}
        secondary={{ label: "Cancel", onClick: () => setOpen(false) }}
      />
    </>
  );
}
