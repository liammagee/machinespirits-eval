# Program 2 weights × interface factorial — pre-registration

Status: **DESIGN FROZEN 2026-07-24; NOT A LAUNCH LICENSE.** This document was
written after the Amendment 4 floor-ablation cohort ended and after its frozen
analysis, post-hoc mediation report, and read-only model-provenance audit were
generated. No successor dialogue has been generated. Implementation must be
completed and checked under a new clean commit before a launch decision.

Parent artifacts:

- `exports/program2-committee-floor-ablation-amendment-4/analysis.json`
- `exports/program2-committee-floor-ablation-amendment-4/mediation-analysis.json`
- `exports/program2-committee-floor-ablation-amendment-4/provenance-audit.json`
- `notes/program-2/2026-07-24-floor-ablation-interface-diagnosis.md`

The user's existing authorization covers sending the planned experiment's
prompts, learner-profile briefs, dialogue histories, and generated public
transcripts to the configured Sonnet and Terra providers. That data-sharing
authorization does not waive the clean-SHA, smoke, checkpoint, or explicit
launch gates below.

## 1. Motivation and boundary

The completed floor ablation is confirmatorily
`incomplete_or_under_informative`: 24/30 jobs sealed, with differential
attrition (trained 4/12, untuned 1/12, control 1/6). Its frozen W1 interval
cannot license a claim of training benefit, practical equivalence, or harness
sufficiency.

The separate post-hoc mediation report gives a strong design signal among
sealed dialogues. The trained mini used the frozen cue in 45/55 raw moments
(0.818) versus 40/80 (0.500) for the untuned mini, while it was less likely to
produce exactly one question (38/55 versus 69/80). Frozen v1 extraction lost a
raw cue at 22/55 trained moments versus 13/80 untuned moments. A deterministic,
non-generative v2 span retained the cue-plus-one-question conjunction at 42/55
trained moments versus 39/80 untuned moments. Final delivery then largely
equalized the arms (frozen full compliance 14/55 versus 24/80) after overwriting
52/55 and 65/80 committee-approved envelopes respectively.

Those observations are exploratory and conditional on sealing. They motivate
this experiment; they are not imported as confirmatory evidence.

## 2. Question

Does the trained same-lineage mini produce a stronger semantic warrant move on
its first pass, and does a cue-preserving but non-generative interface transmit
that skill more faithfully than the historical question-only interface,
without relying on a cue-aware rescue policy?

The experiment separates:

1. **skill** in the mini's raw first draft;
2. **transmission** through deterministic span extraction and frontier
   composition;
3. **correction burden** imposed by nuisance-only checks; and
4. **final operational value** after the ordinary tutor response pipeline.

## 3. Factorial design (48 dialogues)

One Marrick world × two learner profiles (`proof_skipper`,
`affective_resistant`) × two mini-weight levels × two interface levels × six
repeats per profile/cell:

| Cell | Mini weights | Interface | Dialogues |
|---|---|---|---:|
| `trained_v1` | `program2-sft-instruct-v2` | frozen question-only v1 | 12 |
| `trained_v2` | `program2-sft-instruct-v2` | cue-preserving, non-generative v2 | 12 |
| `untuned_v1` | `program2-floor-instruct-q8` | frozen question-only v1 | 12 |
| `untuned_v2` | `program2-floor-instruct-q8` | cue-preserving, non-generative v2 | 12 |

Each `<profile>:r<repeat>` forms a four-cell matched block. Jobs are interleaved
by a seeded Fisher-Yates shuffle, seed **20260725**. Bootstrap draws use seed
**20260726**. There is no silent-control arm: this experiment estimates the
weights main effect, interface main effect, and their interaction, not an
absolute advantage over a frontier-only tutor.

## 4. Frozen treatment seams

All non-factor seams remain common across cells: `world_005_marrick`, the
frozen point-of-action detector and warrant audit, profiles, prompts, run
settings, public-evidence state, Sonnet speaking tutor, Terra learner/support
roles, context length, token limit, and downstream response guards.

### Weight factor

- trained: `program2-sft-instruct-v2`;
- untuned: `program2-floor-instruct-q8`.

Before launch, the provenance audit must again prove distinct Ollama model
layers, the shared `{{ .Prompt }}` template, empty system layer, Q8_0 serving,
Phase 4 report hashes, and runtime pins. Greedy first drafts use temperature 0,
`num_ctx=16384`, `think=false`, and `num_predict=4096`.

### Interface factor

**v1** reproduces the historical question-only extraction: collect all valid
`?`-terminated question sentences in source order.

**v2** is deterministic and non-generative:

1. choose one question sentence, preferring a cue-bearing question;
2. if no question bears a frozen cue but an existing statement does, carry the
   first cue-bearing statement immediately before the chosen question;
3. otherwise choose the first question; and
4. report `no_span` if no valid question exists.

v2 may preserve an already-authored cue; it may not invent, paraphrase,
resample, or solicit one.

### Cue-blind composition and fallback

The frontier composer gets one call and must preserve the selected span
verbatim. Its pre-delivery checks are nuisance-only: non-empty output, verbatim
span containment, exactly one question, public-evidence safety, and no new
premise. No check, retry, trim, selection, repair, or fallback may inspect the
six-word cue or the semantic warrant-validity outcome.

