import { useState } from "react";
import { Check, Download, FileText, Upload } from "lucide-react";
import { Button } from "../components/Button";
import { Chip } from "../components/Chip";
import { StatusChip } from "../components/StatusChip";
import { Score } from "../components/Score";
import { Dialog } from "../components/Dialog";
import { Drawer } from "../components/Drawer";
import { Notice } from "../components/Notice";
import { Field } from "../components/Field";
import { Table } from "../components/Table";
import { Tabs } from "../components/Tabs";
import { EmptyState } from "../components/EmptyState";
import { Spinner } from "../components/Spinner";
import { Kbd } from "../components/Kbd";
import { useToast } from "../components/toast-context";
import { PageHeader } from "./PageHeader";
import "./DevComponents.css";

const TOKENS: Array<[string, string, string]> = [
  ["--v-teal-500", "#0c7686", "Links, 5.31:1 on white"],
  ["--v-teal-600", "#09606e", "Primary fill, white on it 7.22:1"],
  ["--v-teal-800", "#033d46", "Pressed, white on it 11.93:1"],
  ["--v-teal-100", "#ddf1f6", "Selection tint"],
  ["--v-teal-50", "#eff9fb", "Info ground"],
  ["--v-ink", "#182123", "Body text, 16.40:1 on white"],
  ["--v-muted", "#5c6769", "Secondary text, 5.83:1 on white"],
  ["--v-line-strong", "#7d898b", "Control border, 3.61:1 on white"],
  ["--v-line", "#d9e2e4", "Hairline divider"],
  ["--v-canvas", "#e0e8ea", "Paper ground"],
  ["--v-deduction", "#a5292b", "Deduction ink, 7.11:1"],
  ["--v-credit", "#176933", "Credit ink, 6.76:1"],
  ["--v-hint", "#6e5c09", "Hint ink, 6.57:1"],
  ["--v-ai", "#614999", "AI suggested, 7.19:1"],
  ["--v-error", "#a91518", "Error ink, 7.48:1"],
  ["--v-warn", "#8a4603", "Warning ink, 7.10:1"],
  ["--v-focus", "#086a9c", "Focus ring, 5.91:1"],
];

interface Row {
  id: string;
  student: string;
  score: number | null;
}

const ROWS: Row[] = [
  { id: "1", student: "Amara Okafor", score: 27 },
  { id: "2", student: "Chloe Nguyen", score: 19 },
  { id: "3", student: "Elena Petrova", score: null },
];

/** The visual regression page. Every primitive at every state, in one scroll.
 *  Keep it: Tasks 2-5 check their own states against it. */
