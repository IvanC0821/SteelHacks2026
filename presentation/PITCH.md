---
date: 2026-09-19
description: "Original live-demo rehearsal script and research-plan wording"
tags: [project/verity, presentation]
---

# Verity live pitch

Five-minute script including a 90-second live demo. Eight main slides and three appendix slides. Speaker A narrates; Speaker B drives the app. Names and the event's actual time limit are unconfirmed.

This is a rehearsal draft. No model run, trained adapter, implemented app, or numerical improvement was verified in this session. The deck states those limits. The proposed checkpoint is NVIDIA Nemotron 3 Nano 4B. Replace it everywhere if the team uses another checkpoint. The exact spoken wording below is accurate at the current planning stage. Completed-training and measured-results replacements follow it.

The synthetic examples are original AI-authored illustrations with checked elementary arithmetic. An instructor has not adjudicated the labels. They are not a training corpus or a scored test set. No real student work is included.

## Five-minute version

| Segment | Slide | Time |
|---|---:|---:|
| Opening | 1 | 25 seconds |
| Base model and research question | 2 | 30 seconds |
| Synthetic data | 3 | 35 seconds |
| Adaptation | 4 | 35 seconds |
| Live demo | 5 | 90 seconds |
| Evaluation | 6 | 35 seconds |
| Limitations | 7 | 30 seconds |
| Closing | 8 | 20 seconds |

Times are rehearsal allocations, not a verified event rule or measured delivery speed. Total 300 seconds. Rehearse with real inference latency.


### Slide 1 — Opening

> A correct final answer can still hide a gap in reasoning. We're building Verity to help students find those gaps before they hand their work in. Instructors set the expectations. Students get a focused hint, and TAs can inspect the evidence behind an assessment. Our question is whether we can specialize Nemotron for that job.

**Action:** Presenter A opens. Presenter B has the app ready in a separate tab. This wording describes the project goal, not a measured learning outcome.


### Slide 2 — Base model and research question

> Our current candidate is Nemotron 3 Nano 4B. NVIDIA provides the pretrained model and supports LoRA fine-tuning. It takes text, so document reading sits outside this model. General reasoning benchmarks don't tell us how it handles a particular course rubric. We need to test rubric compliance, valid alternative methods, and whether student feedback reveals too much.

**Action:** Keep the candidate label until the deployed checkpoint is confirmed. Do not describe these possible failure modes as observed baseline errors.


### Slide 3 — Dataset design

> These are fictional examples we prepared. The first two contain exactly the same student answer. Under a rubric that requires a derivation, justification is missing. Under an answer-only rubric, the answer meets the requirements. The third uses a different valid method. These pairs let us test whether the model follows the rubric instead of simply matching the instructor's solution.

**Action:** Point to the identical first two answers, then to the changed rubric. These examples are reserved for illustration and must stay outside the scored benchmark. Labels have not been adjudicated by an instructor.


### Slide 4 — Training method and system contributions

> Our training target is criterion-level assessment. Each example pairs a question, rubric and student attempt with a reviewed decision. LoRA keeps the base weights fixed and trains a small adapter. We still supply the current assignment's rubric at runtime. Separately, the backend checks scores and evidence references, and limits what students see. We evaluate those software controls separately from the model change.

**Action:** This is the exact present-tense research-plan script. Once verified, use the completed-training replacement in PITCH.md and change the slide status. Do not say backend controls are learned model behavior.


### Slide 5 — Live demo

> Here's the instructor's rubric. It requires a valid derivation as well as the final values. This fictional student wrote the correct values but omitted the derivation. I'm submitting it now. The expected flag is missing justification.

> [If the expected flag appears] The feedback points to what's missing without filling in the solution. Now I'll submit the student's completed revision.

> [After opening TA review] The TA can inspect the original work beside the criterion and make the final decision.

> [If time permits] This other attempt uses substitution. It should pass because the rubric allows any valid method.

**Action:** Switch to the actual app. Use examples D01, D03 and D04. A narrates, B drives. Read actual output before describing it. If processing exceeds 15 seconds, say: "The live request is still processing. We can inspect the rubric and source work while it completes." If it fails, use the exact failure line in PITCH.md. Never substitute a target label for a returned model result.


### Slide 6 — Results

> Here's the comparison we need before claiming an improvement. Both versions receive the same work and rubric. We hold out entire problem families so variants don't leak into the test set. We measure correct rubric decisions, false flags on valid work, missed errors, and answer leakage. Those measurements are still pending. The live demonstration shows behavior on an example, but it doesn't establish general accuracy.

**Action:** Replace Not run only with recorded measurements. Report numerators and denominators. Use the result-specific script in PITCH.md after evaluation. If no training completes, name the deployed base model accurately.


