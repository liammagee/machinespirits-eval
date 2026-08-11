# Semantic Audit + First Shadow Results

**Date:** 9 August 2026
**Status:** Working notes — answers the audit demanded by `normative-adaptive-dialogue-architecture.md` §4/§18/§19, plus first results from the Phase-1 trace-only prototype.
**Method:** direct reading of the tutor-stub runtime and its traces, plus two read-only codebase sweeps (DAG semantics; register ontology + PR 617 + Stage-1 freeze).

## 1. The §19 audit table, grounded

| Question | Existing implementation | Gap | Action |
|---|---|---|---|
| How is normative lesson progression represented? | Horn-clause worlds (`config/drama-derivation/*.yaml`): `premises[]` (clue leaves), `rules[]` (public lemmas), `secret`/`mirror`, `release_schedule[]` (authored turn + carrier per clue), `slope.t_min`/`aporia_window`, `turn_cap`. Enforced by `plotLint`, `scripts/lint-derivation-world.js`, `services/dramaticDerivation/pacing.js` (solvency, last-safe-turn), `services/tutorStubDialogueClosure.js` (closure). Per-turn obligations: `compileTutorStubTurnProgressionContract` + first-draft contract. | Norms are temporal/structural (when, who, solvency), plus per-turn obligations. No cross-turn pedagogical expectation ("after releasing p, expect the learner to voice X within k turns"). | extend |
| What descriptive dialogue state is stored? | Learner board (`grounded/belief_only/voiced_derived/...` fact statuses), `learner_dag_preflight` per turn (grounded, derivable, possible next derivations, hashed), post-run assessment with `bottleneck` labels, plus per-turn audits: live turn progression (uptake/development/handoff segments), repetition similarity, guard accounting, pacing signals. | Rich. Nothing missing for Phase 1 — the trace already carries the descriptive side. | reuse |
| How are failed repairs detected? | `tutor_response_fallback`, `tutor_response_guard_exhausted`, `tutor_response_mechanical_repair` events; uptake-audit issues; `program2StallAudit` (`stagnant_repeat`, frozen detector) in a separate subsystem; light-adaptation counter (`tutorStubLightAdaptation.js`, threshold 2–8). | Signals exist but none accumulate into a per-commitment evidence record; the stall auditor is not wired to any strategy/register decision. | extend |
| How are pedagogical figures represented? | Not represented. Nearest object: `actorial_parts` (`config/engagement-registers.yaml`) — per-turn, stance-coupled (e.g. satirist defaults to ironic/sarcastic stances). `action_families` (13 values) is the de-facto strategy level. | The design doc's "figure" maps best onto **action family** (see §3 below), not onto parts. Parts/stances are realization. | reinterpret |
| How are registers represented? | `engagement_stances` axis, ontology v5 (`register_ontology_version: 5`); edged stances `router_selectable: false`; manner is a *delivered realization* measured post hoc (`registerMannerPresence.js`, `registerStanceFidelity.js`), not an axis. | Clean. Reuse as-is. | reuse |
| What does PR 617 add? | Manner block appended to the tutor ego prompt after the persona (`buildTutorMannerBlock`), fixing prompt-isolation loss (irony died pre-ship); `dump-turn-prompts.js`; first switching-prereg draft. | Delivery path fixed; decision path untouched. | reuse |
| Which decisions are already logged? | Release ledger rows (turn, premise, via, optional declared reason), pacing updates with typed signal + reason string, register/policy composition changes, first-draft contracts, all audits. | Two holes: **hold decisions leave no artifact** (engine explicitly skips them), and no decision records *warrant* — reason strings are canned regex output, not evidence. | new |

## 2. What was genuinely absent at the initial audit (the layer then built)

Confirmed by grep and by both sweeps:

