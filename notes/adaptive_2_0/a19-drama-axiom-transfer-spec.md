# A19 Drama-Axiom Transfer Specification

Status: implementation scaffold, zero-API slice.
Date: 2026-06-07.
Source plan: `teaching_drama_learning_plan.html`.
Canonical evidence source: `docs/research/paper-full-2.0.md` section 7.9.

## 1. Thesis

A19 treats adaptive tutoring as the induction and testing of **teaching-drama axioms**: typed, scope-bounded lessons about how a tutor should modify speech when learner resistance exposes an infelicity in a teaching drama.

The unit is not a transcript, prompt, hidden learner state, or global score. The unit is a contrastive record:

1. an attempt-1 tutor speech failure;
2. a public learner resistance signal;
3. a typed diagnosis of the infelicity;
4. a bounded replacement speech policy;
5. applicability and anti-applicability conditions;
6. held-out S0/S1 evidence showing whether policy memory changes the tutor's public repair.

## 2. Canonical A18 Evidence Inherited By A19

A19 does not create a new empirical record. It inherits A18 only as a design input from the canonical paper:

- A18 is bounded simulated counterfactual replay, not human learning or deployment evidence.
- The trusted A18 channel is the blind option arbiter, where target and decoy aliases are held out from critics and matched mechanically after judgment.
- The current canonical A18 result is 10 of 14 held-out siblings across seven frozen-protocol-admitted families in section 7.9.
- The important unit of analysis is per-card headroom, not family-level success.
- The four no-headroom cards are ceiling/self-solve cases: the no-policy tutor also reaches the target.

A19 therefore starts from the rule: **a policy helps only where S0 has real headroom and S1 applies the registered policy under a blind or mechanically auditable channel.**

## 3. Teaching-Drama Axiom Theory

A teaching-drama axiom has five required pieces:

| Piece | Meaning |
| --- | --- |
| Trigger | The public learner move and tutor-risk state that make the axiom relevant. |
| Avoided move | The old speech pattern that failed, such as validation without engagement or premature resolution. |
| Replacement move | The bounded rhetorical/dramaturgical speech edit to try instead. |
| Applicability | Conditions under which the policy should fire. |
| Anti-conditions | Conditions under which the policy must not fire. |

The axiom is evidence-bearing only when it also includes provenance:

- attempt-1 failure source;
- public transcript spans or fixture references;
- held-out sibling IDs;
- blind adjudication basis labels;
- model or role scope;
- known failure modes.

## 4. Public-State Ontology Boundary

A19 formalizes public drama state, not a privileged learner interior. The first protocol tracks:

- learner resistance type;
- tutor infelicity type;
- tutor felicity or repair type;
- old-rule decoy;
- target policy;
- plausible public repairs;
- cue-map risk;
- target and decoy aliases;
- blind-adjudication basis labels;
- headroom verdict.

This keeps the hidden-interior nulls from being smuggled back in as an ontology. The ontology names what is enacted in public dialogue.

## 5. Protocol

The initial implementation is deterministic and zero-API:

- `config/teaching-drama-axioms/a19-protocol.yaml` freezes the protocol shape, non-claims, verdict vocabulary, and reporting discipline.
- `config/teaching-drama-axioms/pilot-families.yaml` provides fixture-level families and card adjudications for offline validation.
- `config/teaching-drama-axioms/CHANGELOG.md` records substantive gate changes before additional real S0/S1 generation.
- `scripts/validate-teaching-drama-axiom-protocol.js` validates protocol and family fixtures.
- `scripts/materialize-teaching-drama-axiom-attempts.js` materializes attempt-1 transcript stubs, axiom templates, held-out S0/S1 fixture stubs, A18 recursive-replay commands, and A19 fixture blind-adjudication commands.
- `scripts/report-teaching-drama-axiom-attempt1.js` summarizes A18 replay manifests as A19 attempt-1 gate decisions, separating fixture survivors from empirical survivors and stopping before S0/S1 when old-rule misclassification is not confident.
- `scripts/induce-teaching-drama-axiom.js` distills a survived attempt-1 artifact into exactly one typed axiom and rejects full replay bundles as S1 memory.
- `scripts/blind-teaching-drama-axiom-adjudication.js` provides both the deterministic fixture alias reader and the real free-text, alias-withheld, post-hoc-mapped repair extractor for generated transcripts.
- `scripts/run-a19-stability-screen.js` reruns selected real S0/S1 cards across seeds and summarizes whether apparent headroom is stable before any multi-critic or sidecar escalation.
- `scripts/report-teaching-drama-axiom-framework.js` emits a Markdown or JSON framework report.

Hard boundary: A19 S1 policy memory must be one admitted `a19-teaching-drama-axiom-v0.1` record. A whole replay `revision.json`, move ledger, or transcript bundle may diagnose the failure, but it cannot count as an axiom-transfer input or support an A19 transfer claim.
- `tests/teachingDramaAxiomProtocol.test.js` pins the validation and classification behavior.

