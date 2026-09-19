import { useContext } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { ClipboardList } from "lucide-react";
import { EmptyState } from "../../components/EmptyState";
import { PageHeader } from "../../app/PageHeader";
import { SessionContext } from "../../app/session-context";
import { Landing } from "./Landing";
import "./landing.css";

/** `/` belongs to the signed-out visitor. A reader who already has a session never needs the
 *  pitch, so they go straight to their course; someone with no course gets one sentence. */
export function LandingRoute() {
  // read the context directly: unlike useSession() this must not throw when there is no session
  const session = useContext(SessionContext);
  const [params] = useSearchParams();
  if (!session) return <Landing />;
  // `/?preview=landing` shows the signed-out page to a signed-in reader, for design review
  if (params.get("preview") === "landing") return <Landing preview />;
  const course = session.courses[0];
  if (course) return <Navigate to={`/c/${course.id}`} replace />;
  return (
    <>
      <PageHeader title="Verity" />
      <div className="v-landing__enrol">
        <EmptyState title="No course yet" icon={ClipboardList}>
          You are not enrolled in a course yet.
        </EmptyState>
      </div>
    </>
  );
}
