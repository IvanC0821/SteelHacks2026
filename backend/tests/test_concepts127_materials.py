"""Checks for the original demo material, independent of a model or paid API."""

from itertools import product

from verity.schemas import AssignmentInput, RubricInput

from tools.concepts127_materials import HOMEWORKS, assignment_payload, rubric_payload


def test_two_five_question_homeworks_with_balanced_rubrics():
    assert len(HOMEWORKS) == 2
    for hw in HOMEWORKS:
        assignment = AssignmentInput.model_validate(assignment_payload(hw))
        rubric = RubricInput.model_validate(rubric_payload(hw))
        assert len(assignment.questions) == 5
        assert len({criterion.id for criterion in rubric.criteria}) == len(rubric.criteria)
        for question, authored in zip(assignment.questions, hw["questions"], strict=True):
            assert (
                sum(
                    criterion.points
                    for criterion in rubric.criteria
                    if criterion.question_id == question.id
                )
                == question.max_points
                == 10
            )
            assert all(authored[key] for key in ("prompt", "reference", "clean", "mixed"))


def test_discrete_reference_answers():
    squares_cubes = {n**power for n in range(10) for power in (2, 3) if 12 < n**power < 90}
    assert squares_cubes == {16, 25, 27, 36, 49, 64, 81}
    assert (2 * 5) % 10 == 0 and 2 % 10 and 5 % 10
    assert all((n * n + 3 * n + 1) % 2 == 1 for n in range(-100, 101))
    consistent = [
        (a, b, c)
        for a, b, c in product((False, True), repeat=3)
        if a == (not b) and b == (not c) and c == (not a and not b)
    ]
    assert consistent == [(False, True, False)]
    pairs = [{i, i + 12} for i in range(1, 13)]
    assert set.union(*pairs) == set(range(1, 25))
    assert sum(map(len, pairs)) == 24
    for t in range(-100, 101):
        p, q = (t, t) if t >= 0 else (-2 * t, -3 * t)
        assert p >= 0 and q >= 0 and 8 * p - 6 * q == 2 * t
