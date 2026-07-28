# Program-2 Phase 5f — fresh-world apparatus-hardening pilot pre-registration

Status: **PRELAUNCH FREEZE** on branch
`codex/program-2-phase5e-r2-replication` (2026-07-28). This document freezes a
four-dialogue feasibility pilot only. It does not authorize external payloads,
the paid pilot, an 18-dialogue cohort, seam review, or any empirical claim.

## 1. Purpose

Phase 5e's Skyway sequence became an apparatus-debugging sequence: A1-A4
identified premature closure, an incomplete generic missing-premise recovery
path, duplicate authored-clue uptake, and loss of a valid committee cue when a
generic question span was selected from a longer mini response. Those runs are
immutable feasibility evidence and are not estimates of transfer.

Phase 5f asks the next clean question: after repairing those general runtime
seams, can the unchanged Program-2 committee and its fresh silent control both
complete the exact pipeline on a genuinely unused post-training world? The
four-row pilot tests feasibility and instrumentation. It cannot establish a
treatment effect.

## 2. Artifact under test

The tutor remains `claude-code.sonnet-5`; learner, learner-record, and
classifier seams remain `codex.gpt-5.6-terra`; the local committee remains the
pinned `program2-sft-instruct-v2` model through Ollama; committee fallback
policy remains `v2`; the historical evidence-use audit remains `v1`; profiles
remain `proof_skipper` and `affective_resistant`; and arms remain `committee`
and `silent_control`.

The only apparatus changes relative to Phase 5e A4 are generic and tested:

1. a deterministic public-surface question for the next
   `released_but_not_held` premise when no authored integration repair exists;
2. hard rejection of a verdict or closing turn while the strict proof DAG is
   open;
3. idempotent fallback uptake when a due authored clue already carries the
   same premise; and
4. preservation of a cue-bearing complete committee turn when its isolated
   question sentence would discard the cue.

No world-specific Phase 5f repair is allowed after this freeze. A failure may
be diagnosed, but any source change requires a new pilot suffix and a fresh
certificate.

## 3. Fresh-world selection

The eligible source pool is worlds 029-031, all introduced by commit
`532331061e458bc200b5b9e129fc10b780653951` on 2026-07-25, after the Program-2
training and original experiment freeze. A candidate is excluded if tracked
code already uses it as a tutor-behaviour, apparatus-repair, or live-evaluation
fixture. Presentation/catalog validation alone does not expose treatment
behaviour.

- `world_029_riverside_clinic` is excluded because the apparatus-hardening
  regression now uses it as a non-Skyway missing-premise replay.
- `world_030_rowan_flat` is excluded because existing tutor response-composition
  and scene-diction suites use it as a behavioural fixture.
- `world_031_tideway_makerspace` is selected. Its only pre-freeze tracked use is
  generic world-presentation validation; it has no Program-2 dialogue,
  treatment, repair, or live-evaluation exposure.

Machine-readable evidence is frozen at
`config/adaptive-tutor-evidence/program-2-phase5f-world-selection.json`. The
selected world has source SHA-256
`205338e337ad140b8d64158b84432b4288cfeda5ce9f1c3f797e72c0bdf074d3`, four
premises, three rules, one proof path, and authored reachability 1.0 by the
turn-16 horizon. It does not meet Phase 5e's separate five-rule
letter-hostility floor; that older floor selected for hostile diction, whereas
Phase 5f selects for non-exposure. The difference is explicit and the pilot is
therefore a feasibility check before any cohort decision.

## 4. Frozen pilot design

Four dialogues: one row for each profile × arm cell, ordered by seeded
Fisher-Yates with seed **20260728**. Runtime settings remain the frozen
Program-2 settings: strict DAG, bland register, safety horizon 40, primary
horizon 16, trigger window [3, 24], and detector
`step4-frozen-2026-07-14.v1`. The plan key is `5f-pilot`; the output directory
is `exports/program2-live-pilot-5f-pilot/`.

## 5. Feasibility gates and stopping rule

Proceed to design (not launch) an 18-dialogue cohort only if all four cells
seal, every row reaches at least 0.8 proof-path coverage by turn 16, every row
passes hard safety, no arm has excess attrition, and the traces permit direct
inspection of committee delivery plus the four repaired seams. Report
technical and pedagogical failures separately.

Any failed or unsealed row stops the pilot after the frozen one-same-seed retry
policy. Do not repair and resume under the same certificate. Null or adverse
treatment behaviour does not trigger futility; the pilot has no effect-size
endpoint.

## 6. Cost and authorization boundary

The certificate computes the hard provider-call and reserved-output-token
ceiling from the exact four-job plan, two attempts per job, and 40-turn safety
horizon. Actual use should be lower because grounded dialogues close early.
Certificate preparation and certification make zero model calls.

Before launch, the operator must separately authorize sending Tideway world
material and dialogue history to Anthropic through
`claude-code.sonnet-5`, and private simulated learner profiles plus dialogue
and classification payloads to OpenAI through `codex.gpt-5.6-terra`. The Qwen
committee remains local through Ollama. That authorization does not extend to
an 18-dialogue cohort or seam-review calls.
