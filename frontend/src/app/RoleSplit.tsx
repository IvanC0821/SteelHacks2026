import type { ReactNode } from "react";
import { ClipboardList } from "lucide-react";
import { EmptyState } from "../components/EmptyState";
import { useUser } from "./session-context";
import { wrongRoleSentence } from "./route-meta";
import type { Role } from "../api/types";
import "./Placeholder.css";

export interface RoleSplitOption {
  /** omit for "anyone signed in"; the first matching option wins */
  roles?: Role[];
  element: ReactNode;
}

/** One path, two pages: the student sees theirs and staff see theirs.
 *  A reader who matches nothing gets one sentence, not a crash. */
export function RoleSplit({ options }: { options: RoleSplitOption[] }) {
  const user = useUser();
  const match = options.find((option) => !option.roles || option.roles.includes(user.role));
  if (match) return match.element;
  return (
    <div className="v-placeholder">
      <EmptyState title="Not your page" icon={ClipboardList}>
        {wrongRoleSentence(user.role)}
      </EmptyState>
    </div>
  );
}
