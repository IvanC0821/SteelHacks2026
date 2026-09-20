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
