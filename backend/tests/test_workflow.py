from copy import deepcopy

from scripts.demo_data import RUBRIC, make_pdf


def test_complete_workflow_and_private_projections(h):
    reference = h.upload("solution.pdf", "instructor", kind="solution")
    first = h.attempt()
    assert h.assess(first)["status"] == "succeeded"
    first_result = h.sub(first)
    assert first_result["assessment"]["score"] == 2
    assert first_result["assessment"]["mode"] == "fixture"
    assert first_result["assessment"]["questions"][0]["flags"][0]["category"] == "justification"
    assert "rationale" not in str(first_result)
    assert "description" not in str(first_result)
    assert "decisions" not in str(first_result)
    assert "Correct x = 3" not in str(first_result)
    assert h.request("GET", f"/documents/{reference['id']}/file", "student").status_code == 403
    second = h.attempt("attempt-2.pdf")
    h.assess(second)
    assert h.sub(second)["assessment"]["score"] == 4
    final = h.call("POST", f"/submissions/{second['id']}/hand-in", "student")
    assert final["final"]
    assert h.request("POST", f"/submissions/{first['id']}/hand-in", "student").status_code == 409
    review = h.call(
        "PUT",
        f"/submissions/{second['id']}/review",
        "ta",
        json={
            "expected_revision": 0,
            "questions": {"q1": {"score": 4, "reason": "private staff reasoning"}},
        },
    )
    assert review["revision"] == 1
    h.call(
        "POST", f"/submissions/{second['id']}/review/complete", "ta", json={"expected_revision": 1}
    )
    assert "score" not in h.sub(second)["review"]
    h.call("POST", f"/submissions/{second['id']}/review/release", json={"expected_revision": 2})
    released = h.sub(second)
    assert released["review"]["score"] == 4
    assert "private staff reasoning" not in str(released)
    stats = h.call("GET", f"/assignments/{h.aid}/analytics")
    assert stats["students_with_attempts"] == stats["reviewed"] == stats["released"] == 1
    assert stats["questions"][0]["first"]["mean_score"] == 2
    assert stats["questions"][0]["latest"]["mean_score"] == 4
    assert stats["questions"][0]["first"]["students_by_category"] == {"justification": 1}
    assert len(h.call("GET", f"/assignments/{h.aid}/submissions", "student")) == 2
    assert len(h.call("GET", f"/assignments/{h.aid}/audit")) >= 10


def test_rubric_history_and_final_identity(h):
    first = h.attempt()
    h.assess(first)
    final = h.attempt("attempt-2.pdf")
    h.call("POST", f"/submissions/{final['id']}/hand-in", "student")
    practice = h.attempt("alternative.pdf")
    changed = deepcopy(RUBRIC)
    changed["instructor_notes"] = "New standards version"
    h.call("PUT", f"/assignments/{h.aid}/rubric-draft", json=changed)
    new = h.call("POST", f"/assignments/{h.aid}/rubric-publish")
    assert new["version"] == 2
    assert h.sub(first)["rubric_id"] == h.rubric["id"]
    assert h.sub(final)["final"] and not h.sub(practice)["final"]
    new_attempt = h.attempt()
    assert new_attempt["rubric_id"] == new["id"]
    queue = h.call("GET", f"/assignments/{h.aid}/submissions?final_only=true", "ta")
    assert [s["id"] for s in queue] == [final["id"]]
    assert queue[0]["rubric"]["id"] == h.rubric["id"]


def test_mapping_required_and_sealed_after_assessment(h):
    s = h.upload()
    for action in ("hand-in", "assessment-jobs"):
        assert h.request("POST", f"/submissions/{s['id']}/{action}", "student").status_code == 409
    for mapping in ({}, {"unknown": [1]}, {"q1": []}, {"q1": [0]}, {"q1": [2]}, {"q1": [1, 1]}):
        assert (
            h.request(
                "PUT", f"/submissions/{s['id']}/mapping", "student", json={"questions": mapping}
            ).status_code
            == 422
        )
    h.call("PUT", f"/submissions/{s['id']}/mapping", "student", json={"questions": {"q1": [1]}})
    h.assess(s)
    assert (
        h.request(
            "PUT", f"/submissions/{s['id']}/mapping", "student", json={"questions": {"q1": [1]}}
        ).status_code
        == 409
    )


