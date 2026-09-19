import type { ReviewStatus } from "../api/types";
import { Chip, type ChipTone } from "./Chip";
import type { AssessmentState } from "./status";
import "./StatusChip.css";

export interface ReviewStatusChipProps {
  kind: "review";
  status: ReviewStatus;
}

export interface AssessmentStatusChipProps {
  kind: "assessment";
  status: AssessmentState;
}

export type StatusChipProps = ReviewStatusChipProps | AssessmentStatusChipProps;

const REVIEW: Record<ReviewStatus, { label: string; tone: ChipTone }> = {
  not_started: { label: "Not started", tone: "neutral" },
  in_progress: { label: "In review", tone: "hint" },
  completed: { label: "Completed", tone: "teal" },
  released: { label: "Released", tone: "credit" },
};

const ASSESSMENT: Record<AssessmentState, { label: string; tone: ChipTone }> = {
  not_checked: { label: "Not checked", tone: "neutral" },
  estimated: { label: "Estimated", tone: "teal" },
  needs_review: { label: "Needs review", tone: "hint" },
};

/** Maps a backend status to the exact vocabulary in the brief. The two maps are total, so a new
 *  backend status shows up as a TypeScript error rather than a blank chip. */
export function StatusChip(props: StatusChipProps) {
  const entry = props.kind === "review" ? REVIEW[props.status] : ASSESSMENT[props.status];
  return (
    <Chip tone={entry.tone} className="v-status-chip">
      {entry.label}
    </Chip>
  );
}
