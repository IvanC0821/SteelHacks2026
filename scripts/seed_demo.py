"""Create local identities and an unsubmitted fictional assignment for frontend work."""

import argparse
import json
from pathlib import Path

from fastapi.testclient import TestClient
from verity.api import create_app

from scripts.demo_data import ASSIGNMENT, RUBRIC, DemoProvider, demo_pdfs


def seed(root: Path):
    root.mkdir(parents=True, exist_ok=True)
    credentials = root / "demo-credentials.json"
    if credentials.exists():
        raise SystemExit(
            f"Demo already seeded: {credentials}. Use a new data directory for a fresh demo."
        )
    app = create_app(root, DemoProvider())
    identities = {}
    for role, name in (
        ("instructor", "Instructor (fictional)"),
        ("ta", "TA (fictional)"),
        ("student", "Morgan (fictional)"),
        ("second_student", "Riley (fictional)"),
    ):
        user, token = app.state.store.provision_user(
            name, "student" if role == "second_student" else role
        )
        identities[role] = {"user": user, "token": token}
    with TestClient(app) as client:
        headers = {"Authorization": f"Bearer {identities['instructor']['token']}"}

        def call(method, path, **kwargs):
            result = client.request(method, "/api" + path, headers=headers, **kwargs)
            result.raise_for_status()
            return result.json()

        course = call("POST", "/courses", json={"name": "Fictional Linear Algebra"})
        for role, info in identities.items():
            if role != "instructor":
                call(
                    "POST",
                    f"/courses/{course['id']}/members",
                    json={
                        "user_id": info["user"]["id"],
                        "role": "ta" if role == "ta" else "student",
                    },
                )
        assignment = call("POST", f"/courses/{course['id']}/assignments", json=ASSIGNMENT)
        aid = assignment["id"]
        samples = Path("demo/pdfs")
        samples.mkdir(parents=True, exist_ok=True)
        for filename, content in demo_pdfs().items():
            (samples / filename).write_bytes(content)
        for filename, kind in (("questions.pdf", "questions"), ("solution.pdf", "solution")):
            call(
                "POST",
                f"/assignments/{aid}/documents?kind={kind}",
                files={"file": (filename, demo_pdfs()[filename], "application/pdf")},
            )
        call("PUT", f"/assignments/{aid}/rubric-draft", json=RUBRIC)
        call("POST", f"/assignments/{aid}/rubric-publish")
    payload = {"identities": identities, "course_id": course["id"], "assignment_id": aid}
    credentials.write_text(json.dumps(payload, indent=2) + "\n")
    credentials.chmod(0o600)
    print(f"Seeded fictional demo. Local credentials (24h): {credentials}")
    print("PDFs: demo/pdfs/. No submissions, model calls or training runs created.")
    return payload


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", type=Path, default=Path(".data"))
    seed(parser.parse_args().data_dir)
