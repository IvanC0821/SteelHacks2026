import { BarChart3 } from "lucide-react";
import { Chip, EmptyState } from "../../components";
import type { Analytics, Question } from "../../api/types";
import "./course.css";

/** One count per student/question, computed by the API before categories are aggregated. */
export function FeedbackByQuestion({ analytics, questions }: { analytics: Analytics; questions: Question[] }) {
  const rows = questions.map((question, index) => ({
    id: question.id,
    label: `Q${index + 1} · ${question.title}`,
    stats: analytics.questions.find((row) => row.question_id === question.id)?.latest,
  }));
  const maximum = Math.max(1, ...rows.map((row) => row.stats?.assessed_students ?? 0));
  const ticks = [...new Set([0, Math.ceil(maximum / 2), maximum])];
  const hasChecks = rows.some((row) => (row.stats?.assessed_students ?? 0) > 0);
  const fixture = rows.some((row) => row.stats?.assessment_modes?.includes("fixture"));
  const mixedRubrics = new Set(rows.flatMap((row) => row.stats?.rubric_ids ?? [])).size > 1;

  return (
    <section className="v-course-block v-course-block--chart v-course-feedback-chart" aria-labelledby="v-course-feedback-heading">
      <div className="v-course-feedback-chart__heading">
        <h2 className="v-heading-20" id="v-course-feedback-heading">Students with feedback flags</h2>
        {fixture ? <Chip tone="fixture" /> : null}
      </div>
      {hasChecks ? (
        <>
          <p className="v-copy-14 v-muted">Latest attempts only. Each student counts once per question.</p>
          <ul className="v-course-feedback-chart__rows">
            {rows.map(({ id, label, stats }) => (
              <li key={id} className="v-course-feedback-chart__row">
                <div className="v-course-feedback-chart__label">
                  <span className="v-label-14">{label}</span>
                  <span className="v-label-14 v-course-feedback-chart__count">
                    {stats?.assessed_students ? `${stats.flagged_students} of ${stats.assessed_students}` : "No checks yet"}
                  </span>
                </div>
                <div className="v-course-feedback-chart__track" aria-hidden="true">
                  <div className="v-course-feedback-chart__bar" style={{ width: `${100 * (stats?.flagged_students ?? 0) / maximum}%` }} />
                </div>
              </li>
            ))}
          </ul>
          <div className="v-course-feedback-chart__axis" aria-hidden="true">
            {ticks.map((tick) => <span key={tick} style={{ left: `${100 * tick / maximum}%` }}>{tick}</span>)}
          </div>
          <p className="v-label-12 v-course-feedback-chart__axis-label">Number of students</p>
          <p className="v-copy-14 v-muted">Counts are out of students whose latest attempt was checked. Flags can reflect mistakes or unclear work; review the papers before planning recitation.</p>
          {mixedRubrics ? <p className="v-label-12 v-muted">These checks used different rubric versions.</p> : null}
        </>
      ) : (
        <EmptyState title="No checked attempts yet" icon={BarChart3}>
          The graph appears once a student's latest attempt has feedback.
        </EmptyState>
      )}
    </section>
  );
}
