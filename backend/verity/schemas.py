from datetime import datetime
from enum import StrEnum
from math import isfinite

from pydantic import BaseModel, ConfigDict, Field, model_validator


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class Category(StrEnum):
    arithmetic = "arithmetic"
    logic = "logic"
    notation = "notation"
    presentation = "presentation"
    justification = "justification"
    unsupported_method = "unsupported_method"
    unreadable = "unreadable"


HINTS = {
    "needs_review": "This part could not be checked confidently. Make sure your intermediate "
    "steps are visible, and ask a TA to review it before treating it as a mistake.",
    "arithmetic": "Compare each calculation with the line before it. Check signs, fractions, "
    "and whether you applied the operation to every affected term.",
    "logic": "Find the step where you draw a new conclusion. What fact makes it follow from "
    "the previous line, and does that fact apply here?",
    "notation": "Compare your symbols and final answer format with the assignment's "
    "requirements. Make clear what each symbol represents.",
    "presentation": "Look at the transitions between steps. Add the labels or intermediate "
    "work a reader needs to follow your method.",
    "justification": "Find any claim you state without explaining it. Name the rule you used "
    "and explain why its conditions hold here.",
    "unsupported_method": "Compare your method with the methods allowed for this assignment. "
    "If you used a different valid approach, ask a TA whether it is accepted.",
    "unreadable": "This part could not be read reliably. Check that the whole page and its "
    "symbols are visible, and ask a TA to review the original before changing your reasoning.",
}


class CourseInput(Input):
    name: str = Field(min_length=1, max_length=200)


class EnrollmentInput(Input):
    user_id: str
    role: str = Field(pattern="^(student|ta|instructor)$")


class Question(Input):
    id: str = Field(pattern=r"^[a-zA-Z0-9_-]{1,40}$")
    title: str = Field(min_length=1, max_length=200)
    prompt: str = Field(min_length=1, max_length=10000)
    max_points: float = Field(gt=0, le=1000)


class AssignmentInput(Input):
    title: str = Field(min_length=1, max_length=200)
    questions: list[Question] = Field(min_length=1, max_length=50)
    due_at: datetime | None = None

    @model_validator(mode="after")
    def valid(self):
        if len({q.id for q in self.questions}) != len(self.questions):
            raise ValueError("Question IDs must be unique")
        if self.due_at and self.due_at.tzinfo is None:
            raise ValueError("due_at needs a timezone")
        return self


class Criterion(Input):
    id: str = Field(pattern=r"^[a-zA-Z0-9_-]{1,60}$")
    question_id: str
    description: str = Field(min_length=1, max_length=4000)
    points: float = Field(gt=0, le=1000)
    category: Category


class RubricInput(Input):
    criteria: list[Criterion] = Field(min_length=1, max_length=300)
    instructor_notes: str = Field(default="", max_length=20000)


class PageMap(Input):
    questions: dict[str, list[int]]


class Block(Input):
    id: str = Field(min_length=1, max_length=100)
    page: int = Field(ge=1)
    text: str = Field(max_length=20000)
    bbox: list[float] | None = None

    @model_validator(mode="after")
    def valid_box(self):
        if self.bbox is not None:
            b = self.bbox
            if (
                len(b) != 4
                or not all(isfinite(x) and 0 <= x <= 1 for x in b)
                or b[0] >= b[2]
                or b[1] >= b[3]
            ):
                raise ValueError("bbox must be normalized [left, top, right, bottom]")
        return self


class Transcript(Input):
    blocks: list[Block] = Field(min_length=1, max_length=500)


class Decision(Input):
    criterion_id: str
    outcome: str = Field(pattern="^(met|not_met|uncertain)$")
    evidence_ids: list[str] = Field(default_factory=list, max_length=50)
    rationale: str = Field(min_length=1, max_length=2000)


class ProviderAssessment(Input):
    decisions: list[Decision] = Field(max_length=300)


class ReviewQuestion(Input):
    score: float = Field(ge=0)
    reason: str = Field(min_length=1, max_length=2000)


class ReviewInput(Input):
    expected_revision: int = Field(ge=0)
    questions: dict[str, ReviewQuestion]


class RevisionInput(Input):
    expected_revision: int = Field(ge=0)


class ExplanationInput(RevisionInput):
    text: str = Field(min_length=1, max_length=2000)


class ReopenInput(RevisionInput):
    reason: str = Field(min_length=1, max_length=2000)


class ReportInput(Input):
    question_id: str
    kind: str = Field(pattern="^(incorrect_feedback|help)$")
    message: str = Field(min_length=1, max_length=2000)


class ResolveReport(Input):
    status: str = Field(pattern="^(resolved|dismissed)$")
    staff_note: str = Field(min_length=1, max_length=2000)