If there is no span or composition fails a nuisance check, deliver the original
mini reply as the first-draft envelope and record the failure. There are no
mini resamples. The ordinary downstream response pipeline remains common to
all cells, but the zero-model gate must prove that none of its programmatic
accept/reject decisions reads the cue detector. If that cannot be proved, the
launch is blocked.

## 5. Outcomes

All outcome surfaces are retained: raw mini, selected span, raw composition,
committee-approved envelope, and final learner-facing tutor turn.

### Primary: W1 first-pass semantic skill

At each `warrant_skip` moment, a blinded semantic instrument asks whether the
raw mini turn makes a bounded move that asks the learner to connect already
public evidence to an inference, licensing rule, or missing warrant. The
instrument does **not** require any member of the six-word lexicon.

Two independent blinded judges score each raw turn. They receive public
history and the candidate turn, but no model, condition, interface, source, or
fallback labels. Disagreements receive a condition-blind human adjudication;
raw judge votes remain in the artifact.

W1 is the trained-minus-untuned semantic-validity rate, averaged over interface
cells with equal cell weight. The unit of resampling is the dialogue, blocked
by the four-cell match and stratified by learner profile (5,000 bootstrap
draws). Training contribution is detected only if the 95% CI lower bound is
greater than zero. Practical equivalence requires the whole interval inside
[-0.10, +0.10]. Otherwise W1 is indeterminate.

### Secondary mechanism outcomes

- **W2 raw frozen-cue rate:** trained minus untuned at the raw surface. This is
  a registered mechanistic component, not a substitute for W1.
- **I1 semantic transmission:** among raw semantically valid moments, whether
  the selected span remains semantically valid. Report the v2-minus-v1 main
  effect and the weights × interface difference-in-differences.
- **I2 deterministic transmission:** cue retention, exactly-one-question,
  cue-plus-one-question, no-span, text containment, and overwrite at every
  surface.
- **B1 correction burden:** no-span rate, composer rejection, original-mini
  fallback, downstream repair/fallback, latency, and model-call count.
- **O1 final operational compliance:** the frozen point-of-action audit at the
  final learner-facing turn. Report all four cells and the factorial contrasts.
- **O2 final semantic validity:** the blinded semantic instrument applied to
  final turns, separately from frozen lexicon compliance.
- **A1 attrition/failure:** terminal attrition, retry reason, interrupted trace,
  and failure turn by cell. Failed attempts are never pooled with sealed
  dialogue outcomes.

Coverage@16, hard safety, public-evidence leaks, and costume leakage remain
guardrails. They cannot turn an indeterminate primary endpoint into a positive
claim.

## 6. Completion and missingness gates

The launcher allows at most one same-seed retry per job and no replacement
jobs. A confirmatory reading requires all of the following:

- at least 10/12 sealed dialogues in every cell;
- at least eight complete four-cell matched blocks, with both profiles
  represented by at least four complete blocks;
- at least 60 `warrant_skip` opportunities per cell and at least 20 per
  profile/cell;
- no weight contrast within either interface differs in attrition by more than
  one dialogue; and
- provenance, coverage, safety, cue-blind-enforcement, and trace-integrity
  gates pass.

If a gate fails, the result is `incomplete_or_under_informative`. Sealed-trace
rates may be reported descriptively and explicitly conditional on sealing, but
no factorial attribution is licensed.

## 7. Reading grammar

| Result | Licensed reading |
|---|---|
| W1 positive | Trained weights improve first-pass semantic warrant skill across the two frozen interfaces. |
| W1 positive + positive I1 interaction + trained final gain only under v2 | The trained skill is real but its operational value is interface-mediated; v1 masks more of it. |
| W1 positive + no final gain under either interface | Training changes first-pass skill, but downstream composition/release still prevents operational value. |
| W1 equivalent | No material first-pass semantic skill difference is detected within ±0.10 under this design. |
| W1 indeterminate | The trained-weights increment remains unresolved; do not infer equivalence. |
| W1 non-positive but W2 positive | Lexical cue training did not establish the registered semantic skill endpoint. |
| Any completion/missingness/provenance gate fails | Incomplete/under-informative; no confirmatory factorial claim. |

An interface main effect is a claim about transmission machinery. It is not
credited to the mini weights. A final-system effect is credited jointly to the
mini, interface, and common downstream pipeline.

## 8. Implementation, smoke, and launch gates

1. Implement the v1/v2 interface switch and a cue-blind fallback ledger after
   this document is committed.
2. Add unit fixtures for every v2 case, explicit tests that enforcement code
   cannot access the cue detector, four-cell plan balance, fixed seeds,
   trace joins, retry/attrition reconciliation, and analyzer reading grammar.
3. Run the full zero-model gate and the read-only provenance audit.
4. Run a local-mini-only prompt/interface smoke. It is excluded from all
   endpoints.
5. Run one four-cell paid smoke block under separate trace roots. It is also
   excluded and must pass model routing, prompt audit, trace sealing, and
   cue-blind enforcement before the cohort can start.
6. Record a new clean 40-character SHA, output root, estimated provider call
   ceiling, and explicit launch decision. Do not mix smoke or prior traces into
   the 48-dialogue cohort.

The current document licenses design and implementation work only. It does not
license starting the paid smoke or cohort in the same change set.

## 9. Scope

Single world, tutor family, two profiles, two same-lineage mini artifacts, and
two deterministic interfaces. Out of scope: retraining, KTO, new cue words,
threshold tuning after trace inspection, historical pooling, replacement
dialogues, a new transfer world, or changing the downstream tutor policy to
recover an expected result.
