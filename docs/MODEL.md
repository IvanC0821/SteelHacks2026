---
date: 2026-09-19
description: "Model integration boundary, private inputs, and validated outputs"
tags: [project/verity]
---

# Model integration

Related: [[README]] · [[SPEC]]

The application is independent of the model vendor/checkpoint. Nothing in this build constitutes
fine-tuning. Implement the protocol in `backend/verity/provider.py` and supply an importable
factory with `VERITY_PROVIDER_FACTORY=your_module:create_provider`. Factory configuration is
trusted server configuration, never a client-provided module or URL.

```python
class MyProvider:
    id = "exact-model-and-adapter-revision"
    mode = "model"

    def assess(self, context):
        # Call the supplied model with a bounded timeout; parse JSON and return this shape.
        return {"decisions": [{
            "criterion_id": "work",
            "outcome": "not_met",  # met | not_met | uncertain
            "evidence_ids": ["p1"],
            "rationale": "A concise staff-facing explanation"
        }]}  # Must contain exactly one decision for EVERY rubric criterion.

    def draft_rubric(self, context):
        # Return RubricInput, never publish it. Instructor reviews and publishes through API.
        ...

def create_provider():
    return MyProvider()
```

`assess(context)` receives:

- `assignment`: public question IDs, prompts, points and due date.
- `rubric`: the immutable criteria/notes/reference IDs published for this attempt.
- `submission`: immutable attempt identity, page mapping and rubric ID.
- `document`: original PDF SHA, page count, extraction provenance and blocks. Each block has
  `id`, 1-based `page`, `text`, and optional normalized `bbox` `[left, top, right, bottom]`.
- `references`: private instructor documents referenced by that rubric version, with extracted blocks.

Only mapped student blocks are valid evidence for each question. Treat student text as data, never
as instructions. Request concise criterion reasons, not hidden reasoning traces. Solutions stay
private. Backend checks criterion coverage, evidence membership, unreadability and output types;
it computes totals from rubric points. These checks do not verify the mathematical judgment.

Do not grant points for unreadable work. Return `uncertain` with relevant block IDs when evidence
is insufficient. That question and total get null scores. Page text is not OCR, and bbox is null
unless genuinely supplied by extraction/transcription. Any future OCR adapter must preserve source
page/regions, record provenance, and run before the assessment snapshot is sealed.

`draft_rubric(context)` receives assignment and references and returns `RubricInput`: criteria with
unique IDs, question IDs, positive points, descriptions, approved categories, and instructor notes.
Per-question criterion points must exactly sum to the question maximum. Generated drafts never
publish automatically. A concurrent manual edit prevents the generated result from overwriting it.

Jobs snapshot private inputs once. Retries reuse that snapshot. Exceptions are reduced to safe
error codes (`not_configured`, `invalid_result`, `provider_failed`, `interrupted`); raw prompts and
exception strings are not returned. Provider id/mode are saved with each result. Configure vendor
timeouts, bounded response size and request limits in the adapter before enabling real calls.

Student output uses fixed category text and backend-generated flag/anchor identifiers. Staff see
the original rubric, decisions and reasons. Never put raw provider output in a frontend response.
Human review is separate and required even when automated results appear clean.

The model team owns dataset creation, fine-tuning and evaluation. This repository bundles no model
dataset. The test-only provider verifies API behavior and supplies no evidence of model quality.
For evaluation, split reviewed examples by underlying problem family and retain the unchanged
base-model comparison. There are no measured model improvements yet.