def test_alternative_and_unreadable(h):
    alternative = h.attempt("alternative.pdf")
    assert h.assess(alternative)["status"] == "succeeded"
    assert h.sub(alternative)["assessment"]["score"] == 4
    unreadable = h.attempt("unreadable.pdf")
    assert h.assess(unreadable)["status"] == "succeeded"
    assessment = h.sub(unreadable)["assessment"]
    assert assessment["score"] is None and assessment["status"] == "needs_review"
    assert assessment["questions"][0]["flags"][0]["anchors"][0]["bbox"] is None


def test_custom_pdf_never_receives_canned_assessment(h):
    s = h.upload(content=make_pdf([["Different fictional work", "x = 99"]]))
    h.call("PUT", f"/submissions/{s['id']}/mapping", "student", json={"questions": {"q1": [1]}})
    assert h.assess(s)["status"] == "failed"
    assert h.sub(s)["assessment"] is None
    # Even without AI, hand-in and human review are available.
    assert h.call("POST", f"/submissions/{s['id']}/hand-in", "student")["final"]
    h.call(
        "PUT",
        f"/submissions/{s['id']}/review",
        "ta",
        json={
            "expected_revision": 0,
            "questions": {"q1": {"score": 0, "reason": "Manually checked"}},
        },
    )
    assert (
        h.call(
            "POST", f"/submissions/{s['id']}/review/complete", "ta", json={"expected_revision": 1}
        )["score"]
        == 0
    )


def test_stale_review_bounds_and_reopen(h):
    s = h.attempt()
    body = {"expected_revision": 0, "questions": {"q1": {"score": 2, "reason": "Checked"}}}
    assert h.request("PUT", f"/submissions/{s['id']}/review", "ta", json=body).status_code == 409
    h.call("POST", f"/submissions/{s['id']}/hand-in", "student")
    for score in (-1, 5):
        bad = deepcopy(body)
        bad["questions"]["q1"]["score"] = score
        assert h.request("PUT", f"/submissions/{s['id']}/review", "ta", json=bad).status_code == 422
    assert (
        h.request(
            "POST", f"/submissions/{s['id']}/review/complete", "ta", json={"expected_revision": 0}
        ).status_code
        == 409
    )
    h.call("PUT", f"/submissions/{s['id']}/review", "ta", json=body)
    assert h.request("PUT", f"/submissions/{s['id']}/review", "ta", json=body).status_code == 409
    h.call("POST", f"/submissions/{s['id']}/review/complete", "ta", json={"expected_revision": 1})
    assert (
        h.request(
            "POST", f"/submissions/{s['id']}/review/release", "ta", json={"expected_revision": 2}
        ).status_code
        == 403
    )
    h.call("POST", f"/submissions/{s['id']}/review/release", json={"expected_revision": 2})
    h.call(
        "POST",
        f"/submissions/{s['id']}/review/reopen",
        json={"expected_revision": 3, "reason": "Recheck requested"},
    )
    assert "score" not in h.sub(s)["review"]
    assert h.sub(s, "ta")["review"]["revision"] == 4


def test_help_report_does_not_change_grade_or_reveal_staff_notes(h):
    s = h.attempt()
    h.assess(s)
    report = h.call(
        "POST",
        f"/submissions/{s['id']}/reports",
        "student",
        json={"question_id": "q1", "kind": "help", "message": "Can we discuss this?"},
    )
    h.call(
        "PUT",
        f"/reports/{report['id']}",
        "ta",
        json={"status": "resolved", "staff_note": "Private solution details"},
    )
    student_reports = h.call("GET", f"/assignments/{h.aid}/reports", "student")
    assert student_reports[0]["status"] == "resolved"
    assert "staff_note" not in student_reports[0]
    assert h.sub(s)["assessment"]["score"] == 2
    assert h.call("GET", f"/assignments/{h.aid}/reports", "other") == []
