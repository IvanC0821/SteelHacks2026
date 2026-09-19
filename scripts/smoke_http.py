"""Exercise an already-running seeded demo via real HTTP, with both student/staff identities.

Use a disposable demo data directory: this script creates and releases a final paper.
"""

import argparse
import json
import time
from pathlib import Path

import httpx

from scripts.demo_data import demo_pdfs


def run(base_url, credential_file):
    config = json.loads(Path(credential_file).read_text())
    aid = config["assignment_id"]
    with httpx.Client(base_url=base_url, timeout=20) as client:

        def call(method, path, role="student", **kwargs):
            token = config["identities"][role]["token"]
            r = client.request(
                method, "/api" + path, headers={"Authorization": f"Bearer {token}"}, **kwargs
            )
            r.raise_for_status()
            return r.json()

        def attempt(filename):
            s = call(
                "POST",
                f"/assignments/{aid}/documents?kind=submission",
                files={"file": (filename, demo_pdfs()[filename], "application/pdf")},
            )
            call("PUT", f"/submissions/{s['id']}/mapping", json={"questions": {"q1": [1]}})
            job = call("POST", f"/submissions/{s['id']}/assessment-jobs")
            deadline = time.monotonic() + 15
            while job["status"] in {"queued", "running"} and time.monotonic() < deadline:
                time.sleep(0.1)
                job = call("GET", f"/jobs/{job['id']}")
            assert job["status"] == "succeeded", job
            return call("GET", f"/submissions/{s['id']}")

        first = attempt("attempt-1.pdf")
        second = attempt("attempt-2.pdf")
        assert first["assessment"]["score"] == 2
        assert second["assessment"]["score"] == 4
        assert second["assessment"]["mode"] == "fixture"
        call("POST", f"/submissions/{second['id']}/hand-in")
        call(
            "PUT",
            f"/submissions/{second['id']}/review",
            "ta",
            json={
                "expected_revision": 0,
                "questions": {"q1": {"score": 4, "reason": "Fictional work manually checked"}},
            },
        )
        call(
            "POST",
            f"/submissions/{second['id']}/review/complete",
            "ta",
            json={"expected_revision": 1},
        )
        call(
            "POST",
            f"/submissions/{second['id']}/review/release",
            "instructor",
            json={"expected_revision": 2},
        )
        result = call("GET", f"/submissions/{second['id']}")
        assert result["review"]["score"] == 4 and "reason" not in str(result)
        stats = call("GET", f"/assignments/{aid}/analytics", "instructor")
        assert stats["final_submissions"] == stats["reviewed"] == 1
        print(
            json.dumps(
                {
                    "transport": "HTTP",
                    "first_estimate": 2,
                    "revised_estimate": 4,
                    "released_score": 4,
                    "mode": "fixture",
                    "status": "passed",
                },
                indent=2,
            )
        )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:8026")
    parser.add_argument("--credentials", default=".data/demo-credentials.json")
    args = parser.parse_args()
    run(args.base_url, args.credentials)