- **No defeaters anywhere.** `defeater|undercut|rebut` appears only as prompt prose (cell 192, id-director prompt). The chainer is monotone; rules have no exception conditions; nothing can be authored as "this commitment fails if X".
- **No commitment object binding behaviour.** `services/dramaticDerivation/strategyLedger.js` has the right shape (`register, releasePosture, exitCondition, persist|adjust|switch`) but is advisory by contract — it may never gate a release or repair. Closed arc: do not rebuild its overlays; the shape is still the right template for a *typed record*, not a control channel.
- **No expected-uptake events.** `exit_condition` is free text checked by regex. Nothing predicts a DAG state ("learner voices `failedThrough(...)` by turn N") that later evidence could satisfy or defeat.
- **No warrant threshold at any switching decision.** The register router (`engagementModeRouter.js`) is a one-turn regex chain — exactly the "shift on a single negative signal" the design doc rules out. The only hysteresis switch in the repo is `tutorStubMannerSwitch.js` (accumulator, on-at-2/off-at-0) — the right pattern, wrong object (manner cards).

## 3. Terminology mapping (design doc → repo)

| Design doc | Repo object | Note |
|---|---|---|
| Normative trajectory | world YAML + `release_schedule` + slope + closure conditions | temporal/structural only |
| Descriptive trajectory | learner board + preflight + live audits | already trace-complete |
| Commitment | `action_family` held across turns (derived); strategy-ledger fields (advisory) | nothing holds it today |
| Warrant | — (audited post hoc in `tutorStubWarrantPremiseAudit`, content plane only) | absent on the interactional plane |
| Defeater | — | absent everywhere |
| Pedagogical figure | ≈ `action_family` (13 values) | NOT `actorial_parts`; parts are performance |
| Register | `engagement_stance` (v5 axis) | reuse |
| Linguistic device / manner | manner presence, measured post hoc | not an axis; keep it that way |
| Divergence engine | partial: pacing signals, stall audit, uptake audit — unaggregated | new aggregation layer |
| Adaptive trace (§14) | derivable from existing trace events | see §4 |

## 4. Phase-1 prototype: `scripts/derive-adaptive-warrant-shadow.js`

Trace-only, no behaviour change, no model calls. Replays a `.tutor-stub-traces/*.jsonl` and derives per tutor turn: the held strategy commitment (action family + streak), its realization (stance/part/tactic), warrant evidence (DAG growth, clean uptake, low repetition), defeater evidence (no growth, uptake issues, high repetition, guard/fallback events, pacing decel), typed divergence rows (conceptual/interactional/pacing with magnitude + persistence), a threshold warrant verdict, and the comparison with what the stub actually did next turn (`warranted_and_revised` / `warranted_but_held` / `revised_without_warrant` / `aligned_hold`).

First results on two real July sessions (18- and 17-turn traces):

1. **Failing strategies are held past warrant.** In both traces `reanchor_public_evidence` was held 4 consecutive turns with zero learner-record growth. The warrant threshold (2 defeater-bearing turns) crossed at streak 2; the stub revised at streak 4 in one session (`warranted_and_revised`, two turns late) and never in the other (`warranted_but_held` to session end).
2. **Realization churns while the commitment holds.** Under the held strategy, stance jittered warm→plain→warm→precise. The per-turn selector varies register freely while the strategy stays fixed — supporting the doc's two-level claim, and giving the shadow a clean definition: revision = family change; churn = realization change.
3. **The representation explains existing sessions** — every verdict above was computed from events the stub already logs. Phase 1's question ("does the representation explain existing conversations?") gets a provisional yes.

Caveats: v0 thresholds are guesses; commitment = action family is an interpretive choice; the `dag −1` observed once (turn 5, trace 2) needs explanation before the growth signal is trusted; one trace file can hold several sessions (settings restarts) and segmentation is heuristic.

## 5. Proposed next steps at the initial audit

