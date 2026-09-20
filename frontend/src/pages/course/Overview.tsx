import { useParams, Link } from "react-router-dom";
import { Chip, Notice, Spinner } from "../../components";
import { AssignmentFrame } from "./AssignmentFrame";
import { hasEstimates, overviewTiles, questionBars, selectFinding, type OverviewTile } from "./analytics-view";
import { errorMessage, useOverview } from "./data";
import { ScoresByQuestion } from "./ScoresByQuestion";
import "./course.css";

/** The staff Overview tab: what has come in, what the estimates look like per question, and what
 *  students are most often flagged for. Every number comes from `GET /analytics`. */
export function Overview() {
  const { assignmentId = "" } = useParams();
  const { data, error, loading } = useOverview(assignmentId);

  const analytics = data?.analytics ?? null;
  const bars = analytics ? questionBars(analytics, data?.assignment.questions ?? []) : [];
  const finding = selectFinding(bars);

  return (
    <AssignmentFrame
      assignmentId={assignmentId}
      title={data?.assignment.title ?? "Assignment"}
      openReports={analytics?.open_reports ?? 0}
    >
      {loading && !data ? <Spinner size={20} label="Loading the overview" /> : null}
      {error ? <Notice tone="error">{errorMessage(error)}</Notice> : null}

      {analytics ? (
        <>
          <Tiles tiles={overviewTiles(analytics, assignmentId)} />
          <ScoresByQuestion bars={bars} finding={finding} hasEstimates={hasEstimates(analytics)} />
          <MostFlagged bars={bars} />
          <p className="v-label-12 v-course-footnote">{analytics.interpretation}</p>
        </>
      ) : null}
    </AssignmentFrame>
  );
}

function Tiles({ tiles }: { tiles: OverviewTile[] }) {
  return (
    <div className="v-course-tiles">
      {tiles.map((tile) => {
        const body = (
          <>
            <span className="v-label-12">{tile.label}</span>
            <span className="v-score v-course-tile__value">{tile.value}</span>
            <span className="v-label-12 v-course-tile__caption">{tile.caption}</span>
          </>
        );
        return tile.to ? (
          <Link key={tile.id} to={tile.to} className="v-course-tile v-course-tile--link">
            {body}
          </Link>
        ) : (
          <div key={tile.id} className="v-course-tile">
            {body}
          </div>
        );
      })}
    </div>
  );
}

function MostFlagged({ bars }: { bars: ReturnType<typeof questionBars> }) {
  const withCategories = bars.filter((bar) => bar.categories.length > 0);
  if (withCategories.length === 0) return null;
  return (
    <section className="v-course-block v-course-block--chart" aria-labelledby="v-course-flagged-heading">
      <h2 className="v-heading-16" id="v-course-flagged-heading">
        Most flagged
      </h2>
      <ul className="v-course-flagged">
        {withCategories.map((bar) => (
          <li key={bar.questionId} className="v-course-flagged__row">
            <span className="v-label-14 v-course-flagged__label">{bar.label}</span>
            <span className="v-course-flagged__chips">
              {bar.categories.map((category) => (
                <Chip key={category.category} tone="neutral">
                  {`${category.label} ${category.count}`}
                </Chip>
              ))}
            </span>
          </li>
        ))}
      </ul>
      <p className="v-label-12 v-course-footnote">Counts are distinct students on the latest attempt.</p>
    </section>
  );
}
