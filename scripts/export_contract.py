"""Export API schema and actual fictional response shapes; never export bearer tokens."""

import json
from pathlib import Path
from tempfile import TemporaryDirectory

from fastapi.testclient import TestClient
from verity.api import create_app

from scripts.demo_data import DemoProvider, demo_pdfs
from scripts.seed_demo import seed


def main():
    with TemporaryDirectory(prefix="verity-contract-") as tmp:
        data = seed(Path(tmp))
        app = create_app(tmp, DemoProvider())
        Path("docs/openapi.json").write_text(json.dumps(app.openapi(), indent=2) + "\n")
        with TestClient(app) as client:
            headers = {
                role: {"Authorization": f"Bearer {info['token']}"}
                for role, info in data["identities"].items()
            }

            def call(method, path, role="student", **kwargs):
                r = client.request(method, "/api" + path, headers=headers[role], **kwargs)
                r.raise_for_status()
                return r.json()

            aid = data["assignment_id"]
            s = call(
                "POST",
                f"/assignments/{aid}/documents?kind=submission",
                files={"file": ("attempt-1.pdf", demo_pdfs()["attempt-1.pdf"], "application/pdf")},
            )
            call("PUT", f"/submissions/{s['id']}/mapping", json={"questions": {"q1": [1]}})
            j = call("POST", f"/submissions/{s['id']}/assessment-jobs")
            examples = {
                "notice": "Actual API responses from fresh fictional fixture inputs. No model inference.",
                "capabilities": call("GET", "/capabilities"),
                "student_assignment": call("GET", f"/assignments/{aid}"),
                "staff_assignment": call("GET", f"/assignments/{aid}", "instructor"),
                "student_submission": call("GET", f"/submissions/{s['id']}"),
                "staff_submission": call("GET", f"/submissions/{s['id']}", "ta"),
                "completed_job": call("GET", f"/jobs/{j['id']}"),
                "analytics": call("GET", f"/assignments/{aid}/analytics", "ta"),
            }
            Path("docs/examples.json").write_text(json.dumps(examples, indent=2) + "\n")
    print("Exported docs/openapi.json and docs/examples.json (no tokens).")


if __name__ == "__main__":
    main()
