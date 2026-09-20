from copy import deepcopy
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from verity.api import create_app
from verity.provider import UnconfiguredProvider

from .conftest import Harness
from .support import ASSIGNMENT, RUBRIC, StubProvider, make_pdf, pdf_inputs


def test_auth_and_cross_user_course_access(h):
    s = h.attempt()
    job = h.assess(s)
    for path in (
        f"/submissions/{s['id']}",
        f"/documents/{s['document_id']}",
        f"/documents/{s['document_id']}/file",
        f"/jobs/{job['id']}",
    ):
        assert h.request("GET", path, "other").status_code == 403
        assert h.request("GET", path, "outsider").status_code == 403
        assert h.client.get("/api" + path).status_code == 401
    for path in (
        f"/assignments/{h.aid}/analytics",
        f"/assignments/{h.aid}/audit",
        f"/courses/{h.course['id']}/members",
    ):
        assert h.request("GET", path, "student").status_code == 403
    assert h.request("POST", "/courses", "student", json={"name": "No"}).status_code == 403
    assert (
        h.request("PUT", f"/assignments/{h.aid}/rubric-draft", "student", json=RUBRIC).status_code
        == 403
    )
    assert h.request("POST", f"/submissions/{s['id']}/hand-in", "ta").status_code == 403


def test_pdf_bytes_and_invalid_file(h):
    s = h.attempt()
    r = h.request("GET", f"/documents/{s['document_id']}/file", "student")
    assert r.content == pdf_inputs()["attempt-1.pdf"]
    assert r.headers["cache-control"] == "no-store"
    for content in (b"not a PDF", b"%PDF-1.4\ninvalid"):
        r = h.request(
            "POST",
            f"/assignments/{h.aid}/documents?kind=submission",
            "student",
            files={"file": ("x.pdf", content, "application/pdf")},
        )
        assert r.status_code == 422


def test_unpublished_assignment_is_private(h):
    a = h.call("POST", f"/courses/{h.course['id']}/assignments", json=ASSIGNMENT)
    assert h.request("GET", f"/assignments/{a['id']}", "student").status_code == 404
    assert a["id"] not in str(h.call("GET", f"/courses/{h.course['id']}/assignments", "student"))


@pytest.mark.parametrize("change", ["duplicate", "missing", "points", "unknown"])
def test_rubric_validation(h, change):
    rubric = deepcopy(RUBRIC)
    if change == "duplicate":
        rubric["criteria"][1]["id"] = "c1"
    elif change == "missing":
        rubric["criteria"] = []
    elif change == "points":
        rubric["criteria"][0]["points"] = 20
    else:
        rubric["criteria"][0]["question_id"] = "q2"
    assert h.request("PUT", f"/assignments/{h.aid}/rubric-draft", json=rubric).status_code == 422


@pytest.mark.parametrize("bad", ["unknown", "duplicate", "evidence", "exception", "blank"])
def test_provider_output_rejected_without_leaking(h, bad):
    class BadProvider(StubProvider):
        def assess(self, context):
            if bad == "exception":
                raise RuntimeError("SECRET_API_KEY PRIVATE_SOLUTION")
            response = super().assess(context)
            if bad == "unknown":
                response["decisions"][0]["criterion_id"] = "made-up"
            elif bad == "duplicate":
                response["decisions"][0] = response["decisions"][1]
            elif bad == "evidence":
                response["decisions"][0]["evidence_ids"] = ["not-a-block"]
            else:
                for d in response["decisions"]:
                    d["outcome"] = "met"
            return response

    h.app.state.service.provider = BadProvider()
    s = h.attempt("unreadable.pdf" if bad == "blank" else "attempt-1.pdf")
    job = h.assess(s)
    assert job["status"] == "failed"
    assert "SECRET" not in str(job)
    assert "PRIVATE" not in str(job)
    assert h.sub(s)["assessment"] is None


def test_no_model_jobs_retry_and_manual_fallback(h):
    h.app.state.service.provider = UnconfiguredProvider()
    s = h.attempt()
    job = h.assess(s)
    assert job["error_code"] == "not_configured"
    duplicate = h.call("POST", f"/submissions/{s['id']}/assessment-jobs", "student")
    assert duplicate["id"] == job["id"] and duplicate["attempts"] == 1
    h.app.state.service.provider = StubProvider()
    h.call("POST", f"/jobs/{job['id']}/retry", "student")
    assert h.call("GET", f"/jobs/{job['id']}", "student")["attempts"] == 2
    assert h.sub(s)["assessment"]["score"] == 2
    assert h.request("POST", f"/jobs/{job['id']}/retry", "student").status_code == 409