export function DevComponents() {
  const { toast } = useToast();
  const [dialog, setDialog] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [text, setText] = useState("Row reduce, then back-substitute");
  const [bad, setBad] = useState("");

  return (
    <>
      <PageHeader title="Components" subtitle="Visual regression sheet" />
      <div className="v-sheet">
        <Section title="Type">
          <p className="v-heading-28">Homework 1 heading, 28/36 serif</p>
          <p className="v-heading-20">Page title, 20/28 serif</p>
          <p className="v-heading-16">Panel heading, 16/24</p>
          <p className="v-heading-14">Component heading, 14/18</p>
          <p className="v-copy-16">
            Panel prose at 16/26. The interface never computes a grade and never invents a page
            region the backend did not give it.
          </p>
          <p className="v-copy-14">
            Body copy at 14/20. Every attempt stays; the latest one is the one you hand in.
          </p>
          <p className="v-label-14">Label 14/18</p>
          <p className="v-label-12">Label 12/16</p>
        </Section>

        <Section title="Color">
          <ul className="v-sheet__swatches">
            {TOKENS.map(([name, hex, note]) => (
              <li key={name} className="v-sheet__swatch">
                <span className="v-sheet__chip" style={{ background: `var(${name})` }} />
                <span className="v-label-14">{name}</span>
                <span className="v-label-12">{hex}</span>
                <span className="v-label-12">{note}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Button">
          <Row2>
            <Button variant="primary">Check my work</Button>
            <Button variant="secondary">Upload revision</Button>
            <Button variant="quiet">Reopen</Button>
            <Button variant="danger">Reopen and clear</Button>
          </Row2>
          <Row2>
            <Button variant="primary" size="lg" icon={Check}>
              Hand in
            </Button>
            <Button variant="secondary" icon={Upload}>
              Upload
            </Button>
            <Button variant="quiet" icon={Download} iconOnly aria-label="Download the paper">
              Download the paper
            </Button>
            <Button variant="primary" busy>
              Save and next
            </Button>
            <Button variant="primary" disabled title="Map every question first">
              Check my work
            </Button>
          </Row2>
        </Section>

        <Section title="Chip and StatusChip">
          <Row2>
            <Chip>Neutral</Chip>
            <Chip tone="teal">Rubric v1</Chip>
            <Chip tone="deduction" number={1}>
              Arithmetic
            </Chip>
            <Chip tone="hint" number={2}>
              Justification
            </Chip>
            <Chip tone="credit" number={3}>
              Full credit
            </Chip>
            <Chip tone="ai" />
            <Chip tone="fixture" />
            <Chip selected>Selected</Chip>
          </Row2>
          <Row2>
            <StatusChip kind="review" status="not_started" />
            <StatusChip kind="review" status="in_progress" />
            <StatusChip kind="review" status="completed" />
            <StatusChip kind="review" status="released" />
            <StatusChip kind="assessment" status="not_checked" />
            <StatusChip kind="assessment" status="estimated" />
            <StatusChip kind="assessment" status="needs_review" />
          </Row2>
        </Section>

        <Section title="Score">
          <Row2>
            <Score value={19} max={30} size="lg" estimated />
            <Score value={27} max={30} size="md" />
            <Score value={null} />
            <Score value={-2} delta size="sm" />
            <Score value={1.5} delta size="sm" />
            <Score value={0} delta size="sm" />
          </Row2>
        </Section>

        <Section title="Notice">
          <Notice tone="info">
            Automated assessment is not connected yet. You can still hand in for staff review.
          </Notice>
          <Notice tone="warn" title="Test fixture">
            These results come from a test fixture, not from a model.
          </Notice>
          <Notice
            tone="error"
            action={<Button variant="secondary">Retry</Button>}
          >
            The check failed before it finished. Nothing was saved.
          </Notice>
        </Section>

        <Section title="Field">
          <Field label="Reason" as="textarea" value={text} onChange={setText} rows={3} />
          <Field
            label="Points"
            value={bad}
            onChange={setBad}
            hint="Whole or half points, up to the question maximum."
            error="Enter a number between 0 and 8."
          />
          <Field label="Rubric version" as="select" value="1" onChange={() => {}}>
            <option value="1">Rubric v1</option>
            <option value="2">Rubric v2</option>
          </Field>
        </Section>

        <Section title="Table">
          <Table
            columns={[
              { key: "student", header: "Student", cell: (row: Row) => row.student },
              {
                key: "score",
                header: "Score",
                align: "end",
                cell: (row: Row) => <Score value={row.score} max={30} size="sm" />,
              },
            ]}
            rows={ROWS}
            rowKey={(row) => row.id}
            isSelected={(row) => row.id === "2"}
            caption="Example scores"
          />
        </Section>

        <Section title="Tabs">
          <Tabs
            label="Sheet sections"
            tabs={[
              { id: "queue", label: "Queue", badge: 6 },
              { id: "released", label: "Released", badge: 2 },
              { id: "reports", label: "Reports" },
            ]}
          />
        </Section>

        <Section title="Overlays">
          <Row2>
            <Button variant="secondary" onClick={() => setDialog(true)}>
              Open dialog
            </Button>
            <Button variant="secondary" onClick={() => setDrawer(true)}>
              Open drawer
            </Button>
            <Button
              variant="secondary"
              onClick={() => toast({ message: "Review saved as revision 4" })}
            >
              Show toast
            </Button>
          </Row2>
          <Dialog
            open={dialog}
            title="Release scores"
            description="Students see the final score for every completed paper. You can reopen a paper afterwards."
            primary={{ label: "Release scores", onClick: () => setDialog(false) }}
            onClose={() => setDialog(false)}
          />
          <Drawer open={drawer} title="Rubric v1" onClose={() => setDrawer(false)}>
            <p className="v-copy-14">A drawer travels 40px with opacity over 200ms.</p>
          </Drawer>
        </Section>

        <Section title="EmptyState, Spinner, Kbd">
          <EmptyState
            title="No papers handed in yet"
            icon={FileText}
            action={<Button variant="secondary">Open the overview</Button>}
          >
            Papers appear here once a student hands one in.
          </EmptyState>
          <Row2>
            <Spinner size={16} />
            <Spinner size={20} />
            <span className="v-copy-14">
              Press <Kbd>h</Kbd> to hide the marks, <Kbd>1</Kbd> to <Kbd>4</Kbd> for an outcome.
            </span>
          </Row2>
        </Section>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="v-sheet__section">
      <h2 className="v-heading-16 v-sheet__title">{title}</h2>
      <div className="v-sheet__body">{children}</div>
    </section>
  );
}

function Row2({ children }: { children: React.ReactNode }) {
  return <div className="v-sheet__row">{children}</div>;
}
