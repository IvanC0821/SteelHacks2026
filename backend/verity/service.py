from datetime import UTC, datetime
from math import isclose

from fastapi import HTTPException
from pydantic import ValidationError

from .documents import inspect_pdf
from .feedback import generate_student_feedback, safe_feedback_view, student_hint
from .provider import ProviderUnavailable
from .schemas import ProviderAssessment, RubricInput
from .store import new_id, now


def fail(status, code):
    raise HTTPException(status, detail={"code": code})


def required(store, db, kind, object_id):
    obj = store.get(db, kind, object_id)
    if not obj:
        fail(404, "not_found")
    return obj


class Service:
    def __init__(self, store, provider):
        self.store = store
        self.provider = provider

    def membership(self, db, user, course_id, roles=None):
        row = db.execute(
            "SELECT role FROM memberships WHERE course_id=? AND user_id=?", (course_id, user["id"])
        ).fetchone()
        if not row or (roles and row[0] not in roles):
            fail(403, "course_access_denied")
        return row[0]

    def assignment(self, db, user, assignment_id, roles=None):
        a = required(self.store, db, "assignment", assignment_id)
        role = self.membership(db, user, a["course_id"], roles)
        if role == "student" and not a["published_rubric_id"]:
            fail(404, "not_found")
        return a, role

    def submission(self, db, user, submission_id, staff=False):
        s = required(self.store, db, "submission", submission_id)
        a, role = self.assignment(db, user, s["assignment_id"])
        if role == "student" and (s["student_id"] != user["id"] or staff):
            fail(403, "submission_access_denied")
        return s, a, role

    def writable_attempt(self, s, a):
        if s["sealed"] or s["final"]:
            fail(409, "attempt_frozen_upload_revision")
        self.before_deadline(a)

    @staticmethod
    def before_deadline(a):
        if a["due_at"] and datetime.now(UTC) >= datetime.fromisoformat(a["due_at"]):
            fail(409, "deadline_passed")

    def create_course(self, user, body):
        if user["role"] != "instructor":
            fail(403, "instructor_required")
        obj = {"id": new_id("crs"), "name": body.name, "created_at": now()}
        with self.store.transaction() as db:
            self.store.put(db, "course", obj)
            db.execute(
                "INSERT INTO memberships VALUES(?,?,?)", (obj["id"], user["id"], "instructor")
            )
            self.store.audit(db, user["id"], "course.created", obj["id"])
        return obj

    def list_courses(self, user):
        with self.store.connection() as db:
            memberships = db.execute(
                "SELECT course_id,role FROM memberships WHERE user_id=?", (user["id"],)
            ).fetchall()
            return [{**required(self.store, db, "course", r[0]), "role": r[1]} for r in memberships]

    def enroll(self, user, course_id, body):
        with self.store.transaction() as db:
            self.membership(db, user, course_id, {"instructor"})
            target = required(self.store, db, "user", body.user_id)
            if target["id"] == user["id"]:
                fail(409, "cannot_change_own_membership")
            db.execute(
                "INSERT INTO memberships VALUES(?,?,?) ON CONFLICT(course_id,user_id) "
                "DO UPDATE SET role=excluded.role",
                (course_id, body.user_id, body.role),
            )
            self.store.audit(
                db,
                user["id"],
                "course.enrolled",
                course_id,
                {"user_id": body.user_id, "role": body.role},
            )
        return {"user_id": body.user_id, "name": target["name"], "role": body.role}

    def roster(self, user, course_id):
        with self.store.connection() as db:
            self.membership(db, user, course_id, {"instructor", "ta"})
            rows = db.execute(
                "SELECT user_id,role FROM memberships WHERE course_id=?", (course_id,)
            ).fetchall()
            return [
                {"id": r[0], "role": r[1], "name": required(self.store, db, "user", r[0])["name"]}
                for r in rows
            ]

    def create_assignment(self, user, course_id, body):
        a = {
            "id": new_id("asg"),
            "course_id": course_id,
            **body.model_dump(mode="json"),
            "created_at": now(),
            "published_rubric_id": None,
            "rubric_draft": None,
            "draft_revision": 0,
        }
        with self.store.transaction() as db:
            self.membership(db, user, course_id, {"instructor"})
            self.store.put(db, "assignment", a, course_id)
            self.store.audit(db, user["id"], "assignment.created", a["id"])
        return a

    @staticmethod
    def public_assignment(a):
        return {
            k: a[k]
            for k in (
                "id",
                "course_id",
                "title",
                "questions",
                "due_at",
                "created_at",
                "published_rubric_id",
            )
        }

    def list_assignments(self, user, course_id):
        with self.store.connection() as db:
            role = self.membership(db, user, course_id)
            return [
                self.public_assignment(a)
                for a in self.store.all(db, "assignment", course_id)
                if role != "student" or a["published_rubric_id"]
            ]

    def get_assignment(self, user, assignment_id):
        with self.store.connection() as db:
            a, role = self.assignment(db, user, assignment_id)
            result = self.public_assignment(a) if role == "student" else dict(a)
            result["documents"] = [
                self.document_view(d)
                for d in self.store.all(db, "document", assignment_id)
                if d["kind"] != "submission" and (role != "student" or d["kind"] == "questions")
            ]
            if role != "student":
                result["rubrics"] = self.store.all(db, "rubric", assignment_id)
            return result

    def validate_rubric(self, a, body):
        data = RubricInput.model_validate(body).model_dump(mode="json")
        criteria = data["criteria"]
        expected = {q["id"]: q["max_points"] for q in a["questions"]}
        if len({c["id"] for c in criteria}) != len(criteria):
            fail(422, "duplicate_criterion")
        if {c["question_id"] for c in criteria} != set(expected):
            fail(422, "rubric_question_coverage")
        for qid, maximum in expected.items():
            if not isclose(
                sum(c["points"] for c in criteria if c["question_id"] == qid), maximum, abs_tol=1e-8
            ):
                fail(422, "rubric_points_mismatch")
        return data

    def save_rubric(self, user, assignment_id, body):
        with self.store.transaction() as db:
            a, _ = self.assignment(db, user, assignment_id, {"instructor", "ta"})
            a["rubric_draft"] = self.validate_rubric(a, body)
            a["draft_revision"] += 1
            self.store.put(db, "assignment", a)
            self.store.audit(db, user["id"], "rubric.draft_saved", assignment_id)
            return {"draft": a["rubric_draft"], "revision": a["draft_revision"]}

    def publish_rubric(self, user, assignment_id):
        with self.store.transaction() as db:
            a, _ = self.assignment(db, user, assignment_id, {"instructor"})
            if not a["rubric_draft"]:
                fail(409, "rubric_draft_required")
            data = self.validate_rubric(a, a["rubric_draft"])
            rubrics = self.store.all(db, "rubric", assignment_id)
            references = [
                d["id"]
                for d in self.store.all(db, "document", assignment_id)
                if d["kind"] != "submission"
            ]
            if (
                rubrics
                and all(rubrics[-1][k] == data[k] for k in data)
                and rubrics[-1]["reference_ids"] == references
            ):
                return rubrics[-1]
            rubric = {
                "id": new_id("rub"),
                "assignment_id": assignment_id,
                "version": len(rubrics) + 1,
                "published_at": now(),
                **data,
                "reference_ids": references,
            }
            self.store.put(db, "rubric", rubric, assignment_id)
            a["published_rubric_id"] = rubric["id"]
            self.store.put(db, "assignment", a)
            self.store.audit(
                db, user["id"], "rubric.published", assignment_id, {"rubric_id": rubric["id"]}
            )
            return rubric

    @staticmethod
    def document_view(d):
        return {
            k: d[k]
            for k in (
                "id",
                "assignment_id",
                "kind",
                "filename",
                "page_count",
                "sha256",
                "extraction",
                "has_unreadable_pages",
            )
        }

    def upload(self, user, assignment_id, kind, filename, content):
        if kind not in {"questions", "solution", "graded_example", "submission"}:
            fail(422, "invalid_document_kind")
        # Authorize before parsing bytes, then recheck under the mutation lock.
        with self.store.connection() as db:
            a, role = self.assignment(db, user, assignment_id)
            if (kind == "submission" and role != "student") or (
                kind != "submission" and role != "instructor"
            ):
                fail(403, "upload_role_denied")
            if kind == "submission":
                self.before_deadline(a)
        try:
            inspected = inspect_pdf(content)
        except ValueError as exc:
            fail(422, str(exc))
        d = {
            "id": new_id("doc"),
            "assignment_id": assignment_id,
            "kind": kind,
            "owner_id": user["id"],
            "filename": filename.replace("\\", "/").split("/")[-1][:200],
            "created_at": now(),
            **inspected,
        }
        path = self.store.root / "files" / f"{d['id']}.pdf"
        try:
            with self.store.transaction() as db:
                a, role = self.assignment(db, user, assignment_id)
                if (kind == "submission" and role != "student") or (
                    kind != "submission" and role != "instructor"
                ):
                    fail(403, "upload_role_denied")
                if kind == "submission":
                    self.before_deadline(a)
                path.write_bytes(content)
                path.chmod(0o600)
                self.store.put(db, "document", d, assignment_id)
                self.store.audit(
                    db,
                    user["id"],
                    "document.uploaded",
                    assignment_id,
                    {"document_id": d["id"], "kind": kind},
                )
                if kind != "submission":
                    a["draft_revision"] += 1
                    self.store.put(db, "assignment", a)
                    return self.document_view(d)
                previous = [
                    s
                    for s in self.store.all(db, "submission", assignment_id)
                    if s["student_id"] == user["id"]
                ]
                s = {
                    "id": new_id("sub"),
                    "assignment_id": assignment_id,
                    "student_id": user["id"],
                    "document_id": d["id"],
                    "version": len(previous) + 1,
                    "rubric_id": a["published_rubric_id"],
                    "created_at": now(),
                    "mapping": {},
                    "sealed": False,
                    "final": False,
                    "handed_in_at": None,
                    "assessment": None,
                    "job_id": None,
                    "review": {"revision": 0, "status": "not_started", "questions": {}},
                }
                self.store.put(db, "submission", s, assignment_id)
                return self.submission_view(db, s, role)
        except BaseException:
            path.unlink(missing_ok=True)
            raise

    def document(self, user, document_id):
        with self.store.connection() as db:
            d = required(self.store, db, "document", document_id)
            _, role = self.assignment(db, user, d["assignment_id"])
            if role == "student" and not (
                d["kind"] == "questions"
                or (d["kind"] == "submission" and d["owner_id"] == user["id"])
            ):
                fail(403, "document_access_denied")
            return d

    def transcript(self, user, document_id, body):
        with self.store.transaction() as db:
            d = required(self.store, db, "document", document_id)
            self.assignment(db, user, d["assignment_id"], {"instructor", "ta"})
            # Never change assessment input after any attempt has been sealed.
            submissions = self.store.all(db, "submission", d["assignment_id"])
            if any(s["document_id"] == document_id and s["sealed"] for s in submissions):
                fail(409, "document_frozen")
            if d["kind"] != "submission":
                fail(409, "reference_transcript_not_editable")
            blocks = body.model_dump(mode="json")["blocks"]
            if len({b["id"] for b in blocks}) != len(blocks) or any(
                b["page"] > d["page_count"] for b in blocks
            ):
                fail(422, "invalid_transcript_blocks")
            d["blocks"] = blocks
            d["extraction"] = "staff_transcript"
            d["has_unreadable_pages"] = any(
                not any(b["page"] == page and b["text"].strip() for b in blocks)
                for page in range(1, d["page_count"] + 1)
            )
            self.store.put(db, "document", d)
            self.store.audit(db, user["id"], "document.transcribed", document_id)
            return d

    def save_mapping(self, user, submission_id, body):
        with self.store.transaction() as db:
            s, a, role = self.submission(db, user, submission_id)
            if role != "student":
                fail(403, "student_action_required")
            self.writable_attempt(s, a)
            d = required(self.store, db, "document", s["document_id"])
            mapping = body.questions
            if set(mapping) != {q["id"] for q in a["questions"]}:
                fail(422, "map_every_question")
            if any(
                not pages
                or len(set(pages)) != len(pages)
                or any(p < 1 or p > d["page_count"] for p in pages)
                for pages in mapping.values()
            ):
                fail(422, "invalid_page_mapping")
            s["mapping"] = {k: sorted(v) for k, v in mapping.items()}
            self.store.put(db, "submission", s)
            self.store.audit(db, user["id"], "submission.mapped", submission_id)
            return self.submission_view(db, s, role)

    def submission_view(self, db, s, role):
        result = {
            k: s[k]
            for k in (
                "id",
                "assignment_id",
                "student_id",
                "document_id",
                "version",
                "rubric_id",
                "created_at",
                "mapping",
                "sealed",
                "final",
                "handed_in_at",
                "job_id",
            )
        }
        result["document"] = self.document_view(
            required(self.store, db, "document", s["document_id"])
        )
        assessment = safe_feedback_view(s["assessment"])
        if role != "student":
            result["assessment"] = assessment
            result["review"] = s["review"]
            result["student_name"] = required(self.store, db, "user", s["student_id"])["name"]
            result["rubric"] = required(self.store, db, "rubric", s["rubric_id"])
        else:
            result["assessment"] = (
                None
                if assessment is None
                else {
                    k: assessment[k]
                    for k in (
                        "score",
                        "max_points",
                        "status",
                        "questions",
                        "provider_id",
                        "mode",
                        "assessed_at",
                    )
                }
            )
            review = s["review"]
            result["review"] = {"status": review["status"]}
            result["review"]["comments"] = {
                q: {
                    "text": comment["text"],
                    "author_name": required(self.store, db, "user", comment["edited_by"])["name"],
                    "updated_at": comment["edited_at"],
                }
                for q, comment in review.get("student_comments", {}).items()
            }
            if review["status"] == "released":
                result["review"]["questions"] = {
                    q: {"score": v["score"]} for q, v in review["questions"].items()
                }
                result["review"]["score"] = review["score"]
        return result

    def get_submission(self, user, submission_id):
        with self.store.connection() as db:
            s, _, role = self.submission(db, user, submission_id)
            return self.submission_view(db, s, role)

    def list_submissions(self, user, assignment_id, final_only=False):
        with self.store.connection() as db:
            _, role = self.assignment(db, user, assignment_id)
            return [
                self.submission_view(db, s, role)
                for s in self.store.all(db, "submission", assignment_id)
                if (role != "student" or s["student_id"] == user["id"])
                and (not final_only or s["final"])
            ]

    def hand_in(self, user, submission_id):
        with self.store.transaction() as db:
            s, a, role = self.submission(db, user, submission_id)
            if role != "student":
                fail(403, "student_action_required")
            if s["final"]:
                return self.submission_view(db, s, role)
            self.before_deadline(a)
            siblings = [
                x
                for x in self.store.all(db, "submission", a["id"])
                if x["student_id"] == user["id"]
            ]
            if any(x["final"] for x in siblings):
                fail(409, "already_handed_in")
            if s["version"] != max(x["version"] for x in siblings):
                fail(409, "hand_in_latest_attempt")
            if not s["mapping"]:
                fail(409, "mapping_required")
            s["final"], s["sealed"], s["handed_in_at"] = True, True, now()
            self.store.put(db, "submission", s)
            self.store.audit(db, user["id"], "submission.handed_in", s["id"])
            return self.submission_view(db, s, role)

    @staticmethod
    def job_view(job):
        return {
            k: job[k]
            for k in (
                "id",
                "kind",
                "target_id",
                "status",
                "attempts",
                "created_at",
                "updated_at",
                "error_code",
            )
        }

    def start_assessment(self, user, submission_id):
        with self.store.transaction() as db:
            s, a, role = self.submission(db, user, submission_id)
            if s["job_id"]:
                return self.job_view(required(self.store, db, "job", s["job_id"]))
            if s["review"]["status"] in {"completed", "released"}:
                fail(409, "review_complete")
            if role == "student":
                self.before_deadline(a)
            if not s["mapping"]:
                fail(409, "mapping_required")
            s["sealed"] = True
            job = self.new_job(db, "assessment", submission_id, a["id"], user["id"])
            s["job_id"] = job["id"]
            self.store.put(db, "submission", s)
            return self.job_view(job)

    def new_job(self, db, kind, target_id, assignment_id, actor, revision=None):
        job = {
            "id": new_id("job"),
            "kind": kind,
            "target_id": target_id,
            "assignment_id": assignment_id,
            "actor_id": actor,
            "status": "queued",
            "attempts": 0,
            "created_at": now(),
            "updated_at": now(),
            "error_code": None,
            "draft_revision": revision,
        }
        # Snapshot the private input once. A retry repeats this input, not live assignment state.
        job["context"] = self.provider_context(db, job)
        self.store.put(db, "job", job, assignment_id)
        self.store.audit(db, actor, "job.queued", target_id, {"job_id": job["id"]})
        return job

    def start_rubric_job(self, user, assignment_id):
        with self.store.transaction() as db:
            a, _ = self.assignment(db, user, assignment_id, {"instructor", "ta"})
            existing = [
                j
                for j in self.store.all(db, "job", assignment_id)
                if j["kind"] == "rubric" and j["status"] in {"queued", "running"}
            ]
            if existing:
                return self.job_view(existing[-1])
            return self.job_view(
                self.new_job(
                    db, "rubric", assignment_id, assignment_id, user["id"], a["draft_revision"]
                )
            )

    def authorize_job(self, db, user, job):
        if job["kind"] == "assessment":
            self.submission(db, user, job["target_id"])
        else:
            self.assignment(db, user, job["assignment_id"], {"instructor", "ta"})

    def get_job(self, user, job_id):
        with self.store.connection() as db:
            j = required(self.store, db, "job", job_id)
            self.authorize_job(db, user, j)
            return self.job_view(j)

    def retry_job(self, user, job_id):
        with self.store.transaction() as db:
            j = required(self.store, db, "job", job_id)
            self.authorize_job(db, user, j)
            if j["status"] != "failed":
                fail(409, "only_failed_jobs_retry")
            a, role = self.assignment(db, user, j["assignment_id"])
            if j["kind"] == "assessment":
                s = required(self.store, db, "submission", j["target_id"])
                if s["review"]["status"] in {"completed", "released"}:
                    fail(409, "review_complete")
                if role == "student":
                    self.before_deadline(a)
            elif a["draft_revision"] != j["draft_revision"]:
                fail(409, "draft_changed_start_new_job")
            j.update(status="queued", error_code=None, updated_at=now())
            self.store.put(db, "job", j)
            self.store.audit(db, user["id"], "job.retried", j["target_id"])
            return self.job_view(j)

    def recover_jobs(self):
        with self.store.transaction() as db:
            for j in self.store.all(db, "job"):
                if j["status"] in {"queued", "running"}:
                    j.update(status="failed", error_code="interrupted", updated_at=now())
                    self.store.put(db, "job", j)
                    self.store.audit(
                        db, "system", "job.interrupted", j["target_id"], {"job_id": j["id"]}
                    )

    def provider_context(self, db, job):
        a = required(self.store, db, "assignment", job["assignment_id"])
        context = {
            "assignment": self.public_assignment(a),
            "references": [
                d for d in self.store.all(db, "document", a["id"]) if d["kind"] != "submission"
            ],
        }
        if job["kind"] == "assessment":
            s = required(self.store, db, "submission", job["target_id"])
            rubric = required(self.store, db, "rubric", s["rubric_id"])
            context.update(
                submission=s,
                document=required(self.store, db, "document", s["document_id"]),
                rubric=rubric,
            )
            context["references"] = [
                d for d in context["references"] if d["id"] in rubric["reference_ids"]
            ]
        return context

    def validate_assessment(self, context, raw):
        parsed = ProviderAssessment.model_validate(raw).model_dump(mode="json")
        decisions = parsed["decisions"]
        rubric = context["rubric"]
        criteria = {c["id"]: c for c in rubric["criteria"]}
        blocks = {b["id"]: b for b in context["document"]["blocks"]}
        if len(decisions) != len(criteria) or {d["criterion_id"] for d in decisions} != set(
            criteria
        ):
            raise ValueError("Criterion coverage")
        for d in decisions:
            c = criteria[d["criterion_id"]]
            pages = context["submission"]["mapping"][c["question_id"]]
            if not d["evidence_ids"] or any(
                b not in blocks or blocks[b]["page"] not in pages for b in d["evidence_ids"]
            ):
                raise ValueError("Evidence not in mapped question")
            if d["outcome"] != "uncertain" and not any(
                blocks[b]["text"].strip() for b in d["evidence_ids"]
            ):
                raise ValueError("Unreadable evidence cannot support a grade")
        questions = []
        for q in context["assignment"]["questions"]:
            ds = [d for d in decisions if criteria[d["criterion_id"]]["question_id"] == q["id"]]
            uncertain = any(d["outcome"] == "uncertain" for d in ds)
            flags = []
            for d in ds:
                if d["outcome"] == "met":
                    continue
                category = criteria[d["criterion_id"]]["category"]
                if d["outcome"] == "uncertain":
                    category = (
                        "needs_review"
                        if any(blocks[b]["text"].strip() for b in d["evidence_ids"])
                        else "unreadable"
                    )
                flags.append(
                    {
                        "id": f"{q['id']}-flag-{len(flags) + 1}",
                        "category": category,
                        "message": student_hint(criteria[d["criterion_id"]], category),
                        "anchors": [
                            {
                                "id": f"anchor-{index}",
                                "page": blocks[b]["page"],
                                "bbox": blocks[b]["bbox"],
                            }
                            for index, b in enumerate(dict.fromkeys(d["evidence_ids"]), 1)
                        ],
                    }
                )
            questions.append(
                {
                    "question_id": q["id"],
                    "score": None
                    if uncertain
                    else round(
                        sum(
                            criteria[d["criterion_id"]]["points"]
                            for d in ds
                            if d["outcome"] == "met"
                        ),
                        6,
                    ),
                    "max_points": q["max_points"],
                    "status": "needs_review" if uncertain else "estimated",
                    "flags": flags,
                }
            )
        uncertain = any(q["score"] is None for q in questions)
        return {
            "score": None if uncertain else round(sum(q["score"] for q in questions), 6),
            "max_points": sum(q["max_points"] for q in questions),
            "status": "needs_review" if uncertain else "estimated",
            "questions": questions,
            "decisions": decisions,
            "provider_id": self.provider.id,
            "mode": self.provider.mode,
            "assessed_at": now(),
            "input_sha256": context["document"]["sha256"],
        }

    def run_job(self, job_id):
        with self.store.transaction() as db:
            j = required(self.store, db, "job", job_id)
            if j["status"] != "queued":
                return
            j.update(status="running", attempts=j["attempts"] + 1, updated_at=now())
            self.store.put(db, "job", j)
            context = j["context"]
        try:
            if j["kind"] == "assessment":
                result = self.validate_assessment(context, self.provider.assess(context))
                generate_student_feedback(self.provider, context, result)
            else:
                result = self.validate_rubric(
                    context["assignment"], self.provider.draft_rubric(context)
                )
            with self.store.transaction() as db:
                current = required(self.store, db, "job", job_id)
                if current["status"] != "running" or current["attempts"] != j["attempts"]:
                    return
                if j["kind"] == "assessment":
                    s = required(self.store, db, "submission", j["target_id"])
                    s["assessment"] = result
                    self.store.put(db, "submission", s)
                else:
                    a = required(self.store, db, "assignment", j["assignment_id"])
                    if a["draft_revision"] != j["draft_revision"]:
                        raise ValueError("Draft changed during generation")
                    a["rubric_draft"] = result
                    a["draft_revision"] += 1
                    self.store.put(db, "assignment", a)
                current.update(status="succeeded", error_code=None, updated_at=now())
                self.store.put(db, "job", current)
                self.store.audit(
                    db,
                    j["actor_id"],
                    "job.succeeded",
                    j["target_id"],
                    {"job_id": job_id, "provider_id": self.provider.id},
                )
        except Exception as exc:
            # Never expose provider exception strings (can include prompts/keys) to clients.
            error = (
                "not_configured"
                if isinstance(exc, ProviderUnavailable)
                else (
                    "invalid_result"
                    if isinstance(exc, (ValueError, ValidationError, HTTPException))
                    else "provider_failed"
                )
            )
            with self.store.transaction() as db:
                current = required(self.store, db, "job", job_id)
                if current["status"] == "running" and current["attempts"] == j["attempts"]:
                    current.update(status="failed", error_code=error, updated_at=now())
                    self.store.put(db, "job", current)
                    self.store.audit(
                        db,
                        j["actor_id"],
                        "job.failed",
                        j["target_id"],
                        {"job_id": job_id, "error_code": error},
                    )

    def save_review(self, user, submission_id, body):
        with self.store.transaction() as db:
            s, a, _ = self.submission(db, user, submission_id, staff=True)
            review = s["review"]
            if not s["final"]:
                fail(409, "hand_in_required")
            self.check_revision(review, body.expected_revision)
            if review["status"] in {"completed", "released"}:
                fail(409, "reopen_review_first")
            maximums = {q["id"]: q["max_points"] for q in a["questions"]}
            updates = body.model_dump(mode="json")["questions"]
            if any(q not in maximums or v["score"] > maximums[q] for q, v in updates.items()):
                fail(422, "review_score_out_of_bounds")
            review["questions"].update(updates)
            review.update(
                status="in_progress",
                revision=review["revision"] + 1,
                updated_at=now(),
                reviewer_id=user["id"],
            )
            self.store.put(db, "submission", s)
            self.store.audit(db, user["id"], "review.saved", s["id"], dict(review))
            return review

    def save_explanation(self, user, submission_id, criterion_id, body):
        with self.store.transaction() as db:
            s, _, _ = self.submission(db, user, submission_id, staff=True)
            review = s["review"]
            if not s["final"]:
                fail(409, "hand_in_required")
            self.check_revision(review, body.expected_revision)
            if review["status"] in {"completed", "released"}:
                fail(409, "reopen_review_first")
            decisions = (s["assessment"] or {}).get("decisions", [])
            if criterion_id not in {d["criterion_id"] for d in decisions}:
                fail(422, "unknown_criterion_decision")
            text = body.text.strip()
            if not text:
                fail(422, "explanation_required")
            edit = {"text": text, "edited_by": user["id"], "edited_at": now()}
            # Corrections belong to the staff review. Keep provider output, scores and
            # question-completion state intact, and use the shared review revision lock.
            review.setdefault("criterion_explanations", {})[criterion_id] = edit
            review.update(revision=review["revision"] + 1, updated_at=edit["edited_at"])
            self.store.put(db, "submission", s)
            self.store.audit(
                db,
                user["id"],
                "review.explanation_saved",
                s["id"],
                {"criterion_id": criterion_id, **edit},
            )
            return review

    def save_student_comment(self, user, submission_id, question_id, body):
        with self.store.transaction() as db:
            s, a, _ = self.submission(db, user, submission_id, staff=True)
            review = s["review"]
            if not s["final"]:
                fail(409, "hand_in_required")
            self.check_revision(review, body.expected_revision)
            if question_id not in {q["id"] for q in a["questions"]}:
                fail(422, "unknown_question")
            text = body.text.strip()
            edited_at = now()
            comments = review.setdefault("student_comments", {})
            if text:
                comments[question_id] = {
                    "text": text,
                    "edited_by": user["id"],
                    "edited_at": edited_at,
                }
            else:
                comments.pop(question_id, None)
            # Student comments are shared on save, independently of grade release.
            # Never copy private review reasons or criterion explanations into them.
            review.update(revision=review["revision"] + 1, updated_at=edited_at)
            self.store.put(db, "submission", s)
            self.store.audit(
                db,
                user["id"],
                "review.student_comment_saved",
                s["id"],
                {"question_id": question_id, "text": text, "edited_at": edited_at},
            )
            return review

    @staticmethod
    def check_revision(review, expected):
        if review["revision"] != expected:
            fail(409, "stale_review_reload")

    def transition_review(self, user, submission_id, action, body):
        with self.store.transaction() as db:
            s, a, role = self.submission(db, user, submission_id, staff=True)
            r = s["review"]
            if not s["final"]:
                fail(409, "hand_in_required")
            self.check_revision(r, body.expected_revision)
            if action == "complete":
                if r["status"] != "in_progress" or set(r["questions"]) != {
                    q["id"] for q in a["questions"]
                }:
                    fail(409, "review_every_question")
                if s["job_id"]:
                    j = required(self.store, db, "job", s["job_id"])
                    if j["status"] in {"queued", "running"}:
                        fail(409, "assessment_still_running")
                r.update(
                    status="completed",
                    score=round(sum(x["score"] for x in r["questions"].values()), 6),
                    completed_at=now(),
                )
            elif action == "release":
                if role != "instructor":
                    fail(403, "instructor_required")
                if r["status"] != "completed":
                    fail(409, "complete_review_first")
                r.update(status="released", released_at=now())
            elif action == "reopen":
                if role != "instructor":
                    fail(403, "instructor_required")
                if r["status"] not in {"completed", "released"}:
                    fail(409, "review_not_complete")
                r.update(status="in_progress", reopen_reason=body.reason)
                r.pop("score", None)
                r.pop("released_at", None)
            r["revision"] += 1
            self.store.put(db, "submission", s)
            self.store.audit(db, user["id"], f"review.{action}", s["id"], dict(r))
            return r

    def create_report(self, user, submission_id, body):
        with self.store.transaction() as db:
            s, a, role = self.submission(db, user, submission_id)
            if role != "student":
                fail(403, "student_action_required")
            if body.question_id not in {q["id"] for q in a["questions"]}:
                fail(422, "unknown_question")
            r = {
                "id": new_id("rep"),
                "submission_id": s["id"],
                "assignment_id": a["id"],
                "student_id": user["id"],
                **body.model_dump(),
                "status": "open",
                "created_at": now(),
                "staff_note": None,
            }
            self.store.put(db, "report", r, a["id"])
            self.store.audit(db, user["id"], "report.created", s["id"], {"report_id": r["id"]})
            return self.report_view(r, role)

    @staticmethod
    def report_view(r, role):
        return r if role != "student" else {k: v for k, v in r.items() if k != "staff_note"}

    def reports(self, user, assignment_id):
        with self.store.connection() as db:
            _, role = self.assignment(db, user, assignment_id)
            return [
                self.report_view(r, role)
                for r in self.store.all(db, "report", assignment_id)
                if role != "student" or r["student_id"] == user["id"]
            ]

    def resolve_report(self, user, report_id, body):
        with self.store.transaction() as db:
            r = required(self.store, db, "report", report_id)
            self.assignment(db, user, r["assignment_id"], {"instructor", "ta"})
            r.update(**body.model_dump(), resolved_by=user["id"], resolved_at=now())
            self.store.put(db, "report", r)
            self.store.audit(
                db,
                user["id"],
                "report.resolved",
                r["submission_id"],
                {"report_id": report_id, **body.model_dump()},
            )
            return r

    def analytics(self, user, assignment_id):
        with self.store.connection() as db:
            a, _ = self.assignment(db, user, assignment_id, {"instructor", "ta"})
            submissions = self.store.all(db, "submission", assignment_id)
            students = {}
            for s in submissions:
                students.setdefault(s["student_id"], []).append(s)
            finals = [s for s in submissions if s["final"]]
            result = {
                "students_with_attempts": len(students),
                "final_submissions": len(finals),
                "reviewed": sum(s["review"]["status"] in {"completed", "released"} for s in finals),
                "released": sum(s["review"]["status"] == "released" for s in finals),
                "open_reports": sum(
                    r["status"] == "open" for r in self.store.all(db, "report", assignment_id)
                ),
                "questions": [],
                "interpretation": "Recorded feedback, not a measurement of learning. Unassessed attempts excluded.",
            }
            for q in a["questions"]:
                stats = {
                    "question_id": q["id"],
                    "max_points": q["max_points"],
                    "first": {},
                    "latest": {},
                }
                for label, index in (("first", 0), ("latest", -1)):
                    scores, counts, versions = [], {}, set()
                    assessed, flagged, modes = 0, 0, set()
                    for attempts in students.values():
                        s = sorted(attempts, key=lambda s: s["version"])[index]
                        if not s["assessment"]:
                            continue
                        versions.add(s["rubric_id"])
                        question = next(
                            x for x in s["assessment"]["questions"] if x["question_id"] == q["id"]
                        )
                        assessed += 1
                        flagged += bool(question["flags"])
                        modes.add(s["assessment"]["mode"])
                        if question["score"] is not None:
                            scores.append(question["score"])
                        for cat in {f["category"] for f in question["flags"]}:
                            counts[cat] = counts.get(cat, 0) + 1
                    stats[label] = {
                        "assessed_students": assessed,
                        "flagged_students": flagged,
                        "assessment_modes": sorted(modes),
                        "scored_students": len(scores),
                        "mean_score": round(sum(scores) / len(scores), 6) if scores else None,
                        "students_by_category": counts,
                        "rubric_ids": sorted(versions),
                    }
                result["questions"].append(stats)
            return result

    def audit_events(self, user, assignment_id):
        with self.store.connection() as db:
            self.assignment(db, user, assignment_id, {"instructor"})
            ids = {assignment_id} | {
                s["id"] for s in self.store.all(db, "submission", assignment_id)
            }
            ids |= {d["id"] for d in self.store.all(db, "document", assignment_id)}
            return [e for e in self.store.all(db, "audit") if e["target_id"] in ids]