1. **Gold-annotate the two replayed sessions** (§17 corpus, items 1–2): DONE — see `gold-annotations-first-corpus.md`. 7 of 11 decision points agree with the shadow; the three disagreements are an evidence-window timing artifact and two productive-divergence over-calls. The corpus turned out to cover §17 items 1, 2 AND 4 (trace 2 turns 6–8 are a productive plateau). Borderline dialogues (item 3) still needed.
2. **Expected-uptake events as the first normative extension:** attach to each release an authored expectation (`voiced target fact within k turns`) — the world YAML already names the fact each premise supports; the chainer can compute which derivation a release unlocks. This turns "no_dag_growth" from a global stall counter into a per-release defeated expectation.
3. **Record hold decisions.** The engine skips them; the shadow cannot see "considered and rejected" revisions. One trace event fixes it.
4. **Only then** consider wiring a warrant threshold into a live decision (the manner-switch accumulator pattern, applied at the action-family level) — as a cell against the uninstrumented stub, per §15.7.

## 6. Implementation progress (2026-08-10)

The sequence above has now advanced through the pilot form of Phase 5:

- the original, held-out, and second-annotator corpora exercise the trace-only
  warrant representation, including productive divergence and low-agency
  deferral;
- shared offline/live warrant rules and a typed repair-policy map keep diagnosis
  separate from action-family and stance realization;
- observe and active runtime modes record every gated hold/revise decision, and
  completed-turn outcomes feed the next decision without leaking future
  evidence;
- the paired off/observe/active baseline harness has completed a valid n=5
  generation and downstream-analysis pass.

The independent annotation sequence is now complete and it triggered the stop
rule. The primary sample scored precision/recall 0/0. A bounded repair reached
15/15 retrospectively but again scored 0/0 on a fresh zero-overlap holdout, so
it was rejected and reverted. The misses show why authored expected uptake is
not optional: the state must represent both successful repair termination and
an unresolved request for a particular public comparison. Accumulated generic
trouble cannot tell those apart.

The action-family obligation described here was subsequently implemented and
tested. The fresh gate then exposed a second, cross-family normative object:
public result debt created by a learner request. The current implementation and
the correction to that gate's closure interpretation are recorded below.

Any downstream comparison must still control frontier-model draw variance;
the inert observe arm moved as much as or more than active on learner-record
growth. The n=10 paired-seed comparison remains stopped rather than merely
pending.

## 7. Successor semantic audit and implementation (2026-08-10)

### 7.1 Correction to the burned typed-contract corpus

The typed-contract study's two consensus `close_inquiry` labels were produced
without the release-availability facts required to judge whole-inquiry
completion. Case 007 had a clue due at that decision and five later releases;
case 011 had no clue due on that turn but six future releases, the next at turn
8. Both learner-DAG assessments were unentailed and unasserted with a
`release_or_pacing_gap`. The labels remain part of the historical score but are
not terminal-closure gold.

This narrows the finding. The corpus does not demonstrate that the normal
Marrick inquiry should have closed. It does demonstrate public obligation debt:
one learner directly requested a touchstone result, and another result request
survived an intervening tutor move. The implementation therefore preserves the
ledger work and refuses to tune closure to a fixed eight-turn horizon.

### 7.2 Persistent public-obligation ledger

`services/adaptiveWarrantPublicObligationLedger.js` now provides a deterministic
public-surface reducer shared by live selection and replay. It distinguishes:

- `tutor_directed_public_result_request`, which creates tutor-owned debt;
- `learner_proposed_test`, which does not;
- criterion and tutor-selection questions, which also do not create result
  debt;
- withdrawal and transfer-to-learner acts, which may close one matching or
  oldest blocking obligation.

Each obligation records a public target signature, creation turn, response due
turn, reminders, occurrences, status, last delivery audit, satisfaction turn,
and event history. Open debt persists across action-family changes. A matching
public answer satisfies it. A deferral is accepted only when the tutor names
the target's present unavailability, gives a concrete public next condition,
and contains no question; otherwise the debt becomes overdue or
reactivates. Target identity comes from public learner text; delivery is checked
only against public tutor text and delivered public evidence.