### Slide 7 — Limitations and next improvements

> Even a better result here would have limits. Handwriting errors can reach the grader. Synthetic examples simplify real work, and our labels can be wrong. New courses can require different reasoning. We would next test instructor-reviewed data and actual handwriting, with permission. TAs keep the final decision. Improved rubric agreement would be useful evidence, but it wouldn't prove that students learned more.

**Action:** If any limitation has been measured, show the actual count and retain the residual risk. Do not claim planned routing or other mitigations are already implemented.


### Slide 8 — Closing

> The next step is one instructor-approved practice assignment. We'd test whether students can use the feedback and whether TAs trust the evidence enough to review it. Verity's goal is useful feedback while there's still time to revise, with the instructor's expectations and judgment preserved.

**Action:** End the main pitch here. Appendix slides answer questions.


## Live-demo branches

Use actual returned output. The expected label file is not a substitute for a model run.

**If the request is slow**

> The live request is still processing. We can inspect the rubric and source work while it completes.

**If the request fails and no recorded run exists**

> This live request failed, so we can't show a model result for it. The labels on our data slide are expected outcomes. We'll continue with the method and the evidence we do have.

**If the model makes the wrong decision**

> This decision disagrees with our reference label. Here's the criterion and the student's work. We'd count this as an error in the evaluation and route the assessment for review.

**If a genuine saved run is available**

> This is a saved result from an earlier run on the same example, not the response to the request we just sent.

Only say that if the checkpoint, input, rubric and output really match the saved record. Do not fabricate a saved result. Do not quietly reset the app into a scripted success state.

## Exact replacements after training

These are fill-in templates for verified facts. Do not read square-bracket fields aloud or substitute estimates. Keep the current script if the relevant evidence does not exist.

**Slide 4 after a successful train, save, reload and inference**

> We fine-tuned [EXACT CHECKPOINT] with LoRA using [N] training examples from [K] problem families. We trained the adapter to map student work to individual rubric decisions. The original base weights stayed fixed. Each assignment's rubric still comes in with the request, so a new rubric doesn't require another training run. We saved the adapter and loaded it into the model that serves this demo.

Use the final sentence only if the live demo really uses that adapter. If it uses the base model, say that explicitly.

**Slide 6 after a positive evaluation**

> We tested both versions on [N] held-out cases from [K] problem families. They received identical inputs and rubrics. The base model correctly assessed [A] out of [D] rubric decisions. The adapter correctly assessed [B] out of the same [D]. False flags on valid work changed from [F_BASE] out of [N_VALID] to [F_TUNED] out of [N_VALID]. [NAME THE LARGEST REGRESSION OR REMAINING FAILURE.] These results describe this synthetic test set. They don't establish performance across real courses.

**Slide 6 if improvement is mixed**

> Fine-tuning improved [METRIC], but [OTHER METRIC] got worse. We haven't established an overall improvement. Our next step is to inspect those failures and revise the training data before expanding the task.

**Slide 6 if tuning has no measurable benefit**

> The adapter didn't improve the held-out results in this experiment. We're showing the comparison because it tells us where the approach needs work. The deployed version is [BASE OR ADAPTER, AS ACTUALLY USED].

**If no fine-tuning completes**

> This version uses the pretrained Nemotron model with the instructor's rubric and our application controls. We prepared the fine-tuning experiment, but we didn't complete a verified training run. We aren't claiming a fine-tuning improvement.

## Three-minute cut

Use slides 1, 3, 5, 6 and 8. Allocate 20, 25, 75, 35 and 25 seconds respectively. This includes a shorter limitation statement at the close.

**Slide 1**

> A correct final answer can still hide a gap in reasoning. We're building Verity so students can check their work against their instructor's expectations before handing it in. Nemotron assesses individual rubric criteria, and TAs keep the final decision. That's the workflow we're testing.

**Slide 3**

> These fictional answers show the behavior we want. The same answer can meet an answer-only rubric and fail a justification requirement. Another valid method should still pass. Our LoRA experiment targets those distinctions, using explicit labels and holding out entire problem families for evaluation.

**Slide 5**

> This rubric requires a derivation. The fictional student gave the right values but omitted the work. I'm submitting it now. The expected flag is missing justification.

Pause and react using the live-demo branches. Show one revision and the TA view if time allows.

> Here's the original work beside the criterion. The TA can inspect the evidence and decide what credit to award.

**Slide 6**

Use the current pending-results wording or the verified-results replacement above. Never imply that a comparison has been run merely because the table exists.

**Slide 8**

> Our next step is one instructor-approved practice assignment. We'd test whether students can use the hints and whether TAs trust the evidence. Handwriting and real classroom work still need validation. The goal is useful feedback while there's still time to revise.

