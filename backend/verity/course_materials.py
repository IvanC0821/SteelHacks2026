"""Instructor-reviewed course deductions. Originals stay in the private backend store."""

import hashlib
import json
from collections import defaultdict

from pydantic import ValidationError

from .documents import inspect_pdf
from .provider import ProviderUnavailable
from .schemas import CourseDeductions, CourseInput
from .service import fail, required
from .store import new_id, now


def normalize(value):
    return " ".join(value.split())


class CourseMaterials:
    def __init__(self, service):
        self.service = service
        self.store = service.store
        self.provider = service.provider

    @staticmethod
    def instructor(user):
        if user["role"] != "instructor":
            fail(403, "instructor_required")

    @staticmethod
    def inspect(content):
        try:
            return inspect_pdf(content)
        except ValueError as exc:
            fail(422, str(exc))

    def extract(self, user, filename, content):
        self.instructor(user)
        document = self.inspect(content)
        if document["has_unreadable_pages"]:
            fail(422, "course_pdf_needs_text")
        if sum(len(block["text"]) for block in document["blocks"]) > 60000:
            fail(422, "course_pdf_too_long")
        generate = getattr(self.provider, "draft_course_deductions", None)
        if not callable(generate):
            fail(503, "course_autofill_unavailable")
        try:
            draft = CourseDeductions.model_validate(generate({"document": document}))
            # The shared PDF parser returns individual measured lines when geometry is
            # available, or a single page block otherwise. Preserve all lines so a
            # source quote may span line breaks without losing earlier text on a page.
            page_blocks = defaultdict(list)
            for block in document["blocks"]:
                page_blocks[block["page"]].append(block["text"])
            pages = {page: normalize("\n".join(blocks)) for page, blocks in page_blocks.items()}
            for rule in draft.rules:
                # Do not present hallucinated page citations or numeric penalties as extracted.
                quote = normalize(rule.source_quote)
                if not quote or quote not in pages.get(rule.source_page, ""):
                    raise ValueError("Ungrounded rule")
                if rule.penalty is not None and (
                    not rule.penalty.strip() or normalize(rule.penalty) not in quote
                ):
                    raise ValueError("Ungrounded penalty")
            return {
                "draft": draft.model_dump(mode="json"),
                "page_count": document["page_count"],
                "provider_id": self.provider.id,
            }
        except ProviderUnavailable:
            fail(503, "course_autofill_unavailable")
        except Exception:
            # Never expose provider credentials, document text, or raw vendor errors.
            fail(502, "course_autofill_failed")

    def create(self, user, name, deductions_json, request_id, filename=None, content=None):
        self.instructor(user)
        try:
            name = CourseInput(name=name.strip()).name
            deductions = CourseDeductions.model_validate_json(deductions_json).model_dump(
                mode="json"
            )
        except ValidationError:
            fail(422, "invalid_course_deductions")
        if any(not rule["description"].strip() for rule in deductions["rules"]):
            fail(422, "invalid_course_deductions")
        inspected = self.inspect(content) if content is not None else None
        for rule in deductions["rules"]:
            if rule["source_page"] is not None and (
                not inspected or rule["source_page"] > inspected["page_count"]
            ):
                fail(422, "invalid_course_deductions")
            rule["penalty"] = (rule["penalty"] or "").strip() or None
        signature = hashlib.sha256(
            json.dumps(
                {
                    "name": name,
                    "deductions": deductions,
                    "pdf": inspected["sha256"] if inspected else None,
                },
                sort_keys=True,
            ).encode()
        ).hexdigest()
        request_key = "ccr_" + hashlib.sha256(f"{user['id']}:{request_id}".encode()).hexdigest()
        path = None
        try:
            with self.store.transaction() as db:
                previous = self.store.get(db, "course_create_request", request_key)
                if previous:
                    if previous["signature"] != signature:
                        fail(409, "course_create_request_changed")
                    return {
                        **self.service.public_course(
                            required(self.store, db, "course", previous["course_id"])
                        ),
                        "role": "instructor",
                    }
                course = {
                    "id": new_id("crs"),
                    "name": name,
                    "created_at": now(),
                    "deductions": deductions,
                    "deductions_document_id": None,
                }
                if inspected:
                    doc = {
                        "id": new_id("cdoc"),
                        "course_id": course["id"],
                        "owner_id": user["id"],
                        "filename": filename.replace("\\", "/").split("/")[-1][:200],
                        "created_at": now(),
                        **inspected,
                    }
                    path = self.store.root / "files" / f"{doc['id']}.pdf"
                    path.write_bytes(content)
                    path.chmod(0o600)
                    self.store.put(db, "course_document", doc, course["id"])
                    course["deductions_document_id"] = doc["id"]
                self.store.put(db, "course", course)
                db.execute(
                    "INSERT INTO memberships VALUES(?,?,?)",
                    (course["id"], user["id"], "instructor"),
                )
                self.store.put(
                    db,
                    "course_create_request",
                    {"id": request_key, "signature": signature, "course_id": course["id"]},
                    course["id"],
                )
                self.store.audit(db, user["id"], "course.created", course["id"])
                return {**self.service.public_course(course), "role": "instructor"}
        except BaseException:
            if path:
                path.unlink(missing_ok=True)
            raise

    def detail(self, user, course_id):
        with self.store.connection() as db:
            role = self.service.membership(db, user, course_id)
            course = required(self.store, db, "course", course_id)
            result = {**self.service.public_course(course), "role": role}
            if role != "student":
                result["deductions"] = course.get("deductions", {"rules": [], "notes": ""})
                doc_id = course.get("deductions_document_id")
                doc = required(self.store, db, "course_document", doc_id) if doc_id else None
                result["deductions_document"] = (
                    {k: doc[k] for k in ("id", "filename", "page_count")} if doc else None
                )
            return result

    def document(self, user, course_id):
        with self.store.connection() as db:
            self.service.membership(db, user, course_id, {"instructor", "ta"})
            course = required(self.store, db, "course", course_id)
            return required(self.store, db, "course_document", course.get("deductions_document_id"))