In active mode the resulting directive is not prompt advice alone. It compiles
into the first-draft and turn-progression contracts: the target-specific answer
or deferral owns the uptake, must precede any unrelated due source, forbids a
question handoff, and is checked by both structured-composition and live-text
audits. A due clue may still be delivered after the obligation is handled; it
may not replace or redirect the answer.

### 7.3 Inquiry completion as a terminal transition

`services/adaptiveWarrantInquiryCompletion.js` projects the existing DAG,
closure, and release semantics into
`machinespirits.adaptation-refinement.inquiry-completion.v1`. Its public-safe
availability object uses counts rather than future clue identities and applies
one decision-time rule consistently: a clue delivered on tutor turn N is still
due, not already available, at decision N.

Normal whole-inquiry completion requires strict grounded-and-asserted learner-
DAG closure plus a known, exhausted authored release scope. An explicitly
authored bounded-scope contract may license a supported proof-limit conclusion,
but only when its scope is exhausted, its terminal outcome is asserted,
released evidence is integrated, and the proof limit is preserved. Release
exhaustion alone, `dueNow=[]`, sample position,
safety cap, or local conversational completion never licenses closure. Any
unresolved public obligation, unsupported assertion, active dropped fact, or
unintegrated released evidence are blockers.

A successful assessment emits `decision_kind=terminal_transition` and licenses
`close_inquiry`. It is a lifecycle transition, not evidence that the current
repair family failed. Entailed-but-unasserted state remains distinct and does
not close.

Active mode enforces the typed object at both selection and lifecycle levels.
If the legacy DAG-only selector proposes `close_inquiry` while the typed object
is open, the gate emits a `candidate_safety_override` to a safe nonterminal
family. The older dialogue-closure frame is also constrained from
mandatory/available back to open, so it cannot reintroduce the premature close
downstream. Observe mode only records this counterfactual and does not alter
the family or closure frame.

### 7.4 Transition entitlement versus intervention need

The live gate now records three deliberately separate values:

- `revision_warranted`: compatibility summary that some normative change or
  fulfilment is required;
- `commitment_transition_warranted`: the recommended family differs from the
  prior delivered family;
- `current_candidate_override_required`: the recommended family differs from
  the base response configuration already proposed for this decision.

Only the third licenses an active family/stance override. A result request can
therefore warrant leaving `stage_next_step` while requiring no override when
the ordinary selector has already proposed `answer_accountably`. If
`answer_accountably` was already in force, the tutor may persist with an
obligation directive without manufacturing a strategy switch. The same split
also prevents a terminal transition that the base selector already selected
from being counted as a forced override.

### 7.5 Trace, resume, and replay parity

The typed decision and obligation directive enter response-configuration
selection before tutor generation. Completed turns persist the actual delivered
family, public tutor text, delivered releases, public-obligation projection,
inquiry-completion projection, and final turn outcome. Resume rebuilds the gate,
action-contract tracker, and obligation ledger by replaying committed public
turn records. The offline shadow consumes those same delivered configurations
and shared reducers, using the decision-time release projection rather than a
post-delivery future leak.

Every v4 decision also stores a canonical
`warrant-decision-input.v1` snapshot and SHA-256 digest: learner text and
classification, learner DAG, prior delivered and current proposed families,
closure frame, evidence availability, ledger state before the learner act,
prior tutor outcome, bounded scope, and each closure-blocker input. Resume and
replay prefer that frozen boundary, with historical turn-record reconstruction
only as compatibility fallback.

Parity is now structural rather than only boolean: speech act, obligation rows
and blocker, completion checks, action-contract transition, decision kind,
warrant basis, policy, prior family, proposed candidate, commitment transition,
and override requirement must match. Legacy v1-v3 traces retain their old
boolean comparison and cannot be promoted to structured-parity evidence.

### 7.6 Fresh mechanism-validation boundary

