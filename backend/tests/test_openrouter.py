import json

import httpx
import pytest
from verity import openrouter
from verity.provider import load_provider
from verity.schemas import ProviderAssessment


def test_blank_key_disables_provider(monkeypatch):
    monkeypatch.setenv("VERITY_PROVIDER_FACTORY", "verity.openrouter:create_provider")
    monkeypatch.setenv("OPENROUTER_API_KEY", "")
    assert load_provider().mode == "unconfigured"


@pytest.mark.parametrize(
    "finish,content,valid",
    [
        ("stop", '{"decisions": []}', True),
        ("length", '{"decisions": []}', False),
        ("stop", "not json", False),
        ("stop", '{"decisions": [], "private": "unexpected"}', False),
    ],
)
def test_request_and_validation(monkeypatch, finish, content, valid):
    real_client = httpx.Client

    def handle(request):
        assert str(request.url) == "https://openrouter.ai/api/v1/chat/completions"
        assert request.headers["Authorization"] == "Bearer test-key"
        payload = json.loads(request.content)
        assert payload["model"] == "test-model"
        assert payload["max_tokens"] == 8192
        return httpx.Response(
            200, json={"choices": [{"finish_reason": finish, "message": {"content": content}}]}
        )

    monkeypatch.setenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
    monkeypatch.setenv("OPENROUTER_MAX_TOKENS", "8192")
    monkeypatch.setattr(
        openrouter.httpx,
        "Client",
        lambda **kw: real_client(transport=httpx.MockTransport(handle), **kw),
    )
    provider = openrouter.OpenRouterProvider("test-key")
    if valid:
        assert provider._generate("test-model", "test", {}, ProviderAssessment).decisions == []
    else:
        with pytest.raises(ValueError):
            provider._generate("test-model", "test", {}, ProviderAssessment)


def test_assessment_prompt_supplies_only_mapped_student_evidence(monkeypatch):
    provider = openrouter.OpenRouterProvider("test-key")
    captured = {}

    def generate(model, instruction, context, schema):
        captured.update(context)
        return ProviderAssessment(decisions=[])

    monkeypatch.setattr(provider, "_generate", generate)
    provider.assess(
        {
            "rubric": {"criteria": [{"id": "proof", "question_id": "q1"}]},
            "submission": {"mapping": {"q1": [1]}},
            "document": {"blocks": [{"id": "line3", "page": 1}, {"id": "line4", "page": 2}]},
            "references": [{"blocks": [{"id": "p1", "page": 1}]}],
        }
    )
    assert captured["allowed_student_evidence_by_criterion"] == {"proof": ["line3"]}


def test_assessment_localizes_distinct_errors_to_original_line_ids(monkeypatch):
    real_client = httpx.Client
    blocks = [
        {"id": "p1-l1", "page": 1, "text": "Induction step:", "bbox": [0.1, 0.1, 0.6, 0.12]},
        {
            "id": "p1-l2",
            "page": 1,
            "text": "1 + 3 + ... + (2k - 1) = k^2",
            "bbox": [0.1, 0.2, 0.6, 0.22],
        },
        {
            "id": "p1-l3",
            "page": 1,
            "text": "For k + 1: k^2 + (2k - 1)",
            "bbox": [0.1, 0.3, 0.6, 0.32],
        },
        {
            "id": "p1-l4",
            "page": 1,
            "text": "= k^2 + 2k - 1",
            "bbox": [0.1, 0.4, 0.6, 0.42],
        },
        {
            "id": "p1-l5",
            "page": 1,
            "text": "= (k + 1)^2",
            "bbox": [0.1, 0.5, 0.6, 0.52],
        },
        {"id": "p2-l1", "page": 2, "text": "Another question", "bbox": None},
    ]
    decisions = [
        {
            "criterion_id": "extension",
            "outcome": "not_met",
            "evidence_ids": ["p1-l3"],
            "rationale": "The added term repeats the kth odd number.",
        },
        {
            "criterion_id": "algebra",
            "outcome": "not_met",
            "evidence_ids": ["p1-l5"],
            "rationale": "The final equality has an incorrect constant term.",
        },
    ]

    def handle(request):
        payload = json.loads(request.content)
        instruction = payload["messages"][0]["content"]
        assert "For each not_met decision" in instruction
        assert "smallest set of student lines containing the actual error" in instruction
        assert "do not cite correct preceding work, section headings" in instruction
        assert "cite the incorrect resulting line" in instruction
        assert "check each equality against the expression immediately before it" in instruction
        assert "first invalid transition relevant to the criterion" in instruction
        assert "newly asserted right-hand side after '='" in instruction
        assert (
            "Do not move an algebra finding backward onto that valid simplification" in instruction
        )
        assert "closest relevant student line or section" in instruction
        assert "Never invent coordinates" in instruction
        assert "Copy the allowed IDs exactly" in instruction
        context = json.loads(payload["messages"][1]["content"])
        assert context["allowed_student_evidence_by_criterion"] == {
            "extension": ["p1-l1", "p1-l2", "p1-l3", "p1-l4", "p1-l5"],
            "algebra": ["p1-l1", "p1-l2", "p1-l3", "p1-l4", "p1-l5"],
        }
        assert context["document"]["blocks"] == blocks
        return httpx.Response(
            200,
            json={
                "choices": [
                    {
                        "finish_reason": "stop",
                        "message": {"content": json.dumps({"decisions": decisions})},
                    }
                ]
            },
        )

    monkeypatch.setattr(
        openrouter.httpx,
        "Client",
        lambda **kw: real_client(transport=httpx.MockTransport(handle), **kw),
    )
    provider = openrouter.OpenRouterProvider("test-key")
    assessment = provider.assess(
        {
            "rubric": {
                "criteria": [
                    {"id": "extension", "question_id": "q1"},
                    {"id": "algebra", "question_id": "q1"},
                ]
            },
            "submission": {"mapping": {"q1": [1]}},
            "document": {"blocks": blocks},
            "references": [{"blocks": [{"id": "reference-answer", "page": 1}]}],
        }
    )
    assert assessment.model_dump() == {"decisions": decisions}
