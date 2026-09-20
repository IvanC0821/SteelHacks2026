import os
from contextlib import asynccontextmanager

from fastapi import BackgroundTasks, Depends, FastAPI, File, Form, Query, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .course_materials import CourseMaterials
from .documents import MAX_BYTES
from .provider import load_provider
from .schemas import (
    AssignmentInput,
    CourseInput,
    EnrollmentInput,
    ExplanationInput,
    PageMap,
    ReopenInput,
    ReportInput,
    ResolveReport,
    ReviewInput,
    RevisionInput,
    RubricInput,
    StudentCommentInput,
    Transcript,
)
from .service import Service, fail
from .store import Store


def create_app(data_dir=None, provider=None, run_jobs=True):
    store = Store(data_dir or os.getenv("VERITY_DATA_DIR", ".data"))
    service = Service(store, provider or load_provider())
    course_materials = CourseMaterials(service)

    @asynccontextmanager
    async def lifespan(app):
        service.recover_jobs()
        yield

    app = FastAPI(
        title="Verity",
        version="0.1.0",
        lifespan=lifespan,
        description="Rubric-based practice feedback and whole-paper human review",
    )
    app.state.service = service
    app.state.store = store
    origins = os.getenv("VERITY_CORS_ORIGINS", "http://localhost:3000,http://localhost:5173").split(
        ","
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_methods=["GET", "POST", "PUT"],
        allow_headers=["Authorization", "Content-Type"],
        allow_credentials=False,
    )
    bearer = HTTPBearer(auto_error=False)

    def current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)):
        user = store.authenticate(credentials.credentials) if credentials else None
        if not user:
            fail(401, "invalid_or_expired_session")
        return user

    def schedule(tasks, job):
        if run_jobs and job["status"] == "queued":
            tasks.add_task(service.run_job, job["id"])
        return job

    @app.exception_handler(RequestValidationError)
    async def validation_error(request, exc):
        # Pydantic's default error includes raw inputs; return locations/types only.
        return JSONResponse(
            status_code=422,
            content={
                "detail": {
                    "code": "invalid_request",
                    "fields": [{"path": list(e["loc"]), "type": e["type"]} for e in exc.errors()],
                }
            },
        )

    @app.middleware("http")
    async def private_responses(request, call_next):
        response = await call_next(request)
        response.headers["Cache-Control"] = "no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response

    @app.get("/health", tags=["system"])
    def health():
        return {"status": "ok", "version": "0.1.0"}

    @app.get("/api/me", tags=["identity"])
    def me(user=Depends(current_user)):
        return user

    @app.get("/api/capabilities", tags=["system"])
    def capabilities(user=Depends(current_user)):
        return {
            "provider_id": service.provider.id,
            "mode": service.provider.mode,
            "automated_assessment": service.provider.mode != "unconfigured",
            "ocr": False,
            "extraction": "pdf_text_or_staff_transcript",
            "max_upload_bytes": MAX_BYTES,
            "max_pages": 40,
            "human_review_required": True,
            "course_deduction_extraction": callable(
                getattr(service.provider, "draft_course_deductions", None)
            ),
        }

    @app.post("/api/courses", status_code=201, tags=["courses"])
    def create_course(body: CourseInput, user=Depends(current_user)):
        return service.create_course(user, body)

    @app.get("/api/courses", tags=["courses"])
    def courses(user=Depends(current_user)):
        return service.list_courses(user)

    async def course_pdf(file):
        try:
            content = await file.read(MAX_BYTES + 1)
            if len(content) > MAX_BYTES:
                fail(413, "pdf_too_large")
            return content
        finally:
            await file.close()

    @app.post("/api/course-deduction-drafts", tags=["courses"])
    async def extract_course_deductions(file: UploadFile = File(...), user=Depends(current_user)):
        from starlette.concurrency import run_in_threadpool

        course_materials.instructor(user)
        content = await course_pdf(file)
        return await run_in_threadpool(course_materials.extract, user, file.filename, content)

    @app.post("/api/courses/from-pdf", status_code=201, tags=["courses"])
    async def create_course_from_pdf(
        name: str = Form(min_length=1, max_length=200),
        deductions: str = Form(max_length=500000),
        request_id: str = Form(min_length=1, max_length=100),
        file: UploadFile | None = File(default=None),
        user=Depends(current_user),
    ):
        from starlette.concurrency import run_in_threadpool

        course_materials.instructor(user)
        content = await course_pdf(file) if file else None
        return await run_in_threadpool(
            course_materials.create,
            user,
            name,
            deductions,
            request_id,
            (file.filename or "deductions.pdf") if file else None,
            content,
        )

    @app.get("/api/courses/{course_id}", tags=["courses"])
    def course_detail(course_id: str, user=Depends(current_user)):
        return course_materials.detail(user, course_id)

    @app.get("/api/courses/{course_id}/deductions-pdf", tags=["courses"])
    def course_deductions_pdf(course_id: str, user=Depends(current_user)):
        doc = course_materials.document(user, course_id)
        return FileResponse(
            store.root / "files" / f"{doc['id']}.pdf",
            media_type="application/pdf",
            filename=doc["filename"],
            content_disposition_type="inline",
        )

    @app.post("/api/courses/{course_id}/members", tags=["courses"])
    def enroll(course_id: str, body: EnrollmentInput, user=Depends(current_user)):
        return service.enroll(user, course_id, body)

    @app.get("/api/courses/{course_id}/members", tags=["courses"])
    def members(course_id: str, user=Depends(current_user)):
        return service.roster(user, course_id)

    @app.post("/api/courses/{course_id}/assignments", status_code=201, tags=["assignments"])
    def create_assignment(course_id: str, body: AssignmentInput, user=Depends(current_user)):
        return service.create_assignment(user, course_id, body)

    @app.get("/api/courses/{course_id}/assignments", tags=["assignments"])
    def assignments(course_id: str, user=Depends(current_user)):
        return service.list_assignments(user, course_id)

    @app.get("/api/assignments/{assignment_id}", tags=["assignments"])
    def assignment(assignment_id: str, user=Depends(current_user)):
        return service.get_assignment(user, assignment_id)

    @app.put("/api/assignments/{assignment_id}/rubric-draft", tags=["rubrics"])
    def save_rubric(assignment_id: str, body: RubricInput, user=Depends(current_user)):
        return service.save_rubric(user, assignment_id, body)

    @app.post("/api/assignments/{assignment_id}/rubric-publish", tags=["rubrics"])
    def publish_rubric(assignment_id: str, user=Depends(current_user)):
        return service.publish_rubric(user, assignment_id)

    @app.post("/api/assignments/{assignment_id}/rubric-jobs", status_code=202, tags=["jobs"])
    def rubric_job(assignment_id: str, tasks: BackgroundTasks, user=Depends(current_user)):
        return schedule(tasks, service.start_rubric_job(user, assignment_id))

    @app.post("/api/assignments/{assignment_id}/documents", status_code=201, tags=["documents"])
    async def upload(
        assignment_id: str,
        file: UploadFile = File(...),
        kind: str = Query(pattern="^(questions|solution|graded_example|submission)$"),
        user=Depends(current_user),
    ):
        from starlette.concurrency import run_in_threadpool

        try:
            content = await file.read(MAX_BYTES + 1)
            if len(content) > MAX_BYTES:
                fail(413, "pdf_too_large")
            return await run_in_threadpool(
                service.upload, user, assignment_id, kind, file.filename or "document.pdf", content
            )
        finally:
            await file.close()

    @app.get("/api/documents/{document_id}", tags=["documents"])
    def document(document_id: str, user=Depends(current_user)):
        d = service.document(user, document_id)
        return service.document_view(d)

    @app.get("/api/documents/{document_id}/file", tags=["documents"])
    def download(document_id: str, user=Depends(current_user)):
        d = service.document(user, document_id)
        return FileResponse(
            store.root / "files" / f"{d['id']}.pdf",
            media_type="application/pdf",
            filename=d["filename"],
            content_disposition_type="inline",
        )

    @app.put("/api/documents/{document_id}/transcript", tags=["documents"])
    def transcript(document_id: str, body: Transcript, user=Depends(current_user)):
        return service.transcript(user, document_id, body)

    @app.get("/api/assignments/{assignment_id}/submissions", tags=["submissions"])
    def submissions(assignment_id: str, final_only: bool = False, user=Depends(current_user)):
        return service.list_submissions(user, assignment_id, final_only)

    @app.get("/api/submissions/{submission_id}", tags=["submissions"])
    def submission(submission_id: str, user=Depends(current_user)):
        return service.get_submission(user, submission_id)

    @app.put("/api/submissions/{submission_id}/mapping", tags=["submissions"])
    def mapping(submission_id: str, body: PageMap, user=Depends(current_user)):
        return service.save_mapping(user, submission_id, body)

    @app.post("/api/submissions/{submission_id}/assessment-jobs", status_code=202, tags=["jobs"])
    def assess(submission_id: str, tasks: BackgroundTasks, user=Depends(current_user)):
        return schedule(tasks, service.start_assessment(user, submission_id))

    @app.get("/api/jobs/{job_id}", tags=["jobs"])
    def job(job_id: str, user=Depends(current_user)):
        return service.get_job(user, job_id)

    @app.post("/api/jobs/{job_id}/retry", status_code=202, tags=["jobs"])
    def retry(job_id: str, tasks: BackgroundTasks, user=Depends(current_user)):
        return schedule(tasks, service.retry_job(user, job_id))

    @app.post("/api/submissions/{submission_id}/hand-in", tags=["submissions"])
    def hand_in(submission_id: str, user=Depends(current_user)):
        return service.hand_in(user, submission_id)

    @app.put("/api/submissions/{submission_id}/review", tags=["review"])
    def save_review(submission_id: str, body: ReviewInput, user=Depends(current_user)):
        return service.save_review(user, submission_id, body)

    @app.put("/api/submissions/{submission_id}/review/explanations/{criterion_id}", tags=["review"])
    def save_explanation(
        submission_id: str, criterion_id: str, body: ExplanationInput, user=Depends(current_user)
    ):
        return service.save_explanation(user, submission_id, criterion_id, body)

    @app.put("/api/submissions/{submission_id}/review/comments/{question_id}", tags=["review"])
    def save_student_comment(
        submission_id: str, question_id: str, body: StudentCommentInput, user=Depends(current_user)
    ):
        return service.save_student_comment(user, submission_id, question_id, body)

    @app.post("/api/submissions/{submission_id}/review/complete", tags=["review"])
    def complete_review(submission_id: str, body: RevisionInput, user=Depends(current_user)):
        return service.transition_review(user, submission_id, "complete", body)

    @app.post("/api/submissions/{submission_id}/review/release", tags=["review"])
    def release_review(submission_id: str, body: RevisionInput, user=Depends(current_user)):
        return service.transition_review(user, submission_id, "release", body)

    @app.post("/api/submissions/{submission_id}/review/reopen", tags=["review"])
    def reopen_review(submission_id: str, body: ReopenInput, user=Depends(current_user)):
        return service.transition_review(user, submission_id, "reopen", body)

    @app.post("/api/submissions/{submission_id}/reports", status_code=201, tags=["reports"])
    def report(submission_id: str, body: ReportInput, user=Depends(current_user)):
        return service.create_report(user, submission_id, body)

    @app.get("/api/assignments/{assignment_id}/reports", tags=["reports"])
    def reports(assignment_id: str, user=Depends(current_user)):
        return service.reports(user, assignment_id)

    @app.put("/api/reports/{report_id}", tags=["reports"])
    def resolve_report(report_id: str, body: ResolveReport, user=Depends(current_user)):
        return service.resolve_report(user, report_id, body)

    @app.get("/api/assignments/{assignment_id}/analytics", tags=["analytics"])
    def analytics(assignment_id: str, user=Depends(current_user)):
        return service.analytics(user, assignment_id)

    @app.get("/api/assignments/{assignment_id}/audit", tags=["audit"])
    def audit(assignment_id: str, user=Depends(current_user)):
        return service.audit_events(user, assignment_id)

    return app