The next evidence stage uses every observe decision from a fresh two-world,
six-profile, eight-turn matrix: 96 blinded decisions. Active runs provide
matched intervention execution and their own non-zero exact-parity denominator;
they do not enter the gold corpus. This is deliberately a mechanism test,
separate from downstream causal comparison. Every case freezes the public
opening text, situation/question, opening evidence, and requirements before the
transcript prefix and public-safe evidence counts; neither the secret nor future
evidence identity/content is revealed. Full protocol and gates are in
`baseline-comparison-design.md` and `remaining-next-steps.md`.

The execution and annotation boundaries are now machine-checked as well:
finite 64-call child admission, strict clean-commit authorization, sanitized
dotenv/Node/API environment, Codex wrapper/native fingerprints, sealed immutable
child recollection, globally shuffled opaque case IDs, and exact V3 response
field/type allowlists. A fake-provider capture across tutor, analyzer, learner,
and recovery roles removed one concealed Marrick example from the otherwise
generic learner-analysis rubric. These checks establish transport and evidence
integrity, not decision quality.

### 7.7 Accountable deferral is a public lifecycle state, not a one-turn timer

The third mechanism execution exposed an architectural ambiguity in the first
ledger implementation. A valid target-specific deferral was nonblocking only
until an automatic next-turn deadline, after which any unrelated tutor outcome
reactivated it. That treated elapsed turns as if they were a public speech act
or evidence event and made stale requests govern later dialogue.

The corrected semantics are event-based. `deferred` remains a live but
nonblocking public obligation. A target-matching public release may satisfy it;
an explicit learner reminder of the same target reactivates it; withdrawal or
transfer closes it under the existing rules. Mere turn passage and unrelated
tutor speech do not change its status. This keeps the ledger distinct from the
short-horizon action-family contract tracker and makes live/resume/offline
replay share the same public transition boundary.

Delivery ownership is likewise literal. When an active obligation and an
authored source coexist, the answer or accountable deferral must be the first
host sentence before that source. The terminal fallback now restores this
ordering after every semantic composition path, and the live audit checks the
actual public boundary rather than trusting an inferred uptake segment. These
are prospective mechanism corrections; the failed execution remains burned.

### 7.8 Deferred history, terminal entitlement, and owned delivery surfaces

The fourth mechanism execution separated ledger persistence from closure
entitlement more sharply. `open_count` intentionally includes `deferred`
obligations because they remain available for a matching release or explicit
reminder. That inclusive bookkeeping count is not a terminal blocker count.
Inquiry completion now derives its blocker only from actionable rows in state
`open`, `overdue`, or `reactivated`; a retained `deferred` row therefore does
not veto otherwise strict grounded-and-asserted closure. Historical snapshots
without obligation rows retain the conservative legacy fallback.

The same execution exposed an ownership error in semantic auditing. The
action-family axis owns uptake for accountable answering and the development
segment for next-step/closure work; it does not own a fixed authored source
quoted inside that segment. Visibility now uses the owned segment and computes
fresh metrics after applying the same authored-host projection already used by
stance and character audits. This prevents fixed source length or wording from
defeating the adaptive host, while also preventing source language from
impersonating the selected action.

Finite recognizers remain intentional, but their prospective vocabulary now
includes the observed target-specific public-only deferral and licensed
`incident log can now close` / `incident record is now closed` forms. The
deterministic deferral continuation is shorter, making the plain realization
visible without removing the first sentence's named availability condition.
These changes are covered by exact saved public surfaces. The fourth run itself
remains delivery-invalid and cannot be rescored into evidence.

### 7.9 Six-dimensional normative/descriptive projection

The fifth execution reached 24/24 valid children and 192/192 exact reducer
parity, but two delivery-audit false negatives kept it invalid. Exact authored
source prose was still counted against a direct-source host's plain stance,
and the finite closure grammar missed a same-sentence `final record ... close
it` realization. Source spans are now excluded from host-owned metrics whether
or not compensation was required, and the bounded pronominal closure has an
exact positive and open-record negative regression. The fifth packet remains
burned.

