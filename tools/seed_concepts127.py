"""Add the fictional course to the existing LOCAL demo; never invoke a model.

Run the PDF builder first, then: .venv/bin/python -m tools.seed_concepts127
Reuses the current demo roster and tokens. Does not reset accounts, submissions,
other courses, or frontend/.dev/session.json. Safe to rerun without duplicate data.
"""

import json
from pathlib import Path
from urllib.parse import urlparse

import httpx

from tools.concepts127_materials import COURSE_NAME, HOMEWORKS, assignment_payload, rubric_payload

ROOT = Path(__file__).resolve().parents[1]


def main():
    session = json.loads((ROOT / "frontend/.dev/session.json").read_text())
    base = session["api"].rstrip("/")
    if urlparse(base).hostname not in {"localhost", "127.0.0.1", "::1"}:
        raise ValueError("This seeder only modifies a local demo server.")
    identity = next(user for user in session["users"].values() if user["role"] == "instructor")
    materials = json.loads((ROOT / ".data/21-127-private/materials.json").read_text())
    for item in materials:
        for kind in ("questions", "reference"):
            if not Path(item[kind]).is_file():
                raise FileNotFoundError(item[kind])

    with httpx.Client(
        base_url=base + "/api/",
        timeout=30,
        headers={"Authorization": f"Bearer {identity['token']}"},
    ) as client:

        def call(method, path, **kwargs):
            response = client.request(method, path, **kwargs)
            if not response.is_success:
                # Never log request headers, app tokens, or the provider key.
                raise RuntimeError(
                    f"{method} {path}: HTTP {response.status_code}: {response.text[:300]}"
                )
            return response.json()

        source_id = session["course_id"]
        roster = call("GET", f"courses/{source_id}/members")
        courses = call("GET", "courses")
        matches = [course for course in courses if course["name"] == COURSE_NAME]
        if len(matches) > 1:
            raise ValueError("Multiple target courses exist; refusing to guess.")
        course = matches[0] if matches else call("POST", "courses", json={"name": COURSE_NAME})
        cid = course["id"]
        members = {member["id"]: member for member in call("GET", f"courses/{cid}/members")}
        for member in roster:
            if member["id"] in members:
                if members[member["id"]]["role"] != member["role"]:
                    raise ValueError("Existing role differs; refusing to overwrite it.")
                continue
            call(
                "POST",
                f"courses/{cid}/members",
                json={"user_id": member["id"], "role": member["role"]},
            )

        assignments = call("GET", f"courses/{cid}/assignments")
        saved = []
        for hw, files in zip(HOMEWORKS, materials, strict=True):
            assert files["slug"] == hw["slug"]
            payload = assignment_payload(hw)
            existing = [
                assignment for assignment in assignments if assignment["title"] == hw["title"]
            ]
            if len(existing) > 1:
                raise ValueError("Multiple assignments with this title; refusing to guess.")
            assignment = (
                existing[0]
                if existing
                else call("POST", f"courses/{cid}/assignments", json=payload)
            )
            if assignment["questions"] != payload["questions"]:
                raise ValueError("Existing assignment was edited; refusing to overwrite it.")
            aid = assignment["id"]
            detail = call("GET", f"assignments/{aid}")
            for kind, source in (("questions", "questions"), ("solution", "reference")):
                path = Path(files[source])
                existing_docs = [doc for doc in detail["documents"] if doc["kind"] == kind]
                if existing_docs:
                    if len(existing_docs) != 1 or existing_docs[0]["filename"] != path.name:
                        raise ValueError("Existing reference materials differ; not replacing them.")
                    continue
                call(
                    "POST",
                    f"assignments/{aid}/documents",
                    params={"kind": kind},
                    files={"file": (path.name, path.read_bytes(), "application/pdf")},
                )
            rubric = rubric_payload(hw)
            if detail["published_rubric_id"]:
                latest = detail["rubrics"][-1]
                if any(latest[key] != value for key, value in rubric.items()):
                    raise ValueError("Published rubric was edited; refusing to overwrite it.")
            else:
                if detail.get("rubric_draft") and detail["rubric_draft"] != rubric:
                    raise ValueError("An edited draft exists; refusing to overwrite it.")
                call("PUT", f"assignments/{aid}/rubric-draft", json=rubric)
                call("POST", f"assignments/{aid}/rubric-publish")
            detail = call("GET", f"assignments/{aid}")
            assert detail["published_rubric_id"]
            assert len(detail["questions"]) == 5
            assert len(detail["documents"]) == 2
            assert set(detail["rubrics"][-1]["reference_ids"]) == {
                doc["id"] for doc in detail["documents"]
            }
            saved.append(
                {
                    "id": aid,
                    "title": hw["title"],
                    "slug": hw["slug"],
                    "reference_id": next(
                        doc["id"] for doc in detail["documents"] if doc["kind"] == "solution"
                    ),
                }
            )

        # Confirm all demo students see the new course; private keys and rubric stay private.
        checked = 0
        for user in session["users"].values():
            if user["role"] != "student":
                continue
            with httpx.Client(
                base_url=base + "/api/",
                timeout=30,
                headers={"Authorization": f"Bearer {user['token']}"},
            ) as student:
                response = student.get(f"courses/{cid}/assignments")
                response.raise_for_status()
                assert {item["id"] for item in response.json()} >= {item["id"] for item in saved}
                for item in saved:
                    response = student.get(f"assignments/{item['id']}")
                    response.raise_for_status()
                    public = response.json()
                    assert {doc["kind"] for doc in public["documents"]} == {"questions"}
                    assert "rubrics" not in public and "rubric_draft" not in public
                    assert student.get(f"documents/{item['reference_id']}/file").status_code == 403
                checked += 1

        result = {
            "course_id": cid,
            "course_name": COURSE_NAME,
            "source_course_id": source_id,
            "enrolled": len(call("GET", f"courses/{cid}/members")),
            "students_verified": checked,
            "assignments": saved,
            "page_mapping": {f"q{i}": [i] for i in range(1, 6)},
            "model_calls": 0,
        }
        output = ROOT / ".data/concepts127-seed.json"
        output.write_text(json.dumps(result, indent=2) + "\n")
        output.chmod(0o600)
        print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
