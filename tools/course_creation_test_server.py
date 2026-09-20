"""Isolated UI-test server. No real demo records, credentials, or model calls."""

import json
import os
from pathlib import Path
from tempfile import TemporaryDirectory

import uvicorn
from verity.api import create_app

from backend.tests.support import make_pdf


class TestProvider:
    id = "isolated-course-ui-test"
    mode = "fixture"

    def draft_course_deductions(self, context):
        return {
            "rules": [
                {
                    "description": "Missing justification; maximum 3 points per question.",
                    "penalty": "1 point per step, capped at 3 points per question",
                    "source_page": 1,
                    "source_quote": "Missing justification: deduct 1 point per step, capped at 3 points per question.",
                }
            ],
            "notes": "Harmless detours receive no deduction.",
        }


def main():
    with TemporaryDirectory(prefix="verity-course-ui-") as folder:
        root = Path(folder)
        app = create_app(root, TestProvider(), run_jobs=False)
        _, token = app.state.store.provision_user("UI Test Instructor", "instructor")
        pdf = make_pdf(
            [
                [
                    "Fictional grading sheet",
                    "Missing justification: deduct 1 point per step, capped at 3 points per question.",
                    "Harmless detours receive no deduction.",
                ]
            ]
        )
        # Only the controlling test process reads this private pipe; never print the token.
        with os.fdopen(3, "w") as pipe:
            pipe.write(
                json.dumps(
                    {
                        "session": {"api": "http://127.0.0.1:8037", "token": token},
                        "pdf_hex": pdf.hex(),
                    }
                )
                + "\n"
            )
        uvicorn.run(app, host="127.0.0.1", port=8037, access_log=False, log_level="error")


if __name__ == "__main__":
    main()
