"""Export the application schema without users, documents, assessments or model calls."""

import json
from pathlib import Path
from tempfile import TemporaryDirectory

from verity.api import create_app
from verity.provider import UnconfiguredProvider


def main():
    target = Path(__file__).resolve().parents[1] / "docs" / "openapi.json"
    with TemporaryDirectory(prefix="verity-contract-") as tmp:
        app = create_app(tmp, UnconfiguredProvider())
        target.write_text(json.dumps(app.openapi(), indent=2) + "\n")
    print("Exported docs/openapi.json.")


if __name__ == "__main__":
    main()
