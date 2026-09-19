// The course roster, grouped by role for the compact list under the assignment table.

import type { Member, Role } from "../../api/types";

export interface RosterGroup {
  role: Role;
  /** "Instructor", "TAs", "Students" — count aware */
  label: string;
  members: Member[];
}

const ORDER: Role[] = ["instructor", "ta", "student"];
const NAMES: Record<Role, { one: string; many: string }> = {
  instructor: { one: "Instructor", many: "Instructors" },
  ta: { one: "TA", many: "TAs" },
  student: { one: "Student", many: "Students" },
};

/** Groups in a fixed role order, members sorted by name. Empty roles are dropped. */
export function groupRoster(members: Member[]): RosterGroup[] {
  return ORDER.map((role) => {
    const inRole = members
      .filter((member) => member.role === role)
      .sort((a, b) => a.name.localeCompare(b.name));
    return {
      role,
      label: inRole.length === 1 ? NAMES[role].one : NAMES[role].many,
      members: inRole,
    };
  }).filter((group) => group.members.length > 0);
}

export function roleLabel(role: Role): string {
  return NAMES[role].one;
}
