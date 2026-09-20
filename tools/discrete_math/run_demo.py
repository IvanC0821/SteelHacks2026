"""Run the fictional induction paper through a configured model, then export evidence.

Start the API with the same data directory first. From the repository root:

    PYTHONPATH=backend:. .venv/bin/python -m tools.discrete_math.run_demo

Use --resume after an interruption. Resume only reads the saved submission/job; it
never starts an assessment or retries a failed model call. Local credentials are
saved in the ignored frontend/.dev/session.json, never in published artifacts.
"""

import argparse
import hashlib
import json
import os
import re
import sys
import time
from contextlib import ExitStack
from datetime import UTC, datetime, timedelta
from pathlib import Path
from urllib.parse import urlsplit

import httpx
from verity.schemas import Question, RubricInput
from verity.store import Store

ROOT = Path(__file__).resolve().parents[2]
CONTENT = Path(__file__).with_name("content.json")
SESSION = ROOT / "frontend" / ".dev" / "session.json"
DEMO = "discrete-math-induction"
INSTRUCTOR = "Dana Whitfield"
STUDENT = "Farah Aziz"
WAIT_SECONDS = 660
SECRET_KEYS = {"token", "authorization", "api_key", "apikey", "password", "secret", "key"}


class DemoError(Exception):
    """An intentionally public error, without API bodies or credential values."""


class Client:
    def __init__(self, api, token):
        self.http = httpx.Client(
            base_url=api + "/api",
            headers={"Authorization": f"Bearer {token}"},
            timeout=30,
            follow_redirects=False,
        )

    def call(self, method, path, **kwargs):
        response = self.http.request(method, path, **kwargs)
        if not response.is_success:
            code = "request_failed"
            try:
                detail = response.json().get("detail", {})
                candidate = detail.get("code") if isinstance(detail, dict) else None
                if isinstance(candidate, str) and re.fullmatch(r"[a-z_]{1,80}", candidate):
                    code = candidate
            except (ValueError, AttributeError):
                pass
            raise DemoError(f"{method} {path}: HTTP {response.status_code} ({code})")
        return response.json()


def save_session(session):
    SESSION.parent.mkdir(parents=True, exist_ok=True)
    temporary = SESSION.with_suffix(".json.tmp")
    descriptor = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(descriptor, "w") as output:
        os.fchmod(output.fileno(), 0o600)
        json.dump(session, output, indent=2, allow_nan=False)
        output.write("\n")
    temporary.replace(SESSION)


def sanitized(value):
    if isinstance(value, dict):
        return {
            key: sanitized(item)
            for key, item in value.items()
            if key.lower() not in SECRET_KEYS and not key.lower().endswith("_token")
        }
    if isinstance(value, list):
        return [sanitized(item) for item in value]
    return value


def write_artifact(path, value, session):
    serialized = json.dumps(sanitized(value), indent=2, ensure_ascii=False, allow_nan=False)
    credentials = [user["token"] for user in session["users"].values()]
    if any(credential and credential in serialized for credential in credentials):
        raise DemoError("Refusing to export an artifact containing a local credential")
    path.write_text(serialized + "\n")


def local_api(value):
    parsed = urlsplit(value)
    if (
        parsed.scheme != "http"
        or parsed.hostname not in {"localhost", "127.0.0.1", "::1"}
        or parsed.username
        or parsed.password
        or parsed.path not in {"", "/"}
        or parsed.query
        or parsed.fragment
    ):
        raise DemoError("--api must be an HTTP loopback origin for this local demo")
    return value.rstrip("/")


def require_model(client):
    capabilities = client.call("GET", "/capabilities")
    if capabilities.get("mode") != "model" or not capabilities.get("automated_assessment"):
        raise DemoError("The API must have a real model configured; fixture mode is not accepted")
    return capabilities


