import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PdfViewer } from "../pdf/PdfViewer";
import { PageThumbnails } from "../pdf/PageThumbnails";
import { usePdfBlob } from "../pdf/usePdfBlob";
import type { Mark } from "../pdf/marks";
import { Chip } from "../components/Chip";
import { Notice } from "../components/Notice";
import { Spinner } from "../components/Spinner";
import { flagLabel, flagTone } from "../components/flags";
import { PageHeader } from "./PageHeader";
import { useClient } from "./session-context";
import { usePrimaryCourse } from "./data";
import type { Submission } from "../api/types";
import "./DevPdf.css";

/** A dev harness, not a product page: it loads the newest attempt this identity can see and
 *  proves the viewer against real seeded data. Tasks 2 and 4 use it to check the marks contract. */
export function DevPdf() {
  const client = useClient();
  const course = usePrimaryCourse();
  // ?attempt=N picks that 1-based attempt instead of the latest, so a proof can target the
  // attempt whose real findings span the pages it needs to show. No data is invented.
  const [params] = useSearchParams();
  const wanted = Number(params.get("attempt")) || 0;
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState<"fit-width" | number>("fit-width");
  const [hideMarks, setHideMarks] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!course) return;
    let live = true;
    client
      .assignments(course.id)
      .then(async (assignments) => {
        for (const assignment of assignments) {
          const submissions = await client.submissions(assignment.id);
          if (submissions.length === 0) continue;
          const picked = submissions.find((s) => s.version === wanted);
          return picked ?? submissions[submissions.length - 1];
        }
        return null;
      })
      .then((found) => {
        if (!live) return;
        if (found) setSubmission(found);
        else setError("No seeded attempt is visible to this identity.");
      })
      .catch(() => live && setError("Could not load an attempt."));
    return () => {
      live = false;
    };
  }, [client, course, wanted]);

  const pdf = usePdfBlob(client, submission?.document_id ?? null);

  const marks: Mark[] = useMemo(() => {
    if (!submission?.assessment) return [];
    let n = 0;
    const out: Mark[] = [];
    for (const question of submission.assessment.questions) {
      for (const flag of question.flags) {
        for (const anchor of flag.anchors) {
          n += 1;
          out.push({
            id: `${submission.id}:${question.question_id}:${flag.id}:${anchor.id}`,
            page: anchor.page,
            bbox: anchor.bbox,
            label: n,
            tone: flagTone(flag.category),
            selected: selected === `${submission.id}:${question.question_id}:${flag.id}:${anchor.id}`,
          });
        }
      }
    }
    return out;
  }, [submission, selected]);

  const flagRows = useMemo(() => {
    if (!submission?.assessment) return [];
    let n = 0;
    return submission.assessment.questions.flatMap((question) =>
      question.flags.flatMap((flag) =>
        flag.anchors.map((anchor) => {
          n += 1;
          return {
            id: `${submission.id}:${question.question_id}:${flag.id}:${anchor.id}`,
            n,
            question: question.question_id,
            category: flag.category,
            message: flag.message,
            page: anchor.page,
          };
        }),
      ),
    );
  }, [submission]);

  return (
    <>
      <PageHeader
        title="PDF viewer"
        subtitle={submission ? `${submission.document.filename} · attempt ${submission.version}` : undefined}
      />
      <div className="v-devpdf">
        <div className="v-devpdf__paper">
          {error ? (
            <div className="v-devpdf__state">
              <Notice tone="error">{error}</Notice>
            </div>
          ) : pdf.error ? (
            <div className="v-devpdf__state">
              <Notice tone="error">{`The PDF could not be fetched (${pdf.error}).`}</Notice>
            </div>
          ) : pdf.blob ? (
            <PdfViewer
              blob={pdf.blob}
              page={page}
              onPageChange={setPage}
              zoom={zoom}
              onZoomChange={setZoom}
              marks={marks}
              onMarkSelect={setSelected}
              hideMarks={hideMarks}
              onHideMarksChange={setHideMarks}
            />
          ) : (
            <div className="v-devpdf__state">
              <Spinner size={20} label="Loading the paper" />
            </div>
          )}
        </div>

        <aside className="v-devpdf__panel">
          <h2 className="v-heading-16">Findings</h2>
          <ul className="v-devpdf__flags">
            {flagRows.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className={`v-devpdf__flag${selected === row.id ? " is-selected" : ""}`}
                  onClick={() => {
                    setSelected(row.id);
                    setPage(row.page);
                  }}
                >
                  <Chip tone={flagTone(row.category)} number={row.n}>
                    {flagLabel(row.category)}
                  </Chip>
                  <span className="v-copy-14">{row.message}</span>
                  <span className="v-label-12">{`${row.question} · page ${row.page}`}</span>
                </button>
              </li>
            ))}
          </ul>

          <h2 className="v-heading-16">Thumbnails</h2>
          {pdf.blob ? (
            <PageThumbnails
              blob={pdf.blob}
              selected={[page]}
              onSelect={setPage}
              tileWidth={92}
              overlay={(n) =>
                marks.some((mark) => mark.page === n) ? <Chip tone="deduction">Marked</Chip> : null
              }
            />
          ) : null}
        </aside>
      </div>
    </>
  );
}
