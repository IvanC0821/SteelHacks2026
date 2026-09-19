import { useParams } from "react-router-dom";
import { Construction } from "lucide-react";
import { EmptyState } from "../components/EmptyState";
import { PageHeader } from "./PageHeader";
import "./Placeholder.css";

export interface PlaceholderProps {
  /** the page title this route will carry */
  title: string;
  /** which task file owns this route, e.g. "Task 2 · src/pages/grading/routes.tsx" */
  owner: string;
}

/** Stands in until a page task replaces its route fragment. It reads the route params so a wrong
 *  path shows up immediately rather than quietly rendering an empty page. */
export function Placeholder({ title, owner }: PlaceholderProps) {
  const params = useParams();
  const entries = Object.entries(params).filter(([, value]) => value);

  return (
    <>
      <PageHeader title={title} />
      <div className="v-placeholder">
        <EmptyState title="Not built yet" icon={Construction}>
          {`${owner} owns this route and replaces this placeholder.`}
        </EmptyState>
        {entries.length > 0 ? (
          <dl className="v-placeholder__params">
            {entries.map(([key, value]) => (
              <div key={key}>
                <dt className="v-label-12">{key}</dt>
                <dd className="v-copy-14">{value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </>
  );
}
