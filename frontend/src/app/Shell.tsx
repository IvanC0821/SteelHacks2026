import { useState } from "react";
import { NavLink, Outlet, useLocation, useMatches } from "react-router-dom";
import { ClipboardList, LogOut, Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "../components/Button";
import { Chip } from "../components/Chip";
import { Drawer } from "../components/Drawer";
import { EmptyState } from "../components/EmptyState";
import { Icon } from "../components/Icon";
import { Wordmark } from "./Wordmark";
import { useSession } from "./session-context";
import { useAssignments, usePrimaryCourse } from "./data";
import { allowsRole, resolveHandle, wrongRoleSentence } from "./route-meta";
import type { Assignment, Role } from "../api/types";
import "./Shell.css";

/** Only workspace routes carry a collapse choice; content routes always show the full rail. */
const COLLAPSE_KEY = "verity.rail.workspace-expanded";
const ROLE_WORD: Record<Role, string> = { student: "Student", ta: "TA", instructor: "Instructor" };

function readExpanded(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

/** The 240px rail plus a full-height <main>. Workspace routes collapse the rail to a 56px icon
 *  strip so the paper gets the width; the toggle's choice persists. Below 760px the rail becomes a
 *  drawer behind a 52px header's menu button. */
export function Shell() {
  const { user, signOut } = useSession();
  const course = usePrimaryCourse();
  const assignments = useAssignments(course?.id);
  const handle = resolveHandle(useMatches());
  const location = useLocation();

  const [expanded, setExpanded] = useState(readExpanded);
  // The drawer is keyed to the path it was opened on, so navigating closes it during render
  // instead of through an effect that would paint the open drawer on the new page first.
  const [drawer, setDrawer] = useState<{ path: string; open: boolean } | null>(null);
  const drawerOpen = drawer !== null && drawer.open && drawer.path === location.pathname;
  const setDrawerOpen = (open: boolean) => setDrawer({ path: location.pathname, open });

  const workspace = handle.workspace === true;
  const collapsed = workspace && !expanded;

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    try {
      localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
    } catch {
      /* private mode: the choice lasts for this page only */
    }
  };

  const railProps = {
    courseName: course?.name ?? null,
    courseId: course?.id ?? null,
    assignments: assignments.data ?? [],
    userName: user.name,
    roleWord: ROLE_WORD[user.role],
    showStatus: user.role !== "student",
    onSignOut: signOut,
  };

  const denied = !allowsRole(handle, user.role);

  return (
    <div className={`v-shell${collapsed ? " is-collapsed" : ""}${workspace ? " is-workspace" : ""}`}>
      <nav className="v-rail" aria-label="Verity">
        <RailContent {...railProps} collapsed={collapsed} onToggle={workspace ? toggle : undefined} />
      </nav>

      <header className="v-shell__phone-header">
        <Button
          variant="quiet"
          icon={Menu}
          iconOnly
          aria-label="Open navigation"
          onClick={() => setDrawerOpen(true)}
        />
        <Wordmark size="sm" />
      </header>

      <Drawer open={drawerOpen} title="Verity" side="left" onClose={() => setDrawerOpen(false)}>
        <div className="v-rail v-rail--drawer">
          <RailContent {...railProps} collapsed={false} hideBrand />
        </div>
      </Drawer>

      <main className="v-shell__main" id="main">
        {denied ? (
          <div className="v-shell__denied">
            <EmptyState title="Not your page" icon={ClipboardList}>
              {wrongRoleSentence(user.role)}
            </EmptyState>
          </div>
        ) : (
          <Outlet />
        )}
      </main>
    </div>
  );
}

interface RailContentProps {
  collapsed: boolean;
  /** the drawer's own header already carries the wordmark */
  hideBrand?: boolean;
  courseName: string | null;
  courseId: string | null;
  assignments: Assignment[];
  userName: string;
  roleWord: string;
  showStatus: boolean;
  onSignOut: () => void;
  onToggle?: () => void;
}

function RailContent({
  collapsed,
  hideBrand = false,
  courseName,
  courseId,
  assignments,
  userName,
  roleWord,
  showStatus,
  onSignOut,
  onToggle,
}: RailContentProps) {
  return (
    <>
      {hideBrand ? null : (
        <div className="v-rail__brand">
          <NavLink to="/" className="v-rail__brand-link" aria-label="Verity home">
            <Wordmark size="sm" markOnly={collapsed} />
          </NavLink>
          {onToggle ? (
            <Button
              variant="quiet"
              icon={collapsed ? PanelLeftOpen : PanelLeftClose}
              iconOnly
              aria-label={collapsed ? "Expand the navigation" : "Collapse the navigation"}
              onClick={onToggle}
              className="v-rail__toggle"
            />
          ) : null}
        </div>
      )}

      {courseName && !collapsed ? (
        <NavLink to={courseId ? `/c/${courseId}` : "/"} className="v-rail__course v-label-14">
          {courseName}
        </NavLink>
      ) : null}

      <div className="v-rail__list">
        {!collapsed ? <p className="v-label-12 v-rail__list-label">Assignments</p> : null}
        <ul>
          {assignments.map((assignment) => (
            <li key={assignment.id}>
              <NavLink
                to={`/a/${assignment.id}`}
                className={({ isActive }) => `v-rail__item${isActive ? " is-active" : ""}`}
                title={collapsed ? assignment.title : undefined}
              >
                <Icon glyph={ClipboardList} size={16} />
                {collapsed ? (
                  <span className="v-visually-hidden">{assignment.title}</span>
                ) : (
                  <>
                    <span className="v-rail__item-title">{assignment.title}</span>
                    {showStatus ? (
                      <Chip tone={assignment.published_rubric_id ? "teal" : "neutral"}>
                        {assignment.published_rubric_id ? "Published" : "Draft"}
                      </Chip>
                    ) : null}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </div>

      <div className="v-rail__footer">
        {collapsed ? (
          <Button
            variant="quiet"
            icon={LogOut}
            iconOnly
            aria-label={`Sign out ${userName}`}
            onClick={onSignOut}
          />
        ) : (
          <>
            <p className="v-label-14 v-rail__identity">
              {userName}
              <span className="v-rail__role"> · {roleWord}</span>
            </p>
            <button type="button" className="v-rail__signout v-label-12" onClick={onSignOut}>
              Sign out
            </button>
          </>
        )}
      </div>
    </>
  );
}