More importantly, the audit found that “typed divergence” still overstated the
implemented object. Live decisions emitted conceptual flatness only; the
legacy offline path added limited interactional trouble; engagement, pacing,
epistemic, and strategy-exhaustion inputs existed elsewhere but were not one
shared normative/descriptive projection. The new pure projection emits all six
ordered rows on every decision with named normative/descriptive states,
magnitude, persistence, interpretation, warrant flag, and public evidence.
Gate V5, decision-input V2, and shadow V0.3 bind current pacing and the complete
projection into exact live/offline replay.

The corresponding V4 blind corpus exposes raw public evidence and normative
contracts without exposing the predicted rows. Two independent readers label
interpretation, magnitude, and persistence per dimension. The scorer reports
per-dimension consensus, non-aligned support, macro-F1, magnitude/persistence
accuracy, and joint accuracy. This makes the architecture's central divergence
claim falsifiable; until a fresh corpus supplies adequate gold support and
passes those gates, it remains an implemented instrument rather than a
validated model of conversation.

The final scorer audit also aligns terminal safety with the event-based ledger:
a `deferred` obligation is still available to the lifecycle scorer but is not
an unresolved closure blocker by itself. Only `open` or `overdue` gold state
(with reactivated projected through `overdue`) defeats an otherwise valid
close. This prevents the human instrument from reintroducing the exact
inclusive-`open_count` confound already removed from the live projector.

### 7.10 Sixth-packet measurement audit

The sixth packet from `853ad817b224723d69c48c24f58281b79a79f8cb`
preserved exact six-axis live/replay parity on every valid decision: 176/176
with no structured mismatch. It nevertheless failed closed at 22/24 valid
children and five delivery mismatches. Inspection localized both failure
classes below the normative/descriptive projector.

First, the speech-act boundary conflated a bounded modal request to record an
already public finding with a tutor-owned request for an unavailable result.
The new `learner_record_entry_request` act creates no obligation and shares its finite
surface grammar with the writable-entry progression contract. Second, the
realization audit missed four declarative record-closure inflections and one
explicitly named missing-warrant uptake even though final family authority was
preserved end to end.

The corrections are deliberately lexical and bounded. They add no new
divergence rule and do not alter the V4 predictions after seeing gold labels.
The sixth packet remains burned. A fresh packet must establish execution and
delivery validity before human readers can test interpretation, magnitude,
and persistence on each of the six normative/descriptive axes.

### 7.11 Seventh-packet semantic result: projection validity is axis-specific

The seventh execution closed the transport and realization layers: all 24
children, 192 decision inputs, 192 live/replay projections, and 192 delivered
applications were valid. The independent V4 read then failed the semantic
gate. This is the first result that can distinguish a faulty projection from a
faulty harness.

The error audit found that the descriptive speech-act layer was too narrow.
It mapped most public acts to `other`, missing ordinary next-clue result
requests and bounded learner test proposals, while some tutor-selection and
learner-record constructions created false result debt. Those errors propagate
upward: a false obligation changes interactional divergence, warrant basis,
candidate override, and successor family together. The repair expands only
observed disjoint forms and assigns clause precedence before the ledger sees
them.

The conceptual norm was also over-strict. The implementation treated a flat
learner record as conceptual failure even while the learner was explicitly
testing, contrasting, or analyzing the claim. Under the authored norm, that
work is aligned unless public evidence also shows a stall or low-agency
deferral. Interactional divergence had the opposite timing error: a public
obligation newly created by the current learner turn is an uptake demand, not
already persistent failure. It becomes divergent only when older, overdue, or
reactivated debt remains unresolved. These are prospective semantic
corrections, not post-hoc score substitutions.

