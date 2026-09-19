import { BarChart3 } from "lucide-react";
import { Chip, EmptyState } from "../../components";
import { chartTitle, type Finding, type QuestionBar } from "./analytics-view";
import "./course.css";

export interface ScoresByQuestionProps {
  bars: QuestionBar[];
  finding: Finding | null;
  /** false when the backend has scored nobody: a sentence, not an empty chart */
  hasEstimates: boolean;
}

/** Horizontal bars, one per question: the latest attempt's mean is the bar, the first attempt's
 *  mean is the tick behind it. No axes, no legend, no gridlines — the value is printed. */
export function ScoresByQuestion({ bars, finding, hasEstimates }: ScoresByQuestionProps) {
  if (!hasEstimates) {
    // the empty state's own title is the heading here: two headings for one empty block is noise
    return (
      <section className="v-block v-block--chart" aria-label="Scores by question">
        <EmptyState title="No estimates yet" icon={BarChart3}>
          A bar appears for each question once a student checks their work.
        </EmptyState>
      </section>
    );
  }

  return (
    <section className="v-block v-block--chart" aria-labelledby="v-scores-heading">
      <h2 className="v-heading-16" id="v-scores-heading">
        {chartTitle(finding)}
      </h2>
      <ul className="v-bars">
        {bars.map((bar) => (
          <li key={bar.questionId} className="v-bar">
            <div className="v-bar__head">
              <span className="v-label-14 v-bar__label">
                {bar.label}
                {bar.mixedRubrics ? (
                  <Chip tone="hint" title="This question was scored under more than one rubric version">
                    Mixed rubric versions
                  </Chip>
                ) : null}
              </span>
              <span className="v-label-12 v-bar__value">{bar.valueLabel}</span>
            </div>
            <div className="v-bar__track">
              {bar.latestPct !== null ? (
                <div className="v-bar__fill" style={{ inlineSize: `${bar.latestPct}%` }} />
              ) : null}
              {bar.firstPct !== null ? (
                <div
                  className={`v-bar__tick${
                    bar.latestPct !== null && bar.firstPct <= bar.latestPct ? " is-inside" : ""
                  }`}
                  style={{ insetInlineStart: `${bar.firstPct}%` }}
                  title={`First attempt ${bar.firstMean?.toFixed(1)}`}
                />
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      <p className="v-label-12 v-bars__key">The bar is the latest attempt. The line is the first attempt.</p>
    </section>
  );
}
