"""Handwritten student prompts. Never send private criterion text or staff rationales.

Exact requirement matches select reviewed coaching text for the current rubric; unfamiliar
requirements fall back to category guidance. These prompts do not locate or diagnose a step.
The provider's mode still identifies whether the underlying decision is a fixture or a model.
"""

from .schemas import HINTS

REQUIREMENT_HINTS = {
    "Every row operation is labeled (R2 <- R2 - 2R1, etc.)": "Look at the transitions between your matrices. Can a reader tell which row "
    "operation produced each new row? Label any missing operations.",
    "Row reduction is carried out without arithmetic errors": "Compare each new row with the row before it. Recheck signs and fractions, "
    "and make sure the operation also applies to the entry after the vertical bar.",
    "Solution is written as a column vector, not a list": "Look at how you wrote your final solution. Does it use the column-vector "
    "format requested in the question, or only list the variable values?",
    "Rank is correct and follows from the row-reduced form": "Revisit the pivot positions in your row-reduced matrix. Does the number "
    "of pivots agree with the rank you reported?",
    "Nullity follows from rank-nullity, stated explicitly": "Compare your pivot count, free-variable count, and number of columns. "
    "Have you explained how rank-nullity connects them?",
    "Null-space basis vectors are derived, not guessed": "Trace each basis vector back to your free-variable equations. Have you "
    "shown how you obtained the vectors, rather than only listing them?",
    "Closure under addition is shown for arbitrary vectors": "Look at the vectors in your addition argument. Does it work for any two "
    "vectors in the set, or only the specific examples you chose?",
    "Closure under scalar multiplication is shown for arbitrary scalar": "Look at the scalar and vector in your multiplication argument. Does the "
    "reasoning cover any scalar and any vector in the set, or just one example?",
    "The zero vector is shown to be in W": "Find the part of your proof that checks the zero vector. Have you explained "
    "whether it satisfies the set's defining condition?",
    "Proof ends with the universal conclusion, not an example": "Read the final sentence of your proof. Does it state a conclusion about "
    "the entire set and connect that conclusion to the properties you checked?",
    "Augmented matrix [A | I] is set up and reduced with labeled steps": "Review your augmented-matrix setup and the labels between matrices. "
    "Can a reader follow how each operation changes both sides?",
    "Inverse entries are correct": "Recheck the arithmetic used to obtain your proposed inverse, especially "
    "sign changes and operations applied to both sides of the augmented matrix.",
    "One product A A^{-1} = I is computed as verification": "Look at your verification step. Have you shown the multiplication check "
    "and compared its result with the identity matrix, or only stated it works?",
    "Sets up the problem correctly with the given data": "Compare your starting equations or diagram with the question. Have you "
    "used every relevant given value and identified what you need to find?",
    "Carries out the computation without arithmetic errors": HINTS["arithmetic"],
    "States why each step follows": HINTS["justification"],
    "Uses the required notation and presentation": HINTS["presentation"],
}


def student_hint(criterion, category):
    # Uncertainty is not evidence that a requirement was missed.
    if category in {"needs_review", "unreadable"}:
        return HINTS[category]
    return REQUIREMENT_HINTS.get(criterion["description"], HINTS[category])
