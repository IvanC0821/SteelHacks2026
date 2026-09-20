from copy import deepcopy

import pytest


def final_assessed(h):
    submission = h.attempt()
    h.assess(submission)
    h.call("POST", f"/submissions/{submission['id']}/hand-in", "student")
    return submission, f"/submissions/{submission['id']}/review/explanations/c1"


@pytest.mark.parametrize("role", ["ta", "instructor"])
def test_staff_correction_persists_without_changing_assessment_or_score(h, role):
    submission, path = final_assessed(h)
    before = deepcopy(h.sub(submission, role))
    body = {"expected_revision": 0, "text": "  Private explanation checked by staff.  "}
    review = h.call("PUT", path, role, json=body)
    assert review["revision"] == 1
    edit = review["criterion_explanations"]["c1"]
    assert edit["text"] == body["text"].strip()
    assert edit["edited_by"] == h.users[role]["id"]
    assert edit["edited_at"]
    after = h.sub(submission, role)
    assert after["review"] == review
    assert after["assessment"] == before["assessment"]
    assert after["rubric"] == before["rubric"]
    assert after["review"]["questions"] == before["review"]["questions"]
    assert after["review"]["status"] == before["review"]["status"]
    assert "criterion_explanations" not in str(h.sub(submission))
    audit = h.call("GET", f"/assignments/{h.aid}/audit")
    assert any(e["action"] == "review.explanation_saved" for e in audit)
    # A score save retains the separately stored explanation.
    h.call(
        "PUT",
        f"/submissions/{submission['id']}/review",
        role,
        json={
            "expected_revision": 1,
            "questions": {"q1": {"score": 3, "reason": "Reviewed"}},
        },
    )
    assert h.sub(submission, role)["review"]["criterion_explanations"]["c1"] == edit


@pytest.mark.parametrize("role", ["student", "other", "outsider"])
def test_nonstaff_cannot_edit_explanations(h, role):
    submission, path = final_assessed(h)
    response = h.request("PUT", path, role, json={"expected_revision": 0, "text": "Override"})
    assert response.status_code in {403, 404}
    assert h.sub(submission, "ta")["review"]["revision"] == 0


def test_explanation_edits_share_review_lock_and_reopen_requirement(h):
    submission, path = final_assessed(h)
    body = {"expected_revision": 0, "text": "TA correction"}
    h.call("PUT", path, "ta", json=body)
    assert h.request("PUT", path, json=body).status_code == 409
    h.call("PUT", path, json={"expected_revision": 1, "text": "Instructor correction"})
    h.call(
        "PUT",
        f"/submissions/{submission['id']}/review",
        json={
            "expected_revision": 2,
            "questions": {"q1": {"score": 3, "reason": "Reviewed"}},
        },
    )
    h.call(
        "POST", f"/submissions/{submission['id']}/review/complete", json={"expected_revision": 3}
    )
    assert (
        h.request("PUT", path, "ta", json={"expected_revision": 4, "text": "Change"}).status_code
        == 409
    )
    h.call("POST", f"/submissions/{submission['id']}/review/release", json={"expected_revision": 4})
    assert (
        h.request("PUT", path, json={"expected_revision": 5, "text": "Change"}).status_code == 409
    )
    assert "Instructor correction" not in str(h.sub(submission))
    h.call(
        "POST",
        f"/submissions/{submission['id']}/review/reopen",
        json={
            "expected_revision": 5,
            "reason": "Clarify explanation",
        },
    )
    h.call("PUT", path, "ta", json={"expected_revision": 6, "text": "Revised explanation"})


def test_explanation_requires_final_assessment_known_criterion_and_valid_text(h):
    submission = h.attempt()
    path = f"/submissions/{submission['id']}/review/explanations/c1"
    body = {"expected_revision": 0, "text": "A reason"}
    assert h.request("PUT", path, "ta", json=body).status_code == 409
    h.call("POST", f"/submissions/{submission['id']}/hand-in", "student")
    assert h.request("PUT", path, "ta", json=body).status_code == 422
    h.assess(submission)
    for text in ("", "   ", "x" * 2001):
        assert h.request("PUT", path, "ta", json={**body, "text": text}).status_code == 422
    assert h.request("PUT", path.removesuffix("c1") + "unknown", "ta", json=body).status_code == 422
    assert h.sub(submission, "ta")["review"]["revision"] == 0
