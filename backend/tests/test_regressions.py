from copy import deepcopy

from .conftest import Harness
from .support import RUBRIC, StubProvider


def test_private_identifiers_are_not_returned_in_student_feedback(h):
    rubric = deepcopy(RUBRIC)
    rubric["criteria"][2]["id"] = "secret_criterion_label"
    h.call("PUT", f"/assignments/{h.aid}/rubric-draft", json=rubric)
    h.call("POST", f"/assignments/{h.aid}/rubric-publish")
    s = h.upload()
    h.call(
        "PUT",
        f"/documents/{s['document_id']}/transcript",
        "ta",
        json={
            "blocks": [
                {"id": "secret_block_label", "page": 1, "text": "Student text", "bbox": None}
            ]
        },
    )
    h.call("PUT", f"/submissions/{s['id']}/mapping", "student", json={"questions": {"q1": [1]}})

    class Provider(StubProvider):
        def assess(self, context):
            return {
                "decisions": [
                    {
                        "criterion_id": c["id"],
                        "outcome": "not_met",
                        "evidence_ids": ["secret_block_label"],
                        "rationale": "secret teacher rationale",
                    }
                    for c in context["rubric"]["criteria"]
                ]
            }

    h.app.state.service.provider = Provider()
    assert h.assess(s)["status"] == "succeeded"
    assert "secret" not in str(h.sub(s))
    assert "secret" in str(h.sub(s, "ta"))


def test_reference_upload_invalidates_pending_rubric_generation(tmp_path):
    h = Harness(tmp_path, run_jobs=False).setup()
    job = h.call("POST", f"/assignments/{h.aid}/rubric-jobs")
    h.upload("reference.pdf", "instructor", kind="solution")
    h.app.state.service.run_job(job["id"])
    result = h.call("GET", f"/jobs/{job['id']}")
    assert result["status"] == "failed" and result["error_code"] == "invalid_result"
    assert h.request("POST", f"/jobs/{job['id']}/retry").status_code == 409


def test_manual_draft_edit_wins_over_pending_generation(tmp_path):
    h = Harness(tmp_path, run_jobs=False).setup()
    job = h.call("POST", f"/assignments/{h.aid}/rubric-jobs")
    rubric = deepcopy(RUBRIC)
    rubric["instructor_notes"] = "Staff edited this"
    h.call("PUT", f"/assignments/{h.aid}/rubric-draft", json=rubric)
    h.app.state.service.run_job(job["id"])
    assert h.call("GET", f"/jobs/{job['id']}")["status"] == "failed"
    assert (
        h.call("GET", f"/assignments/{h.aid}")["rubric_draft"]["instructor_notes"]
        == "Staff edited this"
    )


def test_pending_job_blocks_review_completion_and_duplicate_calls(tmp_path):
    h = Harness(tmp_path, run_jobs=False).setup()
    s = h.attempt()
    job = h.assess(s)
    duplicate = h.assess(s)
    assert duplicate["id"] == job["id"]
    h.call("POST", f"/submissions/{s['id']}/hand-in", "student")
    h.call(
        "PUT",
        f"/submissions/{s['id']}/review",
        "ta",
        json={"expected_revision": 0, "questions": {"q1": {"score": 2, "reason": "Checked"}}},
    )
    assert (
        h.request(
            "POST", f"/submissions/{s['id']}/review/complete", "ta", json={"expected_revision": 1}
        ).status_code
        == 409
    )
    h.app.state.service.run_job(job["id"])
    h.call("POST", f"/submissions/{s['id']}/review/complete", "ta", json={"expected_revision": 1})


def test_rubric_reference_version_and_job_context_are_frozen(tmp_path):
    h = Harness(tmp_path, run_jobs=False).setup()
    first = h.attempt()
    job = h.assess(first)
    h.upload("reference.pdf", "instructor", kind="solution")
    new_rubric = h.call("POST", f"/assignments/{h.aid}/rubric-publish")
    assert new_rubric["version"] == 2 and len(new_rubric["reference_ids"]) == 1
    with h.app.state.store.connection() as db:
        snapshot = h.app.state.store.get(db, "job", job["id"])["context"]
    assert snapshot["references"] == []
    assert snapshot["rubric"]["id"] == h.rubric["id"]
    h.app.state.service.run_job(job["id"])
    assert h.sub(first)["rubric_id"] == h.rubric["id"]


def test_expired_session_is_denied(h):
    with h.app.state.store.transaction() as db:
        db.execute(
            "UPDATE sessions SET expires_at='2000-01-01T00:00:00+00:00' WHERE user_id=?",
            (h.users["student"]["id"],),
        )
    assert h.request("GET", "/me", "student").status_code == 401