def create_session(api, data_dir):
    content = json.loads(CONTENT.read_text())
    question = Question.model_validate(content["question"]).model_dump(mode="json")
    rubric = RubricInput.model_validate(content["rubric"]).model_dump(mode="json")
    paths = {
        "questions": ROOT / "output/pdf/discrete-math-problem.pdf",
        "submission": ROOT / "output/pdf/discrete-math-student-response.pdf",
    }
    comparison_path = ROOT / "output/pdf/discrete-math-instructor-guide.pdf"
    comparison_pdf = comparison_path.read_bytes()
    pdfs = {kind: path.read_bytes() for kind, path in paths.items()}
    if not all(data.startswith(b"%PDF-") for data in (*pdfs.values(), comparison_pdf)):
        raise DemoError("Generate all three demonstration PDFs before running the demo")
    store = Store(data_dir)
    session = {
        "demo": DEMO,
        "api": api,
        "data_dir": str(data_dir),
        "created_at": datetime.now(UTC).isoformat(),
        "users": {},
        "input_files": {
            kind: {"filename": paths[kind].name, "sha256": hashlib.sha256(data).hexdigest()}
            for kind, data in pdfs.items()
        },
        "comparison_files": {
            "instructor_guide": {
                "filename": comparison_path.name,
                "sha256": hashlib.sha256(comparison_pdf).hexdigest(),
                "sent_to_model": False,
            }
        },
        "content_sha256": hashlib.sha256(CONTENT.read_bytes()).hexdigest(),
        "manual_expectation": {
            "score": content["manual_reference"]["score"],
            "max_points": content["manual_reference"]["max_points"],
            "criterion_scores": content["manual_reference"]["criterion_scores"],
            "source": "Authored instructor rubric; independent of the model result",
            "note": "The expected score is recorded for comparison, never forced on model output.",
        },
    }
    for name, role in ((INSTRUCTOR, "instructor"), (STUDENT, "student")):
        user, token = store.provision_user(name, role, lifetime_hours=72)
        session["users"][name] = {"id": user["id"], "role": role, "token": token}
    save_session(session)
    with ExitStack() as stack:
        instructor = Client(api, session["users"][INSTRUCTOR]["token"])
        student = Client(api, session["users"][STUDENT]["token"])
        stack.callback(instructor.http.close)
        stack.callback(student.http.close)
        require_model(instructor)
        course = instructor.call(
            "POST", "/courses", json={"name": "Discrete Mathematics (fictional demo)"}
        )
        session["course_id"] = course["id"]
        save_session(session)
        instructor.call(
            "POST",
            f"/courses/{course['id']}/members",
            json={"user_id": session["users"][STUDENT]["id"], "role": "student"},
        )
        assignment = instructor.call(
            "POST",
            f"/courses/{course['id']}/assignments",
            json={
                "title": content["assignment_title"],
                "questions": [question],
                "due_at": (datetime.now(UTC) + timedelta(days=7)).isoformat(),
            },
        )
        aid = session["assignment_id"] = assignment["id"]
        save_session(session)
        # The guide diagnoses this particular student's work and is a comparison
        # artifact only. Never upload it or manual_reference as a model input.
        instructor.call(
            "POST",
            f"/assignments/{aid}/documents",
            params={"kind": "questions"},
            files={"file": (paths["questions"].name, pdfs["questions"], "application/pdf")},
        )
        instructor.call("PUT", f"/assignments/{aid}/rubric-draft", json=rubric)
        published = instructor.call("POST", f"/assignments/{aid}/rubric-publish")
        session["rubric_id"] = published["id"]
        submission = student.call(
            "POST",
            f"/assignments/{aid}/documents",
            params={"kind": "submission"},
            files={"file": (paths["submission"].name, pdfs["submission"], "application/pdf")},
        )
        sid = session["submission_id"] = submission["id"]
        save_session(session)
        pages = list(range(1, submission["document"]["page_count"] + 1))
        student.call(
            "PUT", f"/submissions/{sid}/mapping", json={"questions": {question["id"]: pages}}
        )
        # Save submission_id first so --resume can recover job_id after an ambiguous response.
        job = student.call("POST", f"/submissions/{sid}/assessment-jobs")
        session["job_id"] = job["id"]
        save_session(session)
    return session