def test_restart_persistence_and_interrupted_jobs(tmp_path):
    h = Harness(tmp_path, run_jobs=False).setup()
    s = h.attempt()
    queued = h.assess(s)
    assert queued["status"] == "queued"
    app = create_app(tmp_path, StubProvider())
    with TestClient(app) as restarted:
        job = restarted.get(f"/api/jobs/{queued['id']}", headers=h.headers["student"]).json()
        assert job["status"] == "failed" and job["error_code"] == "interrupted"
        result = restarted.get(f"/api/submissions/{s['id']}", headers=h.headers["student"]).json()
        assert result["mapping"] == {"q1": [1]}
        assert restarted.post(
            f"/api/jobs/{queued['id']}/retry", headers=h.headers["student"]
        ).is_success


def test_deadline_prevents_changes_but_allows_staff_review(tmp_path):
    assignment = deepcopy(ASSIGNMENT)
    assignment["due_at"] = (datetime.now(UTC) - timedelta(hours=1)).isoformat()
    h = Harness(tmp_path).setup(assignment)
    assert (
        h.request(
            "POST",
            f"/assignments/{h.aid}/documents?kind=submission",
            "student",
            files={"file": ("x.pdf", pdf_inputs()["attempt-1.pdf"], "application/pdf")},
        ).status_code
        == 409
    )


def test_many_to_many_mapping(tmp_path):
    h = Harness(tmp_path)
    course = h.call("POST", "/courses", json={"name": "Multi question"})
    h.call(
        "POST",
        f"/courses/{course['id']}/members",
        json={"user_id": h.users["student"]["id"], "role": "student"},
    )
    assignment = deepcopy(ASSIGNMENT)
    assignment["questions"].append({**assignment["questions"][0], "id": "q2"})
    a = h.call("POST", f"/courses/{course['id']}/assignments", json=assignment)
    h.aid = a["id"]
    rubric = deepcopy(RUBRIC)
    rubric["criteria"] += [
        {**c, "id": c["id"] + "2", "question_id": "q2"} for c in RUBRIC["criteria"]
    ]
    h.call("PUT", f"/assignments/{h.aid}/rubric-draft", json=rubric)
    h.call("POST", f"/assignments/{h.aid}/rubric-publish")
    s = h.upload(content=make_pdf([["q1 starts"], ["q1 ends and q2 starts"]]))
    mapped = h.call(
        "PUT",
        f"/submissions/{s['id']}/mapping",
        "student",
        json={"questions": {"q1": [1, 2], "q2": [2]}},
    )
    assert mapped["mapping"] == {"q1": [1, 2], "q2": [2]}


def test_staff_transcription_is_validated_and_frozen(h):
    s = h.upload("unreadable.pdf")
    did = s["document_id"]
    body = {"blocks": [{"id": "manual1", "page": 1, "text": "Transcribed work", "bbox": None}]}
    assert h.request("PUT", f"/documents/{did}/transcript", "student", json=body).status_code == 403
    assert (
        h.call("PUT", f"/documents/{did}/transcript", "ta", json=body)["extraction"]
        == "staff_transcript"
    )
    bad = deepcopy(body)
    bad["blocks"][0]["bbox"] = [0.8, 0.2, 0.1, 0.4]
    assert h.request("PUT", f"/documents/{did}/transcript", "ta", json=bad).status_code == 422
    h.call("PUT", f"/submissions/{s['id']}/mapping", "student", json={"questions": {"q1": [1]}})
    h.assess(s)
    assert h.request("PUT", f"/documents/{did}/transcript", "ta", json=body).status_code == 409


def test_rubric_job_does_not_publish(h):
    job = h.call("POST", f"/assignments/{h.aid}/rubric-jobs")
    assert h.call("GET", f"/jobs/{job['id']}")["status"] == "succeeded"
    assignment = h.call("GET", f"/assignments/{h.aid}")
    assert len(assignment["rubrics"]) == 1
    assert assignment["rubric_draft"] == RUBRIC
    assert h.request("GET", f"/jobs/{job['id']}", "student").status_code == 403