## Research framing

| Claim | Evidence that can support it | What it cannot establish |
|---|---|---|
| The base model misses a requirement | Saved base output, rubric, label and exact input | That all Nemotron models share the failure |
| Fine-tuning improves rubric decisions | A versus B with identical inputs, settings and test set | That new prompts or postprocessing caused the gain |
| Software controls reduce exposed answers | B versus C, measuring raw and displayed output separately | That the model stopped generating answers |
| The app helps users | Observed student/TA tasks with an approved protocol | Learning gains from a synthetic demo |

Use a development set to choose prompts and checkpoints. Freeze them before running the final test. Group variations and revisions of the same problem together. The eight illustration records use one problem family and stay outside both training and scored testing.

Define each denominator before running. Report criterion accuracy by error category as well as overall. For false flags, count the correct-work cases falsely flagged out of all correct-work cases. For missed errors, count seeded issues the model missed out of all seeded issues. Count unreadability referrals separately from mathematical errors. Report refusals, malformed output and timeouts so filtering cannot silently improve the score.

Log base model ID/revision, tokenizer/template, data hash, family split, training configuration, random seed, compute, duration, adapter hash, inference settings and rubric version. Record labels before looking at predictions. Avoid repeated tuning against the final test set.

## Improvements and residual gaps

| Gap to investigate | Intervention | Expected mechanism | Test | Residual gap |
|---|---|---|---|---|
| Missing rubric requirements | Supervised LoRA on criterion decisions | Learns the requested assessment format and decision patterns | Same input, base versus adapter | Can learn dataset shortcuts |
| Rejecting valid alternative work | Verified alternative solutions in training | Teaches broader valid evidence | Hold out new solution approaches | A few methods do not cover all valid math |
| Insensitivity to rubric changes | Matched work with different explicit rubrics | Makes rubric dependence visible | Paired assessments on held-out families | Conflicting or vague rubrics remain hard |
| Answer leakage | Bounded student templates and field allowlists | Restricts what the application exposes | Inspect raw and shown output separately | Useful hints can still reveal too much in context |
| Extraction errors | Page provenance, clear reading-failure state and review | Preserves the evidence and avoids forced grading | Same work as verified text and real image | Handwriting errors may remain undetected |
| Unclear educational benefit | Instructor-approved pilot | Tests whether feedback helps revision | Student tasks and TA review, then a separate learning study | Better scores alone do not prove learning |

All interventions are proposed until implementation and checks establish otherwise. A second model agreeing with the first is not ground truth. Use deterministic math checks where the supported task allows them.

## Judge questions

**Why fine-tune when prompting might work?**

> Prompting is our baseline. Fine-tuning is worthwhile only if the controlled comparison shows better decisions or another measured advantage. We keep the prompt-only path so we can answer that question directly.

**Why NVIDIA Nemotron?**

> It gives us open model weights and a documented adaptation path. That lets us run a controlled adapter experiment and inspect exactly which checkpoint serves the product. We're measuring whether it fits this task.

**Does the model learn each professor automatically?**

> The instructor's rubric goes into each request. The adapter learns the general assessment behavior. New uploads and TA corrections don't automatically change model weights.

**How do you know your dummy data is right?**

> We wrote explicit labels and checked the elementary arithmetic in these examples. They still need instructor review. Synthetic data gives us controlled cases, but it doesn't replace testing on representative student work with permission.

**How would you get people to use it?**

> We'd start with one instructor who wants feedback on a practice assignment. They choose the allowed hints, and TAs retain review. We'd measure whether students use the feedback and whether reviewing its evidence helps staff before adding more courses.

## Before judging

Confirm the event's time allowance. Confirm which checkpoint the app actually serves. Replace pending fields only from logs, and update proposed features to their real status. Keep the original fictional file, its revision and the rubric ready in separate browser tabs. Rehearse once with a slow request and once with an incorrect answer. Verify that student-facing responses never include private staff fields. Use the appendix for detailed questions rather than trying to say everything in the main pitch.

## Sources

- NVIDIA model card: https://huggingface.co/nvidia/NVIDIA-Nemotron-3-Nano-4B-BF16
- NVIDIA training concepts: https://docs.nvidia.com/nemotron/nightly/train-models/explanation/basics.html
- NVIDIA model-specific LoRA recipe: https://docs.nvidia.com/nemo/megatron-bridge/nightly/models/nemotron/nemotron3-nano-4b.html
- SteelHacks track criteria: https://steelhacks.org/tracks

Sources support model/tool capabilities and sponsor criteria, not Verity performance. The base-model choice and fine-tuning run remain unconfirmed.

Related: [[README]]
