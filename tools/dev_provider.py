"""Local development provider for frontend work. NOT a model, NOT training data.

Returns deterministic criterion outcomes for any rubric so the interface can show every
assessment state (estimated, needs review, flags with page anchors) before the model team
supplies the real adapter. Reports ``mode = "fixture"`` so the UI labels it "Test fixture".

Enable only for local development:

    VERITY_PROVIDER_FACTORY=tools.dev_provider:create_provider

Never ship this in a demo that claims model output.
"""

import hashlib

# Handwritten interface examples, not observations about the uploaded paper. Match the
# full requirement so reusing a criterion ID in another rubric cannot give it stale copy.
EXAMPLE_REASONS = {
    "Every row operation is labeled (R2 <- R2 - 2R1, etc.)": (
        "Each row operation names the row being changed and the operation used, "
        "so the reduction is easy to follow.",
        "One or more row operations are missing labels. The rubric requires those labels "
        "even when the final answer is correct.",
    ),
    "Row reduction is carried out without arithmetic errors": (
        "The arithmetic is consistent from one row-reduction step to the next.",
        "An arithmetic error changes the entries during row reduction. "
        "Check each step against the previous matrix.",
    ),
    "Solution is written as a column vector, not a list": (
        "The final solution uses the column-vector notation required by the assignment.",
        "The solution is written as a list of values instead of the required column vector. "
        "This concerns notation, not whether the values are correct.",
    ),
    "Rank is correct and follows from the row-reduced form": (
        "The stated rank matches the number of pivots in the row-reduced matrix.",
        "The stated rank does not match the pivot count in the row-reduced matrix.",
    ),
    "Nullity follows from rank-nullity, stated explicitly": (
        "The work explicitly uses rank-nullity to find the number of free variables.",
        "The work does not show how nullity follows from rank-nullity. "
        "A value alone does not satisfy this explanation requirement.",
    ),
    "Null-space basis vectors are derived, not guessed": (
        "The work derives the basis vectors from the free-variable equations.",
        "The basis vectors are listed without showing how they follow from the equations.",
    ),
    "Closure under addition is shown for arbitrary vectors": (
        "The proof shows that the sum of any two vectors in the set remains in the set.",
        "The work checks specific vectors. Closure under addition requires an argument "
        "that applies to any two vectors in the set.",
    ),
    "Closure under scalar multiplication is shown for arbitrary scalar": (
        "The proof covers any vector in the set and any scalar.",
        "The work checks one scalar multiple. The proof must cover any scalar "
        "and any vector in the set.",
    ),
    "The zero vector is shown to be in W": (
        "The work substitutes the zero vector into the defining equation and verifies it holds.",
        "The proof does not verify that the zero vector belongs to the set.",
    ),
    "Proof ends with the universal conclusion, not an example": (
        "The proof ends by stating the conclusion for the whole set.",
        "The work ends with a particular example instead of stating the conclusion "
        "for the whole set.",
    ),
    "Augmented matrix [A | I] is set up and reduced with labeled steps": (
        "The work starts with [A | I] and labels the row operations used to reduce it.",
        "The required augmented-matrix setup or row-operation labels are missing. "
        "Review this presentation requirement separately from the inverse's entries.",
    ),
    "Inverse entries are correct": (
        "The proposed inverse has the correct entries.",
        "At least one entry in the proposed inverse is incorrect. "
        "Check the arithmetic used to obtain it.",
    ),
    "One product A A^{-1} = I is computed as verification": (
        "The work computes the matrix product and shows that it equals the identity matrix.",
        "The work does not include a completed multiplication check. "
        "Stating that the matrices are inverses is not enough for this criterion.",
    ),
    "Sets up the problem correctly with the given data": (
        "The setup uses the given information and represents the requested problem correctly.",
        "The setup omits or misuses part of the given information. "
        "Check it against the problem statement.",
    ),
    "Carries out the computation without arithmetic errors": (
        "The computation follows consistently from the setup without arithmetic errors.",
        "An arithmetic error changes the result. Check the calculation one step at a time.",
    ),
    "States why each step follows": (
        "The work explains the rule or reasoning that supports each step.",
        "A step is stated without explaining why it follows. "
        "The rubric requires supporting reasoning as well as the result.",
    ),
    "Uses the required notation and presentation": (
        "The work uses the notation and presentation required by the rubric.",
        "The work does not consistently follow the required notation or presentation. "
        "Review the assignment's formatting requirements.",
    ),
}


def example_rationale(criterion, outcome, *, unreadable=False):
    """Describe a fixture outcome without presenting it as a finding about the paper."""
    if unreadable:
        reason = (
            "No readable text was extracted from the mapped pages. "
            "Review the PDF before assigning points for this requirement."
        )
    elif outcome == "uncertain":
        reason = (
            f'It is unclear whether this requirement is satisfied: "{criterion["description"]}". '
            "Review the mapped pages before assigning points."
        )
    elif reasons := EXAMPLE_REASONS.get(criterion["description"]):
        reason = reasons[0 if outcome == "met" else 1]
    else:
        status = "meets" if outcome == "met" else "does not meet"
        reason = f'The sample result {status} this requirement: "{criterion["description"]}".'
    return f"Example explanation: {reason}"


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
                        "rationale": example_rationale(c, "uncertain", unreadable=True),
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
                    "rationale": example_rationale(c, outcome),
                }
            )
        return {"decisions": decisions}

    def draft_rubric(self, context):
        criteria = []
        for q in context["assignment"]["questions"]:
            total = q["max_points"]
            parts = [
                ("setup", "Sets up the problem correctly with the given data", "logic", 0.25),
                (
                    "work",
                    "Carries out the computation without arithmetic errors",
                    "arithmetic",
                    0.35,
                ),
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
