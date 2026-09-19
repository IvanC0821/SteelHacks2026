import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, useToast } from "../../components";
import { useCapabilities, useClient } from "../../app";
import { ApiError } from "../../api/client";
import type { StudentSubmission } from "../../api/types";
import { uploadError, uploadFailure } from "./lib/upload";

export interface RevisionButtonProps {
  assignmentId: string;
  /** null while the assignment is still loading; a reason disables the button with that sentence */
  disabledReason?: string | null;
  variant?: "primary" | "secondary" | "quiet";
  size?: "md" | "lg";
  label?: string;
}

/** Upload revision: a new attempt, never a replacement. Every earlier attempt stays reachable. */
export function RevisionButton({
  assignmentId,
  disabledReason,
  variant = "secondary",
  size = "lg",
  label = "Upload revision",
}: RevisionButtonProps) {
  const client = useClient();
  const capabilities = useCapabilities();
  const navigate = useNavigate();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function send(file: File | undefined | null) {
    if (!file) return;
    const problem = uploadError(file, capabilities);
    if (problem) {
      toast({ message: problem, tone: "error" });
      return;
    }
    setBusy(true);
    try {
      const submission = (await client.upload(assignmentId, "submission", file)) as StudentSubmission;
      navigate(`/s/${submission.id}/pages`);
    } catch (cause) {
      toast({
        message: uploadFailure(cause instanceof ApiError ? cause.code : "network"),
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        busy={busy}
        disabled={Boolean(disabledReason)}
        title={disabledReason ?? undefined}
        onClick={() => inputRef.current?.click()}
      >
        {label}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="v-visually-hidden"
        aria-label={label}
        onChange={(event) => {
          void send(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
    </>
  );
}
