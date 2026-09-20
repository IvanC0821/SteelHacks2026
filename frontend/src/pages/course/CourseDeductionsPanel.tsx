import { useState } from "react";
import { useClient } from "../../app/session-context";
import { useResource } from "../../app/data";
import { Button, Notice } from "../../components";
import "./new-course.css";

/** Staff-only view: neither the source PDF nor the raw rules are in the student projection. */
export function CourseDeductionsPanel({ courseId }: { courseId: string }) {
  const client = useClient();
  const { data, error } = useResource(courseId, (id) => client.course(id), [client]);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(false);
  if (error) return <Notice tone="error">Course deductions could not be loaded.</Notice>;
  if (!data?.deductions || (!data.deductions.rules.length && !data.deductions.notes && !data.deductions_document)) return null;
  const download = async () => {
    setDownloading(true); setDownloadError(false);
    try {
      const blob = await client.courseDeductionsBlob(courseId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a"); link.href = url;
      link.download = data.deductions_document?.filename ?? "course-deductions.pdf";
      link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setDownloadError(true); }
    finally { setDownloading(false); }
  };
  return <section className="v-course-deductions" aria-labelledby="course-deductions-title">
    <h2 id="course-deductions-title" className="v-heading-16">Course deductions</h2>
    <p className="v-copy-14">Used when drafting homework rubrics. Published homework rubrics determine grading.</p>
    <ul>{data.deductions.rules.map((rule, index) => <li key={index} className="v-copy-14">
      {rule.description}<br /><strong>{rule.penalty || "Penalty unspecified — do not infer an amount"}</strong>
    </li>)}</ul>
    {data.deductions.notes ? <p className="v-copy-14 v-course-deductions__notes">{data.deductions.notes}</p> : null}
    {data.deductions_document ? <div><Button busy={downloading} onClick={() => void download()}>Download grading PDF</Button></div> : null}
    {downloadError ? <Notice tone="error">The private PDF could not be downloaded. Try again.</Notice> : null}
  </section>;
}
