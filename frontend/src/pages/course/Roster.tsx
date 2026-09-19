import { useState } from "react";
import { UserPlus } from "lucide-react";
import { ApiError } from "../../api/client";
import type { Member, Role } from "../../api/types";
import { useClient } from "../../app";
import { Button, Field, useToast } from "../../components";
import { ENROLL_HINT, ENROLL_ROLES, enrollErrorMessage, validateUserId } from "./enroll";
import { groupRoster, roleLabel } from "./roster-groups";
import "./course.css";

export interface RosterProps {
  courseId: string;
  members: Member[];
  /** only the instructor can enroll */
  canEnroll: boolean;
  onEnrolled: () => void;
}

/** The compact roster under the assignment table, grouped by role, plus the instructor's
 *  Enroll control. IDs are opaque, so the field says where they come from. */
export function Roster({ courseId, members, canEnroll, onEnrolled }: RosterProps) {
  const groups = groupRoster(members);

  return (
    <section className="v-roster" aria-labelledby="v-roster-heading">
      <h2 className="v-heading-16" id="v-roster-heading">
        Roster
      </h2>
      <div className="v-roster__groups">
        {groups.map((group) => (
          <div key={group.role} className="v-roster__group">
            <p className="v-label-12">{group.label}</p>
            <ul>
              {group.members.map((member) => (
                <li key={member.id} className="v-copy-14">
                  {member.name}
                </li>
              ))}
            </ul>
          </div>
        ))}
        {groups.length === 0 ? <p className="v-copy-14 v-muted">Nobody is enrolled yet.</p> : null}
      </div>
      {canEnroll ? <EnrollForm courseId={courseId} onEnrolled={onEnrolled} /> : null}
    </section>
  );
}

function EnrollForm({ courseId, onEnrolled }: { courseId: string; onEnrolled: () => void }) {
  const client = useClient();
  const { toast } = useToast();
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<Role>("student");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const invalid = validateUserId(userId);
    setError(invalid);
    if (invalid) return;
    setBusy(true);
    try {
      const member = await client.enroll(courseId, userId.trim(), role);
      setUserId("");
      toast({ message: `${member.name} enrolled as ${roleLabel(member.role).toLowerCase()}` });
      onEnrolled();
    } catch (cause) {
      setError(enrollErrorMessage(cause instanceof ApiError ? cause.code : "unknown"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="v-enroll"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <Field
        label="User ID"
        value={userId}
        onChange={(value) => {
          setUserId(value);
          if (error) setError(null);
        }}
        placeholder="usr_…"
        hint={ENROLL_HINT}
        error={error ?? undefined}
        className="v-enroll__id"
      />
      <Field label="Role" as="select" value={role} onChange={(value) => setRole(value as Role)}>
        {ENROLL_ROLES.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Field>
      <Button type="submit" icon={UserPlus} busy={busy} className="v-enroll__submit">
        Enroll
      </Button>
    </form>
  );
}
