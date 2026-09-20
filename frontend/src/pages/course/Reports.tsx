import { useState } from "react";
import { useParams } from "react-router-dom";
import { MessagesSquare } from "lucide-react";
import { ApiError } from "../../api/client";
import type { Report } from "../../api/types";
import {
  Button,
  Chip,
  Dialog,
  EmptyState,
  Field,
  Notice,
  Spinner,
  Table,
  useToast,
  type Column,
} from "../../components";
import { useClient } from "../../app";
import { AssignmentFrame } from "./AssignmentFrame";
import { errorMessage, useReports } from "./data";
import { openReportCount, reportRows, validateResolution, type ReportRow } from "./reports-view";
import "./course.css";

type Outcome = "resolved" | "dismissed";

/** Student reports on this assignment, open ones first. Resolving records a staff note and a
 *  status; it never touches a score. */
export function Reports() {
  const { assignmentId = "" } = useParams();
  const client = useClient();
  const { toast } = useToast();
  const { data, error, loading, refetch } = useReports(assignmentId);

  const [active, setActive] = useState<Report | null>(null);
  const [outcome, setOutcome] = useState<Outcome>("resolved");
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const rows = data ? reportRows(data.reports, data.assignment.questions, data.members) : [];
  const open = data ? openReportCount(data.reports) : 0;

  const close = () => {
    setActive(null);
    setNote("");
    setNoteError(null);
  };

  const submit = async () => {
    if (!active) return;
    const invalid = validateResolution(note);
    setNoteError(invalid);
    if (invalid) return;
    setBusy(true);
    try {
      await client.resolveReport(active.id, outcome, note.trim());
      toast({ message: outcome === "resolved" ? "Report resolved" : "Report dismissed" });
      close();
      refetch();
    } catch (cause) {
      setNoteError(
        cause instanceof ApiError && cause.conflict
          ? "Someone already answered this report. Reload to see it."
          : "That did not save.",
      );
    } finally {
      setBusy(false);
    }
  };

  const columns: Array<Column<ReportRow>> = [
    { key: "student", header: "Student", cell: (row) => <span className="v-label-14">{row.studentName}</span> },
    { key: "question", header: "Question", cell: (row) => row.questionLabel },
    { key: "kind", header: "Kind", cell: (row) => row.kindLabel },
    { key: "message", header: "Message", cell: (row) => <span className="v-course-reports__message">{row.report.message}</span> },
    { key: "time", header: "Sent", cell: (row) => <span className="v-label-12">{row.when}</span> },
    {
      key: "status",
      header: "Status",
      cell: (row) => (
        <Chip tone={row.report.status === "open" ? "hint" : "neutral"}>{row.statusLabel}</Chip>
      ),
    },
    {
      key: "action",
      header: "",
      align: "end",
      width: "1%",
      cell: (row) =>
        row.report.status === "open" ? (
          <Button
            onClick={() => {
              setActive(row.report);
              setOutcome("resolved");
              setNote("");
              setNoteError(null);
            }}
          >
            Resolve
          </Button>
        ) : null,
    },
  ];

  return (
    <AssignmentFrame
      assignmentId={assignmentId}
      title={data?.assignment.title ?? "Assignment"}
      openReports={open}
    >
      {loading && !data ? <Spinner size={20} label="Loading reports" /> : null}
      {error ? <Notice tone="error">{errorMessage(error)}</Notice> : null}

      {data ? (
        <>
          <Table<ReportRow>
            className="v-course-rows v-course-reports"
            caption="Student reports on this assignment"
            columns={columns}
            rows={rows}
            rowKey={(row) => row.report.id}
            empty={
              <EmptyState title="No reports" icon={MessagesSquare}>
                Students have not asked for help or disputed feedback on this assignment.
              </EmptyState>
            }
          />
          <p className="v-label-12 v-course-footnote">Resolving never changes a score.</p>
        </>
      ) : null}

      <Dialog
        open={active !== null}
        title="Resolve report"
        description={active ? `${active.kind === "help" ? "Help" : "Feedback disputed"} on this paper.` : undefined}
        onClose={close}
        primary={{ label: outcome === "resolved" ? "Resolve" : "Dismiss", onClick: () => void submit(), busy }}
      >
        <p className="v-copy-14 v-course-reports__quote">{active?.message}</p>
        <Field label="Status" as="select" value={outcome} onChange={(value) => setOutcome(value as Outcome)}>
          <option value="resolved">Resolved</option>
          <option value="dismissed">Dismissed</option>
        </Field>
        <Field
          label="Staff note"
          as="textarea"
          rows={3}
          value={note}
          onChange={(value) => {
            setNote(value);
            if (noteError) setNoteError(null);
          }}
          hint="The student sees the status, not this note."
          error={noteError ?? undefined}
          required
        />
      </Dialog>
    </AssignmentFrame>
  );
}
