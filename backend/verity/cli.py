import argparse
import json
import os

from .store import Store


def main():
    parser = argparse.ArgumentParser(
        description="Provision a local Verity user and 24h bearer token"
    )
    parser.add_argument("name")
    parser.add_argument("--role", choices=["student", "ta", "instructor"], default="student")
    parser.add_argument("--data-dir", default=os.getenv("VERITY_DATA_DIR", ".data"))
    args = parser.parse_args()
    user, token = Store(args.data_dir).provision_user(args.name, args.role)
    print(json.dumps({"user": user, "token": token}, indent=2))


if __name__ == "__main__":
    main()
