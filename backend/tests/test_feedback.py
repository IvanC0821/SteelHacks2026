import pytest
from verity.feedback import student_hint
from verity.schemas import HINTS


def test_same_category_can_point_to_different_requirements():
    row_labels = student_hint(
        {"description": "Every row operation is labeled (R2 <- R2 - 2R1, etc.)"},
        "presentation",
    )
    proof_conclusion = student_hint(
        {"description": "Proof ends with the universal conclusion, not an example"},
        "presentation",
    )
    assert "row operation" in row_labels
    assert "final sentence" in proof_conclusion
    assert row_labels != proof_conclusion


def test_unfamiliar_private_requirement_is_not_echoed():
    hint = student_hint({"description": "PRIVATE: the answer must be 42"}, "arithmetic")
    assert hint == HINTS["arithmetic"]
    assert "PRIVATE" not in hint and "42" not in hint


@pytest.mark.parametrize("category", ["needs_review", "unreadable"])
def test_uncertainty_overrides_requirement_specific_coaching(category):
    hint = student_hint(
        {"description": "Every row operation is labeled (R2 <- R2 - 2R1, etc.)"}, category
    )
    assert hint == HINTS[category]
    assert "row operation" not in hint


def test_student_api_uses_coaching_without_exposing_staff_material(h):
    submission = h.attempt()
    assert h.assess(submission)["status"] == "succeeded"
    assessment = h.sub(submission)["assessment"]
    flags = assessment["questions"][0]["flags"]
    assert len(flags) == 1
    assert flags[0]["message"] == HINTS["justification"]
    assert "decisions" not in assessment
    assert "Private criterion" not in str(assessment)
    assert "Test-only negative outcome" not in str(assessment)


def test_generated_student_feedback_uses_public_context_and_reaches_student(h):
    import json

    seen = []

    def generate(context):
        seen.append(context)
        assert set(context) == {"findings", "allowed_nudges"}
        serialized = json.dumps(context)
        assert "Private criterion" not in serialized
        assert "Test-only negative outcome" not in serialized
        assert "references" not in serialized
        assert "rationale" not in serialized
        assert "instructor_notes" not in serialized
        return {
            "items": [
                {"id": item["id"], "hint_key": "justification"} for item in context["findings"]
            ]
        }

    h.app.state.service.provider.generate_feedback = generate
    submission = h.attempt()
    assert h.assess(submission)["status"] == "succeeded"
    flag = h.sub(submission)["assessment"]["questions"][0]["flags"][0]
    assert seen
    assert flag["message"] == HINTS["justification"]
    assert flag["message_source"] == "model_selected"
    assert flag["anchors"]


@pytest.mark.parametrize(
    "failure", ["exception", "unknown", "empty", "duplicate", "too_long", "answer", "fake_quote"]
)
def test_feedback_failure_preserves_assessment_and_reviewed_hint(h, failure):
    def generate(context):
        if failure == "exception":
            raise RuntimeError("PRIVATE vendor error")
        flag_id = context["findings"][0]["id"]
        item = {
            "id": "unknown" if failure == "unknown" else flag_id,
            "hint_key": ""
            if failure == "empty"
            else "x" * 61
            if failure == "too_long"
            else "justification",
        }
        if failure == "answer":
            item["message"] = "The correct step is x = 4."
        if failure == "fake_quote":
            item["excerpt"] = "invented text not written by the student"
        return {"items": [item, item] if failure == "duplicate" else [item]}

    h.app.state.service.provider.generate_feedback = generate
    submission = h.attempt()
    assert h.assess(submission)["status"] == "succeeded"
    flag = h.sub(submission)["assessment"]["questions"][0]["flags"][0]
    assert flag["message"] == HINTS["justification"]
    assert "message_source" not in flag


def test_uncertain_feedback_never_calls_model():
    from types import SimpleNamespace

    from verity.feedback import generate_student_feedback

    def unexpected(context):
        raise AssertionError("Must not call feedback model")

    assessment = {
        "questions": [{"flags": [{"id": "f", "category": "unreadable", "message": "Clarify"}]}]
    }
    generate_student_feedback(
        SimpleNamespace(generate_feedback=unexpected), {"assignment": {"questions": []}}, assessment
    )
    assert assessment["questions"][0]["flags"][0]["message"] == "Clarify"


def test_all_student_hints_are_one_short_answer_free_sentence():
    from verity.feedback import REQUIREMENT_HINTS
    from verity.nudges import NUDGES

    for message in [*HINTS.values(), *REQUIREMENT_HINTS.values(), *NUDGES.values()]:
        assert len(message) <= 150
        assert message.endswith("?")
        assert sum(message.count(c) for c in ".!?") == 1
        assert not any(c.isdigit() for c in message)
        assert "=" not in message


def test_model_cannot_inject_answer_even_with_valid_hint_key(h):
    def generate(context):
        return {
            "items": [
                {"id": item["id"], "hint_key": "general", "message": "The answer is four."}
                for item in context["findings"]
            ]
        }

    h.app.state.service.provider.generate_feedback = generate
    submission = h.attempt()
    assert h.assess(submission)["status"] == "succeeded"
    flag = h.sub(submission)["assessment"]["questions"][0]["flags"][0]
    assert flag["message"] == HINTS["justification"]
    assert "four" not in flag["message"]


def test_historical_answer_is_replaced_without_mutating_frozen_assessment():
    from verity.feedback import safe_feedback_view

    original = {
        "questions": [
            {
                "flags": [
                    {
                        "category": "arithmetic",
                        "message": "The answer is four.",
                        "message_source": "model",
                    }
                ]
            }
        ]
    }
    public = safe_feedback_view(original)
    assert public["questions"][0]["flags"][0]["message"] == HINTS["arithmetic"]
    assert original["questions"][0]["flags"][0]["message"] == "The answer is four."