def export_run(session, output, capabilities, job, staff, student):
    assessment = staff.get("assessment")
    run = {
        "demo": DEMO,
        "fictional": True,
        "exported_at": datetime.now(UTC).isoformat(),
        "created_at": session["created_at"],
        "course_id": session["course_id"],
        "assignment_id": session["assignment_id"],
        "submission_id": session["submission_id"],
        "rubric_id": staff["rubric_id"],
        "job": job,
        "capabilities": capabilities,
        "input_files": session["input_files"],
        "comparison_files": session["comparison_files"],
        "content_sha256": session["content_sha256"],
        "model_input_scope": (
            "Question PDF, public assignment, rubric and student PDF only. The instructor "
            "guide and manual reference score/diagnosis were not sent to the model."
        ),
        "manual_expectation": session["manual_expectation"],
        "actual": None
        if assessment is None
        else {
            key: assessment[key]
            for key in (
                "score",
                "max_points",
                "status",
                "provider_id",
                "mode",
                "input_sha256",
                "assessed_at",
            )
        },
        "human_review": "Not handed in, reviewed, or released; automated feedback only.",
        "reproducibility": "Inputs and rubric are fixed; live model output may vary between runs.",
    }
    output.mkdir(parents=True, exist_ok=True)
    write_artifact(output / "staff-assessment.json", staff, session)
    write_artifact(output / "student-feedback.json", student, session)
    write_artifact(output / "run.json", run, session)


def finish_run(session, output):
    if session.get("demo") != DEMO or not session.get("submission_id"):
        raise DemoError("The saved session has no discrete math submission to resume")
    api = local_api(session["api"])
    with ExitStack() as stack:
        instructor = Client(api, session["users"][INSTRUCTOR]["token"])
        student = Client(api, session["users"][STUDENT]["token"])
        stack.callback(instructor.http.close)
        stack.callback(student.http.close)
        capabilities = require_model(instructor)
        sid = session["submission_id"]
        submission = student.call("GET", f"/submissions/{sid}")
        job_id = submission.get("job_id")
        if not job_id:
            raise DemoError("No assessment job was created; resume will not start a model call")
        if session.get("job_id") not in {None, job_id}:
            raise DemoError("Saved job does not match the submission; refusing to resume")
        session["job_id"] = job_id
        save_session(session)
        deadline = time.monotonic() + WAIT_SECONDS
        next_update = 0
        while True:
            job = student.call("GET", f"/jobs/{job_id}")
            if job["status"] in {"succeeded", "failed"} or time.monotonic() >= deadline:
                break
            if time.monotonic() >= next_update:
                print(f"Assessment {job['status']}; waiting for the existing job.", flush=True)
                next_update = time.monotonic() + 30
            time.sleep(2)
        staff = instructor.call("GET", f"/submissions/{sid}")
        student_view = student.call("GET", f"/submissions/{sid}")
        export_run(session, output, capabilities, job, staff, student_view)
        if job["status"] != "succeeded":
            if job["status"] == "failed":
                raise DemoError(
                    f"Assessment failed ({job['error_code']}); evidence exported. No retry started."
                )
            raise DemoError("Assessment still pending; evidence exported. Continue with --resume.")
        assessment = staff.get("assessment")
        if not assessment or assessment.get("mode") != "model":
            raise DemoError("A successful real-model assessment was not present")
        if assessment["input_sha256"] != session["input_files"]["submission"]["sha256"]:
            raise DemoError("Assessment input hash does not match the uploaded student PDF")
        print(
            f"Real model assessment succeeded: {assessment['score']}/{assessment['max_points']} "
            f"({assessment['status']}). Manual expectation: "
            f"{session['manual_expectation']['score']}/{session['manual_expectation']['max_points']}."
        )
        print(f"Published artifacts written to {output}")
        print("Local demo sign-in is ready at http://localhost:5173/session")


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--api", help="Local API origin (default: http://127.0.0.1:8026)")
    parser.add_argument("--data-dir", type=Path, default=ROOT / ".data/discrete-math")
    parser.add_argument("--output", type=Path, default=ROOT / "docs/demos/discrete-math")
    parser.add_argument("--resume", action="store_true", help="Read the existing job; never retry")
    args = parser.parse_args(argv)
    try:
        if args.resume:
            session = json.loads(SESSION.read_text())
            if args.api and local_api(args.api) != session.get("api"):
                raise DemoError("--api differs from the saved session API")
        else:
            api = local_api(args.api or "http://127.0.0.1:8026")
            session = create_session(api, args.data_dir.resolve())
        finish_run(session, args.output.resolve())
    except DemoError as exc:
        print(f"Demo stopped: {exc}", file=sys.stderr)
        return 1
    except Exception as exc:
        # Exception bodies may include private request data; expose only the class.
        print(
            f"Demo stopped ({type(exc).__name__}). Local session is retained; "
            "use --resume if an assessment was already started.",
            file=sys.stderr,
        )
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