Each family cue map must state model-tier scope and domain scope. This keeps
self-solve, cue-leak, and headroom readings tied to the model/domain conditions
under which they were observed instead of turning local screens into global
claims.

Held-out siblings may define their own learner-resistance line. When present,
the materializer must use that held-out line rather than the training-seed
resistance, so S0/S1 screens are not accidentally cued by the training episode.

For `transfer_control` cards, the blind adjudicator must distinguish a tutor
who merely names the warrant from a tutor who makes the learner apply a repaired
rule or check to a fresh/concrete public case before closure. The current
free-text mapper includes a conservative transcript-backed calibration for this:
the target type must already be `transfer_control`, the tutor must publicly
prompt a try/apply/check action on a concrete case, and the learner must then
apply it. This protects against false headroom when S0 already performs the
action gate.

This is not paid attempt-1 generation, a live S0/S1 runner, a paid blind panel, or a post-training corpus. Those are later gates. The materializer is a deterministic bridge into the existing A18 recursive tutor-learning machinery; it writes commands rather than calling models.

## 6. Evaluation Instruments

The first report must classify every card into exactly one verdict:

- `policy_headroom`;
- `ceiling`;
- `policy_failure`;
- `cue_leak`;
- `self_solve`;
- `arbiter_disagreement`;
- `neither_correct`;
- `protocol_reject`.

The report may count verdicts, but it must not present a pooled success rate without the card-level basis labels and denominator separation.

The report can also emit JSON into `exports/a19/reports/` for downstream audit
and atlas plumbing. JSON reports carry the same denominator discipline as the
Markdown report.

Later instruments, after the protocol is frozen, are:

1. paid attempt-1 failure elicitation using the materialized prompts and the A19 attempt-1 gate report;
2. real S0/S1 held-out contrast paired by model, scenario, length, and policy payload, only after attempt-1 survival;
3. paid blind adjudication modeled on `scripts/blind-option-adjudication.js`;
4. stability reruns for cards where headroom appears structural;
5. human expert double-coding for the highest-value claims.

Current status after the first stability smoke: two n=1
`surface_agreement_uptake` positives (`surface_agreement_uptake_c`,
`surface_agreement_uptake_e`) failed to reproduce under a two-seed stability
rerun (`0/2` headroom for both; artifact:
`exports/a19/stability/surface-agreement-uptake/a19-stability-summary.json`).
An additional logarithm candidate (`surface_agreement_uptake_f`) collapsed to
`ceiling` after transfer-control calibration because S0 already used a fresh
numeric recombination check. A proof-by-examples candidate
(`surface_agreement_uptake_g`) also collapsed to `ceiling` because S0 used a
standard counterexample and arbitrary-case gate. A random-sampling candidate
(`surface_agreement_uptake_h`) and a consent-under-pressure counter-warrant
candidate (`counter_warrant_scope_c`) also collapsed to `ceiling` under S0-first
screening. Therefore A19 currently licenses a framework and a
negative/stability-boundary result, not a stability-confirmed transfer claim.
The current admitted-axiom near-neighbor cards are operationally exhausted until
the evidence unit changes.

## 7. Sidecar Paper Scaffold

The sidecar paper is a derived atlas-compatible artifact, not an independent source of claims. Its outline should be:

1. Thesis: teaching-drama axioms as the unit of tutor learning.
2. Atlas evidence: A18 inherited from Paper 2.0 section 7.9.
3. Theory: tutor-as-learner, learner resistance as supervision, and policy headroom.
4. Literature positioning: how A19 leans on and differs from existing post-training and education-agent work.
5. Protocol: zero-API fixture validation, later blind adjudication, and human validation gates.
6. Evaluation instruments: card-level verdicts and denominator discipline.
7. Claims not licensed.
8. Future post-training ladder.

Before any empirical claim appears in this sidecar, it must first land in `docs/research/paper-full-2.0.md`. Once canonical prose exists, the atlas module may project that section; it still must not introduce sidecar-only results.

## 8. Claims Not Licensed

A19 inherits A18's boundaries. It does not license:

- human learning;
- deployed adaptive tutoring;
- model-weight learning;
- a main-harness rate effect;
- a general adaptive-slope effect;
- broad curricular transfer;
- a claim that dramatic form alone causes learning.

## 9. Future Post-Training Ladder

Post-training is deliberately downstream. It becomes justified only after a validated axiom corpus exists:

1. preference pairs from felicitous vs infelicitous speech under the same public state;
2. process labels for diagnosis, avoided move, replacement move, and uptake test;
3. axiom-memory records with applicability and anti-conditions;
4. prompt/pipeline optimization on stable axiom metrics;
5. DPO/SimPO or process-reward experiments;
6. SEAL-style self-edits only if the reward object survives Goodhart checks.

The current implementation stops before this ladder.
