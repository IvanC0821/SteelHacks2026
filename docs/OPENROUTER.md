# OpenRouter setup

Fill OPENROUTER_API_KEY in the root .env. It is ignored by Git and must stay
server-side. The selected models use paid usage-based endpoints, not :free variants.
A blank key keeps automated assessment disabled; startup makes no model requests.

Assessment and rubric generation now use OpenRouter. The service still validates
evidence and computes scores. Requests have an HTTP timeout, output-token limit,
response-size limit, and no automatic retries.

Student hints use OPENROUTER_FEEDBACK_MODEL in a separate call after evidence validation.
The model selects a hint key from a reviewed catalogue of short, single-sentence nudges
(including discrete-math proof guidance); arbitrary model-written student text is rejected.
Every fallback is also one sentence, and older results are projected through this policy
without modifying their frozen records.
That call receives only public question text and student evidence, never private references,
criteria, or staff rationales. Uncertain findings keep clarification guidance. Failed or malformed
feedback generation preserves the reviewed templates and does not discard assessment results.
Student hints appear in the panel and linked yellow PDF annotation cards.
The assessment selects the specific erroneous text lines; measured PDF coordinates place the
yellow highlight and numbered arrow directly beside those lines. Clicking a pin opens its hint.

Only OPENROUTER_PARSING_MODEL remains reserved. PDFs use embedded-text extraction with measured
line positions; this does not add handwriting OCR. Existing sealed attempts retain their original
coordinates, so upload a new attempt to use the improved extraction.
The configured vision model is Nemotron Nano VL, not Nemotron Parse.

Run in PowerShell from the repository root:

```powershell
uv venv --python 3.13
uv pip install --python .venv/Scripts/python.exe -r requirements.txt
uv run --no-project --python .venv/Scripts/python.exe --env-file .env -- python -m uvicorn verity.api:create_app --factory --app-dir backend --host 127.0.0.1 --port 8026
```

The uv command explicitly loads .env before startup. Direct uvicorn invocation does
not auto-load it. Existing process environment variables take precedence.

References:
- https://openrouter.ai/docs/quickstart
- https://openrouter.ai/nvidia/nemotron-3-nano-30b-a3b
- https://openrouter.ai/nvidia/nemotron-nano-12b-v2-vl