Pacing is the one six-axis projection that passed the complete frozen gate.
The other axes separate into two groups. Interactional, engagement, and
strategy exhaustion had adequate non-aligned support but insufficient
interpretation accuracy or consensus. Conceptual and epistemic had too little
non-aligned support to adjudicate the detector despite high raw accuracy.
Accordingly the architecture must carry two validation surfaces: natural
dialogue turns for prevalence and false-positive behavior, and a separately
authored challenge surface for rare lifecycle, completion, and divergence
states. Combining their case pools would destroy the descriptive prevalence
claim, so their scores and inferential roles remain separate.

### 7.12 Representative-attempt transport audit

The first representative execution after the supported diagnostic did not
reach the mechanism instrument. During the first worker wave, Codex emitted
redacted failed-turn lifecycle events on three children. The bridge classified
those events as unknown no-tools violations, and the speaking-tutor transport
had no per-call retry. Three other reported children completed normally, which
rules out a matrix-wide prompt or route failure. The partial run is burned.

This boundary is procedural but causally important. A stochastic provider turn
failure must not be recorded as evidence about the adaptive policy, and rows
must not enter the corpus merely because their transport happened to be lucky.
Known `error`/`turn.failed` protocol events are now typed as failed turns rather
than tool use. The shared transport may retry one individual call once, with a
fresh reservation inside the existing child cap; a repeated failure remains
fatal. Known tool events still receive no retry. This correction changes no
warrant, obligation, completion, commitment, or divergence rule.

### 7.13 Compound obligation target realization

The next representative attempt verified the new failed-turn retry in live
operation, then stopped on a deterministic public-obligation realization
failure. The ledger target for “room-presence or fridge-access record” correctly
retained `room-presence`, `fridge-access`, and their component terms. The
fallback speaker treated that matching representation as display text and
hyphen-joined every term. The resulting repeated identifier did not name either
compound under the same delivery audit, so the active child correctly failed
closed.

The repair preserves the semantic target and changes only its public rendering.
When a compound already contains a component, the redundant component is not
spoken; multiple compound targets are separated as phrases. This keeps exact
matching evidence available internally without exposing normalization
artifacts in dialogue. The attempt and packet are burned.

### 7.14 Tutor-recovery transport ownership

The next clean representative attempt passed the former compound-target point,
but one child sealed invalid after a rejected tutor draft needed repair. The
draft rejection was correct: it paraphrased an exact authored source and
substituted a different handoff question. The following
`tutor_stub_tutor_recovery` call received a Codex failed-turn lifecycle event.
Unlike learner, analyzer, and auxiliary calls, tutor attempts were dispatched
by a separate runtime that had not inherited the shared bounded retry.

The correction belongs at that attempt owner, not in dialogue policy. Every
tutor first-draft or repair dispatch now receives at most one fresh metered
retry for a typed Codex transport/schema failure, without changing public
history. Two consecutive failures still invalidate the child, and tool-bearing
events are still refused. The partial packet is burned and supplies no
mechanism evidence.

### 7.15 Retry temporal independence

The next clean attempt showed that merely repeating a failed provider dispatch
does not make the second attempt independent. Across the first 15 reported
children, two roles hit a second failed turn after immediate redispatch; their
retry reservations followed the failure decisions by 2–3 ms. Other calls
succeeded between the affected calls, so the pattern was not a deterministic
prompt or dialogue failure. The packet is burned.

Transport schema v2 retains strict metering but spaces its two permitted
redispatches by 5 and 15 seconds. Waiting is abort-aware and adds no transcript
event. A third failed turn seals the child invalid, while tool events still
receive no retry. The delay and retry count are instrument properties only;
they cannot enter the normative or descriptive dialogue DAG.

### 7.16 Delivery-audit ownership under exact recovery

