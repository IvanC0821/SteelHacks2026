from copy import deepcopy

import pytest
from fastapi.testclient import TestClient
from verity.api import create_app

from scripts.demo_data import ASSIGNMENT, RUBRIC, DemoProvider, demo_pdfs


class Harness:
    def __init__(self, root, provider=None, run_jobs=True):
        self.app = create_app(root, provider or DemoProvider(), run_jobs=run_jobs)
        self.client = TestClient(self.app)
        self.users = {}
        self.headers = {}
        for name, role in (
            ("instructor", "instructor"),
            ("ta", "ta"),
            ("student", "student"),
            ("other", "student"),
            ("outsider", "instructor"),
        ):
            user, token = self.app.state.store.provision_user(name, role)
            self.users[name] = user
            self.headers[name] = {"Authorization": f"Bearer {token}"}

    def request(self, method, path, role="instructor", **kwargs):
        return self.client.request(method, "/api" + path, headers=self.headers[role], **kwargs)

    def call(self, method, path, role="instructor", **kwargs):
        response = self.request(method, path, role, **kwargs)
        assert response.is_success, response.text
        return response.json()

    def setup(self, assignment=None):
        self.course = self.call("POST", "/courses", json={"name": "Fictional Linear Algebra"})
        for name in ("student", "other", "ta"):
            self.call(
                "POST",
                f"/courses/{self.course['id']}/members",
                json={
                    "user_id": self.users[name]["id"],
                    "role": "ta" if name == "ta" else "student",
                },
            )
        self.assignment = self.call(
            "POST",
            f"/courses/{self.course['id']}/assignments",
            json=assignment or deepcopy(ASSIGNMENT),
        )
        self.aid = self.assignment["id"]
        self.call("PUT", f"/assignments/{self.aid}/rubric-draft", json=deepcopy(RUBRIC))
        self.rubric = self.call("POST", f"/assignments/{self.aid}/rubric-publish")
        return self

    def upload(self, filename="attempt-1.pdf", role="student", content=None, kind="submission"):
        return self.call(
            "POST",
            f"/assignments/{self.aid}/documents?kind={kind}",
            role,
            files={
                "file": (
                    filename,
                    content if content is not None else demo_pdfs()[filename],
                    "application/pdf",
                )
            },
        )

    def attempt(self, filename="attempt-1.pdf", role="student"):
        s = self.upload(filename, role)
        return self.call(
            "PUT", f"/submissions/{s['id']}/mapping", role, json={"questions": {"q1": [1]}}
        )

    def assess(self, s, role="student"):
        j = self.call("POST", f"/submissions/{s['id']}/assessment-jobs", role)
        return self.call("GET", f"/jobs/{j['id']}", role)

    def sub(self, s, role="student"):
        return self.call("GET", f"/submissions/{s['id']}", role)


@pytest.fixture
def h(tmp_path):
    harness = Harness(tmp_path)
    with harness.client:
        yield harness.setup()