def test_latest_missing_assessment_is_not_counted_as_improvement(h):
    s = h.attempt()
    h.assess(s)
    h.attempt("attempt-2.pdf")
    stats = h.call("GET", f"/assignments/{h.aid}/analytics")["questions"][0]
    assert stats["first"]["scored_students"] == 1
    assert stats["latest"]["mean_score"] is None
    assert stats["latest"]["scored_students"] == 0
    assert stats["latest"]["assessed_students"] == 0
    assert stats["latest"]["flagged_students"] == 0
    assert stats["latest"]["assessment_modes"] == []


def test_ta_can_edit_draft_but_cannot_publish_or_change_historical_rubrics(h):
    before = h.attempt()
    changed = deepcopy(RUBRIC)
    changed["criteria"][0]["description"] = "TA reviewed criterion"
    changed["instructor_notes"] = "TA draft notes"
    saved = h.call("PUT", f"/assignments/{h.aid}/rubric-draft", "ta", json=changed)
    assert saved["draft"] == changed
    detail = h.call("GET", f"/assignments/{h.aid}", "ta")
    assert detail["rubric_draft"] == changed
    assert detail["rubrics"][0]["criteria"] == RUBRIC["criteria"]
    assert h.sub(before)["rubric_id"] == h.rubric["id"]
    assert h.request("POST", f"/assignments/{h.aid}/rubric-publish", "ta").status_code == 403
    for role in ("student", "other", "outsider"):
        assert (
            h.request("PUT", f"/assignments/{h.aid}/rubric-draft", role, json=changed).status_code
            == 403
        )
        assert h.request("POST", f"/assignments/{h.aid}/rubric-jobs", role).status_code == 403
    invalid = deepcopy(changed)
    invalid["criteria"][0]["points"] = 100
    assert (
        h.request("PUT", f"/assignments/{h.aid}/rubric-draft", "ta", json=invalid).status_code
        == 422
    )
    assert h.call("GET", f"/assignments/{h.aid}")["rubric_draft"] == changed
    published = h.call("POST", f"/assignments/{h.aid}/rubric-publish")
    assert published["version"] == 2
    assert published["criteria"] == changed["criteria"]


def test_ta_can_generate_poll_and_retry_rubric_drafts(h):
    h.app.state.service.provider = UnconfiguredProvider()
    job = h.call("POST", f"/assignments/{h.aid}/rubric-jobs", "ta")
    failed = h.call("GET", f"/jobs/{job['id']}", "ta")
    assert failed["status"] == "failed"
    for role in ("student", "outsider"):
        assert h.request("GET", f"/jobs/{job['id']}", role).status_code == 403
        assert h.request("POST", f"/jobs/{job['id']}/retry", role).status_code == 403
    h.app.state.service.provider = StubProvider()
    h.call("POST", f"/jobs/{job['id']}/retry", "ta")
    result = h.call("GET", f"/jobs/{job['id']}", "ta")
    assert result["status"] == "succeeded"
    assert result["attempts"] == 2
    assert len(h.call("GET", f"/assignments/{h.aid}")["rubrics"]) == 1


def test_flagged_student_counts_deduplicate_categories_and_include_uncertainty(h):
    class MultipleFlags(StubProvider):
        def assess(self, context):
            result = super().assess(context)
            for decision in result["decisions"]:
                decision["outcome"] = "not_met"
            return result

    h.app.state.service.provider = MultipleFlags()
    first = h.attempt()
    h.assess(first)
    h.app.state.service.provider = StubProvider()
    unclear = h.attempt("unreadable.pdf", "other")
    h.assess(unclear, "other")
    stats = h.call("GET", f"/assignments/{h.aid}/analytics", "ta")["questions"][0]["latest"]
    assert stats["assessed_students"] == 2
    assert stats["flagged_students"] == 2  # several flags on one paper still count once
    assert stats["scored_students"] == 1
    assert stats["students_by_category"]["arithmetic"] == 1
    assert stats["students_by_category"]["justification"] == 1
    assert stats["assessment_modes"] == ["fixture"]
    revised = h.attempt("attempt-2.pdf")
    h.assess(revised)
    latest = h.call("GET", f"/assignments/{h.aid}/analytics", "ta")["questions"][0]["latest"]
    assert latest["assessed_students"] == 2
    assert latest["flagged_students"] == 1  # the earlier flags are not carried forward


def test_validation_error_omits_input_content(h):
    response = h.request("PUT", f"/assignments/{h.aid}/rubric-draft", json={"secret": "PRIVATE"})
    assert response.status_code == 422
    assert "PRIVATE" not in response.text
