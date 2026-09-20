"""Handwritten student prompts. Never send private criterion text or staff rationales.

Exact requirement matches select reviewed coaching text for the current rubric; unfamiliar
requirements fall back to category guidance. These prompts do not locate or diagnose a step.
The provider's mode still identifies whether the underlying decision is a fixture or a model.
"""

from .nudges import NUDGES
from .schemas import HINTS

REQUIREMENT_HINTS = {
    "Every row operation is labeled (R2 <- R2 - 2R1, etc.)": "Can a reader identify the row operation between these steps?",
    "Row reduction is carried out without arithmetic errors": NUDGES["arithmetic"],
    "Solution is written as a column vector, not a list": "Does your final notation match the format requested in the question?",
    "Rank is correct and follows from the row-reduced form": "Does your stated rank agree with your row-reduced matrix?",
    "Nullity follows from rank-nullity, stated explicitly": "Have you justified how your stated nullity follows from your work?",
    "Null-space basis vectors are derived, not guessed": "Have you shown how your proposed basis follows from your equations?",
    "Closure under addition is shown for arbitrary vectors": NUDGES["universal"],
    "Closure under scalar multiplication is shown for arbitrary scalar": NUDGES["universal"],
    "The zero vector is shown to be in W": "Have you checked every condition in the definition you are using?",
    "Proof ends with the universal conclusion, not an example": NUDGES["conclusion"],
    "Augmented matrix [A | I] is set up and reduced with labeled steps": NUDGES["presentation"],
    "Inverse entries are correct": NUDGES["arithmetic"],
    "One product A A^{-1} = I is computed as verification": "Have you shown the verification requested in the question?",
    "Sets up the problem correctly with the given data": NUDGES["assumptions"],
    "Carries out the computation without arithmetic errors": NUDGES["arithmetic"],
    "States why each step follows": NUDGES["justification"],
    "Uses the required notation and presentation": NUDGES["presentation"],
}


def student_hint(criterion, category):
    # Uncertainty is not evidence that a requirement was missed.
    if category in {"needs_review", "unreadable"}:
        return HINTS[category]
    return REQUIREMENT_HINTS.get(criterion["description"], HINTS[category])


def generate_student_feedback(provider, context, assessment):
    """Enrich validated findings using only student-visible question text and evidence.

    A failed or malformed coaching response leaves every reviewed fallback intact.
    Unreadability/uncertainty always retains clarification guidance.
    """
    import logging

    from .schemas import StudentFeedback

    generate = getattr(provider, "generate_feedback", None)
    if not callable(generate):
        return
    questions = {q["id"]: q for q in context["assignment"]["questions"]}
    targets = {}
    findings = []
    for question in assessment["questions"]:
        for flag in question["flags"]:
            if flag["category"] in {"unreadable", "needs_review"}:
                continue
            targets[flag["id"]] = flag
            evidence = [
                {"page": block["page"], "text": block["text"]}
                for block in context["document"]["blocks"]
                if any(
                    block["page"] == anchor["page"]
                    and (anchor["bbox"] is None or block["bbox"] == anchor["bbox"])
                    for anchor in flag["anchors"]
                )
            ]
            public_question = questions[question["question_id"]]
            findings.append(
                {
                    "id": flag["id"],
                    "category": flag["category"],
                    "question": {
                        "title": public_question["title"],
                        "prompt": public_question["prompt"],
                    },
                    "evidence": evidence,
                }
            )
    if not findings:
        return
    try:
        response = StudentFeedback.model_validate(
            generate({"findings": findings, "allowed_nudges": NUDGES})
        )
        if len(response.items) != len(targets) or {item.id for item in response.items} != set(
            targets
        ):
            raise ValueError("Feedback coverage mismatch")
        if any(item.hint_key not in NUDGES for item in response.items):
            raise ValueError("Unknown reviewed nudge")
    except Exception as exc:
        # No raw exception, prompt, response, or credentials in logs.
        logging.getLogger(__name__).warning("Student coaching unavailable (%s)", type(exc).__name__)
        return
    for item in response.items:
        targets[item.id]["message"] = NUDGES[item.hint_key]
        targets[item.id]["message_source"] = "model_selected"


def safe_feedback_view(assessment):
    """Apply the current nudge policy to historic results without rewriting frozen attempts."""
    from copy import deepcopy

    if assessment is None:
        return None
    result = deepcopy(assessment)
    allowed = set(NUDGES.values()) | set(HINTS.values()) | set(REQUIREMENT_HINTS.values())
    for question in result["questions"]:
        for flag in question["flags"]:
            if flag["message"] not in allowed:
                flag["message"] = HINTS.get(flag["category"], NUDGES["general"])
                flag.pop("message_source", None)
    return result
