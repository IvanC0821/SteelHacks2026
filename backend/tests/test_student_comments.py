import pytest


def final_paper(h):
    submission = h.attempt()
    h.call("POST", f"/submissions/{submission['id']}/hand-in", "student")
    return submission, f"/submissions/{submission['id']}/review/comments/q1"


@pytest.mark.parametrize("role", ["ta", "instructor"])
def test_comment_is_shared_immediately_and_survives_other_review_changes(h, role):
    submission, path = final_paper(h)
    before = h.sub(submission, role)
    text = "Revisit the sign change between your first two rows."
    review = h.call("PUT", path, role, json={"expected_revision": 0, "text": text})
    assert review["status"] == "not_started"
    assert review["questions"] == before["review"]["questions"]
    student = h.sub(submission)
    assert student["review"]["comments"]["q1"]["text"] == text
    assert student["review"]["comments"]["q1"]["author_name"] == h.users[role]["name"]
    assert "score" not in student["review"]
    assert "edited_by" not in str(student["review"])
    assert student["assessment"] == before["assessment"]

    base = f"/submissions/{submission['id']}/review"
    h.call(
        "PUT",
        base,
        json={
            "expected_revision": 1,
            "questions": {"q1": {"score": 3, "reason": "PRIVATE grading note"}},
        },
    )
    h.call("POST", base + "/complete", json={"expected_revision": 2})
    h.call("POST", base + "/release", json={"expected_revision": 3})
    h.call("PUT", path, role, json={"expected_revision": 4, "text": "Updated next step"})
    student = h.sub(submission)
    assert student["review"]["score"] == 3
    assert student["review"]["status"] == "released"
    assert student["review"]["comments"]["q1"]["text"] == "Updated next step"
    assert "PRIVATE" not in str(student)
    h.call("PUT", path, role, json={"expected_revision": 5, "text": "  "})
    assert not h.sub(submission)["review"].get("comments")
    assert h.sub(submission)["review"]["score"] == 3


@pytest.mark.parametrize("role", ["student", "other", "outsider"])
def test_nonstaff_cannot_write_student_comments(h, role):
    submission, path = final_paper(h)
    assert h.request(
        "PUT", path, role, json={"expected_revision": 0, "text": "Unauthorized"}
    ).status_code in {403, 404}
    assert h.sub(submission, "ta")["review"]["revision"] == 0


def test_comments_validate_question_revision_and_length_and_require_hand_in(h):
    submission = h.attempt()
    path = f"/submissions/{submission['id']}/review/comments/q1"
    body = {"expected_revision": 0, "text": "Look again"}
    assert h.request("PUT", path, "ta", json=body).status_code == 409
    h.call("POST", f"/submissions/{submission['id']}/hand-in", "student")
    assert h.request("PUT", path.replace("/q1", "/missing"), "ta", json=body).status_code == 422
    assert h.request("PUT", path, "ta", json={**body, "text": "x" * 4001}).status_code == 422
    h.call("PUT", path, "ta", json=body)
    assert h.request("PUT", path, json=body).status_code == 409
    assert h.sub(submission)["review"]["comments"]["q1"]["text"] == "Look again"
    assert h.request("GET", f"/submissions/{submission['id']}", "other").status_code == 403
    audit = h.call("GET", f"/assignments/{h.aid}/audit")
    assert any(entry["action"] == "review.student_comment_saved" for entry in audit)