The first transport-valid representative matrix exposed three remaining audit
ownership errors. A simplified recovery is an exact typed configuration
transition whose `plain` stance means no expressive stance operation applies;
requiring a positive `plain` cue contradicts that representation. A public
obligation delivery has its own active, identity, outcome, and component
checks; an unrelated terminal-handoff issue in the enclosing progression audit
cannot erase those facts. Finally, an explicit “incident is closed” surface is
a terminal declaration, while “incident is not closed” and “incident remains
open” are not.

These corrections change no descriptive learner state, normative trajectory,
warrant basis, policy family, obligation lifecycle, or divergence threshold.
They prevent general delivery diagnostics from claiming authority over the
gate-owned configuration and obligation subcontracts. The pre-repair packet
remains burned; only a fresh execution can establish the delivery boundary.

### 7.17 Exact-source punctuation and question ownership

The next clean representative attempt completed 18 children before one active
Foxtrot fast-learner child exhausted the tutor guard. The deterministic
fallback contained the exact due SOURCE once and satisfied the typed public-
obligation deferral. Its failure arose downstream: sentence splitting did not
recognize punctuation followed by a closing quotation mark, so the following
host sentence altered evidence-correspondence ownership; independently, the
dramatic-release audit required a return question on a turn whose progression
contract explicitly set `question_allowed=false`.

The prospective repair makes both authorities explicit. Quoted SOURCE
sentences terminate before subsequent host prose, and dramatic realization
cannot introduce a question forbidden by the progression owner. Imperative
instructions to examine a possible trace are also distinguished from positive
claims that two exhibits already correspond. None of these changes affect the
normative DAG, descriptive state, warrant basis, or gate threshold. The partial
packet remains burned.

### 7.18 Contract-result projection ownership

The `d7549b38` run proved runtime, replay, and delivery application across all
192 decisions, but the representative reader assembly exposed an authority
gap between the public corpus and its validator. The live gate's action-contract
object contains both the authored expected-uptake contract and a typed
decision-time transition. The blinded projection retained only the authored
contract, correctly keeping the gate result private. Readers independently
inferred success, defeat, or expiry, while the validator incorrectly allowed
the `action_contract` basis only when that hidden transition said
`revision_warranted=true`.

Both readers independently classified a successful renewal as a positive
contract basis, and the same mismatch occurred 73 times across 192 labels.
The repair keeps ownership with independent gold judgment. The raw public
contract declares its possible successors; readers choose among them from
public evidence, and the validator checks only that a positive contract family
is one of those declarations. A non-revising renewal confirms the held family
without creating a warrant. No private gate prediction, eventual response,
condition, or profile is exposed. The old packet is burned; the repaired
instrument can be evaluated only on a fresh run.

### 7.19 Active final authority owns public action realization

The `ba8b1422` replacement run cleared child validity and structured replay but
exposed three active terminal surfaces that preserved `close_inquiry` through
selected, speaking, and delivered configuration without visibly closing the
public inquiry. A structural configuration transition therefore cannot stand
in for a semantic delivery observation.

General configuration visibility remains a useful advisory diagnostic. The
narrow exception is a family claimed as the active warrant intervention: if
that family is not visible, the mechanism was not publicly delivered. The
draft audit now carries the active final-authority ownership context into guard
disposition, which treats `selected_action_family_not_visible` as hard under
strict, shadow-advisory, and terminal-fallback paths. Repair preserves all
other configuration axes and must produce a newly audited public surface.

### 7.20 Generic reminders need a unique public referent

The first child from the `1624e6b8` restart correctly deferred a named jukebox
access-log request, then failed when the learner renewed it as “the matching
record when it is released.” Clause-local classification produced a generic
target and the ledger opened a second debt, making a valid target-specific
deferral impossible. This was a public-state identity defect upstream of
delivery scoring.

The repair does not infer from private state or choose an arbitrary recent
request. It binds only a generic request with an explicit referential cue when
the full public learner surface supplies target-kind evidence and subject
overlap that identify one uniquely best active obligation. The audit records
the original generic target and resolved obligation ID. Equal candidates remain
unresolved, preserving the distinction between two genuinely separate debts.
