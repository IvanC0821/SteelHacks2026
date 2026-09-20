"""Paid-call resume behavior and the demo's credential export boundary."""

import json
from copy import deepcopy

import pytest

from tools.discrete_math import run_demo


def test_public_artifacts_remove_credentials_and_reject_embedded_tokens(tmp_path):
    session = {"users": {"student": {"token": "private-demo-credential"}}}
    destination = tmp_path / "artifact.json"
    run_demo.write_artifact(
        destination,
        {"score": 4, "nested": [{"token": "private-demo-credential", "api_key": "secret"}]},
        session,
    )
    assert json.loads(destination.read_text()) == {"score": 4, "nested": [{}]}
    with pytest.raises(run_demo.DemoError, match="containing a local credential"):
        run_demo.write_artifact(
            destination, {"rationale": "contains private-demo-credential"}, session
        )
    assert "private-demo-credential" not in destination.read_text()


def test_resume_failed_job_never_mutates_api_or_retries(monkeypatch, tmp_path):
    requests = []
    session = {
        "demo": run_demo.DEMO,
        "api": "http://127.0.0.1:8026",
        "submission_id": "sub_demo",
        "users": {
            name: {"token": name + "-private"} for name in (run_demo.INSTRUCTOR, run_demo.STUDENT)
        },
    }
    submission = {"id": "sub_demo", "job_id": "job_existing", "assessment": None}
    responses = {
        "/capabilities": {"mode": "model", "automated_assessment": True},
        "/submissions/sub_demo": submission,
        "/jobs/job_existing": {
            "id": "job_existing",
            "status": "failed",
            "error_code": "provider_failed",
        },
    }

    class ReadOnlyClient:
        def __init__(self, api, token):
            self.http = self

        def close(self):
            pass

        def call(self, method, path, **kwargs):
            requests.append((method, path))
            assert method == "GET", "Resume must never start or retry a paid model call"
            return deepcopy(responses[path])

    exports = []
    monkeypatch.setattr(run_demo, "Client", ReadOnlyClient)
    monkeypatch.setattr(run_demo, "SESSION", tmp_path / "session.json")
    monkeypatch.setattr(run_demo, "export_run", lambda *args: exports.append(args))
    with pytest.raises(run_demo.DemoError, match="No retry started"):
        run_demo.finish_run(session, tmp_path / "output")
    assert session["job_id"] == "job_existing"
    assert json.loads(run_demo.SESSION.read_text())["job_id"] == "job_existing"
    assert len(exports) == 1
    assert all(method == "GET" for method, _ in requests)


def test_fixture_provider_cannot_be_used_as_real_demo():
    class FixtureClient:
        def call(self, method, path):
            return {"mode": "fixture", "automated_assessment": True}

    with pytest.raises(run_demo.DemoError, match="fixture mode is not accepted"):
        run_demo.require_model(FixtureClient())
