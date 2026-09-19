"""Local development provider for frontend work. NOT a model, NOT training data.

Returns deterministic criterion outcomes for any rubric so the interface can show every
assessment state (estimated, needs review, flags with page anchors) before the model team
supplies the real adapter. Reports ``mode = "fixture"`` so the UI labels it "Test fixture".

Enable only for local development:

    VERITY_PROVIDER_FACTORY=tools.dev_provider:create_provider

Never ship this in a demo that claims model output.
"""

import hashlib


class DevFixtureProvider:
    id = "dev-fixture"
    mode = "fixture"

    def assess(self, context):
        doc = context["document"]
        blocks = doc["blocks"]
        mapping = context["submission"]["mapping"]
        decisions = []
        for c in context["rubric"]["criteria"]:
            pages = mapping.get(c["question_id"], [])
            evidence = [b for b in blocks if b["page"] in pages]
            readable = [b for b in evidence if b["text"].strip()]
            if not evidence:
                # Nothing mapped: the backend rejects this before it reaches us.
                continue
            if not readable:
                decisions.append(
                    {
                        "criterion_id": c["id"],
                        "outcome": "uncertain",
                        "evidence_ids": [evidence[0]["id"]],
                        "rationale": "Dev fixture: no readable text on the mapped pages.",
                    }
                )
                continue
            digest = hashlib.sha256(f"{doc['sha256']}:{c['id']}".encode()).digest()
            roll = digest[0] % 10
            # Mostly met, some not met, rare uncertain (justification only); presentation and
            # notation criteria miss more often so the demo has visible deductions.
            if c["category"] in {"presentation", "notation"}:
                outcome = "not_met" if roll < 5 else "met"
            elif c["category"] == "justification" and digest[2] % 20 == 19:
                outcome = "uncertain"
            elif roll < 7:
                outcome = "met"
            else:
                outcome = "not_met"
            block = readable[digest[1] % len(readable)]
            decisions.append(
                {
                    "criterion_id": c["id"],
                    "outcome": outcome,
                    "evidence_ids": [block["id"]],
                    "rationale": f"Dev fixture outcome for {c['id']} ({c['category']}).",
                }
            )
        return {"decisions": decisions}

    def draft_rubric(self, context):
        criteria = []
        for q in context["assignment"]["questions"]:
            total = q["max_points"]
            parts = [
                ("setup", "Sets up the problem correctly with the given data", "logic", 0.25),
                ("work", "Carries out the computation without arithmetic errors", "arithmetic", 0.35),
                ("justify", "States why each step follows", "justification", 0.25),
                ("present", "Uses the required notation and presentation", "presentation", 0.15),
            ]
            running = 0.0
            for index, (suffix, description, category, share) in enumerate(parts):
                points = round(total * share, 2)
                if index == len(parts) - 1:
                    points = round(total - running, 2)
                running += points
                criteria.append(
                    {
                        "id": f"{q['id']}-{suffix}",
                        "question_id": q["id"],
                        "description": description,
                        "points": points,
                        "category": category,
                    }
                )
        return {
            "criteria": criteria,
            "instructor_notes": "Dev fixture draft. Review every line before publishing.",
        }


def create_provider():
    return DevFixtureProvider()
