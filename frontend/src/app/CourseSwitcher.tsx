import { useId, useRef, useState } from "react";
import { ChevronDown, GraduationCap } from "lucide-react";
import { Link } from "react-router-dom";
import { Icon } from "../components/Icon";
import { useSession } from "./session-context";

/** The visible course name is the switcher; the icon keeps it available in paper workspaces. */
export function CourseSwitcher({ collapsed }: { collapsed: boolean }) {
  const { courses, activeCourse, selectCourse, user } = useSession();
  const [open, setOpen] = useState(false);
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const canCreate = user.role === "instructor";
  const others = courses.filter((course) => course.id !== activeCourse?.id);
  const createLink = canCreate ? <Link to="/courses/new" className="v-course-switch__option v-label-14" aria-label="Create course"
    onClick={() => setOpen(false)} title={collapsed ? "Create course" : undefined}>
    {collapsed && !open ? "+" : "+ Create course"}</Link> : null;
  if (!courses.length) return <div className="v-course-switch">{createLink}</div>;
  return <div className={`v-course-switch${collapsed ? " is-compact" : ""}`}
    onKeyDown={(event) => { if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); } }}>
    <button ref={trigger} type="button" className="v-course-switch__trigger v-label-14"
      aria-expanded={others.length ? open : undefined} aria-controls={others.length ? id : undefined}
      aria-label={collapsed ? `${others.length ? "Switch course" : "Open course"}: ${activeCourse?.name ?? "Courses"}` : undefined}
      title={collapsed ? activeCourse?.name ?? "Courses" : undefined}
      onClick={() => others.length ? setOpen(!open) : activeCourse && selectCourse(activeCourse.id)}>
      {collapsed ? <Icon glyph={GraduationCap} size={20} />
        : <><span>{activeCourse?.name ?? "Choose a course"}</span>{others.length ? <Icon glyph={ChevronDown} size={16} /> : null}</>}
    </button>
    {open && others.length ? <div id={id} className="v-course-switch__options" aria-label="Courses">
      <p className="v-label-12 v-muted" style={{ padding: "6px 8px" }}>Switch course</p>
      {others.map((course) => <button type="button" key={course.id}
        className={`v-course-switch__option v-label-14${course.id === activeCourse?.id ? " is-current" : ""}`}
        aria-current={course.id === activeCourse?.id ? "true" : undefined}
        onClick={() => { setOpen(false); selectCourse(course.id); }}>{course.name}</button>)}
      {createLink}
    </div> : !others.length ? createLink : null}
  </div>;
}
