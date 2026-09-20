import json
from copy import deepcopy

import pytest
from fastapi.testclient import TestClient
from verity.api import create_app

from .support import ASSIGNMENT, RUBRIC, make_pdf

RULE_TEXT = "Missing justification: deduct 1 point per step, capped at 3 points per question."
PDF = make_pdf([["Fictional grading sheet", RULE_TEXT, "Harmless detours receive no deduction."]])
DRAFT = {
    "rules": [
        {
            "description": "Missing justification; cap 3 points per question.",
            "penalty": "1 point per step, capped at 3 points per question",
            "source_page": 1,
            "source_quote": RULE_TEXT,
        }
    ],
    "notes": "Harmless detours receive no deduction.",
}


def create(h, draft=None, pdf=PDF, role="instructor", request_id="test-create", name="New course"):
    return h.request(
        "POST",
        "/courses/from-pdf",
        role=role,
        data={"name": name, "deductions": json.dumps(draft or DRAFT), "request_id": request_id},
        files={"file": ("rubric.pdf", pdf, "application/pdf")} if pdf is not None else None,
    )


def test_extract_is_grounded_and_does_not_create_course_or_save_pdf(h, monkeypatch):
    seen = []
    provider = h.app.state.service.provider
    monkeypatch.setattr(
        provider,
        "draft_course_deductions",
        lambda context: seen.append(context) or DRAFT,
        raising=False,
    )
    before = h.call("GET", "/courses")
    response = h.call(
        "POST", "/course-deduction-drafts", files={"file": ("rubric.pdf", PDF, "application/pdf")}
    )
    assert response["draft"] == DRAFT
    assert "\n".join(block["text"] for block in seen[0]["document"]["blocks"]).count(RULE_TEXT) == 1
    assert h.call("GET", "/courses") == before
    assert not list((h.app.state.store.root / "files").glob("cdoc_*.pdf"))


def test_source_quotes_can_span_multiple_measured_lines_on_the_same_page(h, monkeypatch):
    draft = deepcopy(DRAFT)
    draft["rules"][0]["source_quote"] = RULE_TEXT + "\nHarmless detours receive no deduction."
    monkeypatch.setattr(
        h.app.state.service.provider, "draft_course_deductions", lambda _: draft, raising=False
    )
    response = h.call("POST", "/course-deduction-drafts", files={"file": ("r.pdf", PDF)})
    assert response["draft"] == draft


@pytest.mark.parametrize(
    "field,value", [("source_quote", "invented quote"), ("source_page", 2), ("penalty", "8 points")]
)
def test_rejects_ungrounded_model_rules(h, monkeypatch, field, value):
    draft = deepcopy(DRAFT)
    draft["rules"][0][field] = value
    monkeypatch.setattr(
        h.app.state.service.provider, "draft_course_deductions", lambda _: draft, raising=False
    )
    response = h.request("POST", "/course-deduction-drafts", files={"file": ("r.pdf", PDF)})
    assert response.status_code == 502
    assert response.json()["detail"]["code"] == "course_autofill_failed"
    assert value not in response.text if isinstance(value, str) else True


@pytest.mark.parametrize("role", ["student", "ta"])
def test_course_creation_and_extraction_require_instructor(h, role):
    assert create(h, role=role).status_code == 403
    assert (
        h.request(
            "POST", "/course-deduction-drafts", role=role, files={"file": ("r.pdf", PDF)}
        ).status_code
        == 403
    )


def test_invalid_scanned_and_unavailable_provider(h):
    assert create(h, pdf=b"not a PDF").status_code == 422
    assert (
        h.request(
            "POST", "/course-deduction-drafts", files={"file": ("r.pdf", make_pdf([[]]))}
        ).status_code
        == 422
    )
    assert (
        h.request("POST", "/course-deduction-drafts", files={"file": ("r.pdf", PDF)}).status_code
        == 503
    )
    assert create(h, name="  ").status_code == 422


def test_reviewed_course_persists_and_private_data_stays_staff_only(h):
    response = create(h)
    assert response.status_code == 201, response.text
    cid = response.json()["id"]
    for role in ("student", "ta"):
        h.call(
            "POST", f"/courses/{cid}/members", json={"user_id": h.users[role]["id"], "role": role}
        )
    assert h.call("GET", f"/courses/{cid}")["deductions"] == DRAFT
    assert h.call("GET", f"/courses/{cid}", role="ta")["deductions"] == DRAFT
    for path in (f"/courses/{cid}", "/courses"):
        public = h.call("GET", path, role="student")
        assert "deductions" not in json.dumps(public)
        assert RULE_TEXT not in json.dumps(public)
    assert h.request("GET", f"/courses/{cid}/deductions-pdf", role="student").status_code == 403
    assert h.request("GET", f"/courses/{cid}", role="outsider").status_code == 403
    downloaded = h.request("GET", f"/courses/{cid}/deductions-pdf", role="ta")
    assert downloaded.content == PDF
    # A new app instance on the same store keeps courses, membership and files.
    with TestClient(create_app(h.app.state.store.root)) as restarted:
        detail = restarted.get(f"/api/courses/{cid}", headers=h.headers["instructor"])
        assert detail.json()["deductions"] == DRAFT
        assert (
            restarted.get(
                f"/api/courses/{cid}/deductions-pdf", headers=h.headers["instructor"]
            ).content
            == PDF
        )


def test_retry_creates_only_one_course_and_detects_changed_body(h):
    first = create(h).json()
    assert create(h).json() == first
    assert (
        len([course for course in h.call("GET", "/courses") if course["name"] == "New course"]) == 1
    )
    assert create(h, name="Different name").status_code == 409
    assert len(list((h.app.state.store.root / "files").glob("cdoc_*.pdf"))) == 1


def test_manual_rules_and_missing_penalties_remain_unspecified(h):
    draft = {
        "rules": [
            {
                "description": "Explain the key implication.",
                "penalty": None,
                "source_page": None,
                "source_quote": "",
            }
        ],
        "notes": "Confirm the penalty later.",
    }
    response = create(h, draft=draft, pdf=None)
    assert response.status_code == 201
    detail = h.call("GET", f"/courses/{response.json()['id']}")
    assert detail["deductions"] == draft
    assert detail["deductions_document"] is None


def test_course_rules_are_in_rubric_context_and_pinned_at_publication(h):
    cid = create(h).json()["id"]
    assignment = h.call("POST", f"/courses/{cid}/assignments", json=ASSIGNMENT)
    aid = assignment["id"]
    service, store = h.app.state.service, h.app.state.store
    with store.connection() as db:
        assert (
            service.provider_context(db, {"assignment_id": aid, "kind": "rubric"})[
                "course_deductions"
            ]
            == DRAFT
        )
    h.call("PUT", f"/assignments/{aid}/rubric-draft", json=RUBRIC)
    rubric = h.call("POST", f"/assignments/{aid}/rubric-publish")
    assert rubric["course_deductions"] == DRAFT
    with store.transaction() as db:
        course = store.get(db, "course", cid)
        course["deductions"] = {"rules": [], "notes": "Later changes"}
        store.put(db, "course", course)
    assert h.call("GET", f"/assignments/{aid}")["rubrics"][-1]["course_deductions"] == DRAFT
