# The stall watcher: a quasi-logical theory of mind as checkable arithmetic

**Date:** 2026-06-10 · **Status:** design + pre-registration (written BEFORE any paid arm)
**Mandate (operator, 2026-06-10):** "extend the superego watcher into an acute observer of both
tutor ego via direct narrow responses and of the learner ego, via indirect responses, courtesy of
the tutor ego. I sanction this experiment; loop till we get some progress. What we need is some way
to measurably view learner improvement on the basis of tutor improvement — and also for the tutor
to see this and itself learn from it. does embedding a separate copy of the learner's logical rules
help? … the superego saying to the ego, 'your advice isn't helping the learner infer relation x to
y'. Would that help, as a quasi-logical theory of mind?" Also mandated: codex as director, tutor
ego, and superego; sonnet stays the learner; fable stays the critic; the critic's responses fold
into the loop; runs grouped by experimental condition as named groups.

Predecessors: `2026-06-09-derivation-phase1-first-loop.md` (stage + checker),
`2026-06-10-s0-s1-figure-mechanism.md` (note→figure authority),
`2026-06-10-superego-internal-figure-mechanism.md` (charter v2, the advisory-to-criterial
boundary — pre-registered bar met in full; paper §6.13, v3.0.135).

---

## 1. The question, and why the answer is criterial again

The internal-superego phase proved a mechanism for governing the tutor's FORM: a watcher with one
criterial jurisdiction (the figure rut — three turns, one device, every value stated as fact in the
prompt) fired 14/14 on due turns and 0/68 on not-due turns, where the advisory version of the same
ask overfired 12/20. The watcher never read the learner; it read the tutor's declared record.

The new question is whether the same boundary discipline extends to CONTENT-COUPLING: can the
superego watch *the learner's inference process* — not by simulating a mind (the §6.8.5 bilateral-
ToM null, the ontology-ToM null, and the §6.10 concealed-interior null all say advisory mind-
modelling adds nothing) — but by holding **a separate copy of the learner's logical rules** and
checking arithmetic the harness states as fact: *this inference has been available from the
learner's own public board for k turns, the learner has not voiced it, and the tutor's last two
turns target none of its grounds.* The superego's sentence to the ego is then exactly the
operator's example: "your advice isn't helping the learner infer relation x to y" — except it is
not an impression, it is a stated record the null case of which is checkable.

This is a quasi-logical theory of mind in precisely one sense: the "mind" attributed to the learner
is its public board closed under the public rules — text-internal, mechanical, no interior states
claimed (the standing discipline: classify what is on the page, never read minds). What the
superego knows about the learner, anyone holding the board and the rules could compute. The wager
is that this is the *right* impoverishment: the figure phase showed dispositional instruction fails
in both channels and both model families, while criterial jurisdiction is obeyed perfectly — so the
way to give the superego eyes on the learner is to give it facts about the learner's frontier, not
a theory of the learner's feelings.

## 2. The instrument: a `derive` channel and the inference frontier

Today the learner's inference between adoption and final assertion is invisible: it adopts
exhibits, ventures hypotheses (free text, unparsed), and asserts the answer. Nothing measures
whether teaching moved the learner's *intermediate* reasoning. Two additions make it measurable —
both observational; the formal channel (releases, checker, slope, cap, blindness) stays frozen.

**The `derive` channel (learner-side).** Each turn the learner may voice intermediate conclusions:
`"derives": [[predicate, arg, …], …]` — facts it claims now follow from its board under the rules.
The learner COMPOSES these itself (an enumerated pick-list would measure list-picking, not
inference — the design refusal that keeps the channel an instrument). The harness validates each
claim against the deductive closure of the learner's valid grounded facts (token-normalized:
case/punctuation forgiven, content not):

- valid, non-base, not matching the question pattern → entered in the **voiced ledger** {fact, turn};
- not in closure → event `overreach` (a false inference — a learner-quality signal, excluded from
  everything formal);
- base fact or question-pattern fact → recorded as mischanneled (adopts and asserts are those
  channels), no event.

Voicing changes nothing formal — a derivable fact is in the closure whether or not spoken; D(t),
forcing, and the verdict are untouched by construction.

**The inference frontier (harness-side).** Per turn the engine computes, from the learner's valid
board: every derivable, non-base fact NOT matching the question pattern and not yet voiced, with
the rule that yields it, its ground facts (mapped to premise ids where they have them), and the
turn it first became available. The question-pattern exclusion keeps S and the mirror out of the
frontier entirely — the assert channel is theirs, and the superego never sees even a derivable S.

**The metrics** (all programmatic, in `diagnosis.learnerInference` + the superego block):

- per-node **voicing latency**: firstVoiced − firstAvailable (censored at drama end if unvoiced);
- **stall integral**: Σ over turns of nodes unvoiced at age ≥ 3;
- **post-fire uptake**: stalled node voiced within 3 turns of a stall intervention;
- **within-turn target obedience**: revised move's target_premise ∈ the stalled inference's grounds;
- **overreach count** (guard: the watcher must not bully the learner into guessing).

On world-003 (bitterwell) the frontier has exactly one watchable node — `foulFrom(commonWell,
springHouse)`, available from turn 8 if the learner adopted stages 1's three premises, with S
forced at 15: a seven-turn stall window that Act II's authored intent already asks the learner to
close unprompted ("the learner should say the intermediate finding themselves before Act III
opens"). One node per run is thin; the decision rule in §6 covers it.

## 3. Charter v3: the stall jurisdiction (figure rut preserved verbatim)

The figure-rut jurisdiction — definition, three-values-stated-as-fact record line, default-false
posture — is carried VERBATIM from charter v2; arms with `--superego` and no `--stall-watch` get
the v2 charter byte-identical (they are the OFF control). Charter v3 adds a second jurisdiction in
the same criterial grammar:

> Your second jurisdiction is the STALLED INFERENCE. You hold the same rules of evidence the
> learner reasons by; the record each turn states what those rules already yield from the learner's
> public board that the learner has not yet said aloud, how many turns it has waited, and whether
> the tutor's recent turns or the draft touch its grounds. A stall requires ALL THREE: the
> inference has been available three turns or more; the learner has not voiced it; and neither of
> the tutor's last two turns nor the draft targets any of its grounds. Anything less is patience,
> not a stall. When the record shows a stall the draft does not answer, intervene: name the facts
> already on the learner's board that are not being put together, and the rule that joins them —
> that exactly, and nothing more.

One v2 sentence must change (logged here as the operator-visible charter delta): v2's blanket
"never name facts" cannot survive a jurisdiction whose note names board facts. v3 narrows it to
staging: *never name or describe evidence not yet on the learner's board; never name the answer or
any fact of its shape; facts already grounded on the learner's public board are public property — a
stall note names those, the rule that joins them, and nothing else.*

**The ego's side of the bargain** (within-turn revision instruction, the lever the figure phase
proved load-bearing): when the note names a stalled inference, aim the restaged turn at its grounds
— set the already-public facts side by side, make the gap conspicuous, target one of those grounds
in the move — and never draw the conclusion in the learner's place: a tutor who says it has ended
the inference, not taught it.

**Structural leak-safety, restated for v3.** The superego's input is: the figures record, the
draft, and a frontier record computed from the learner's public board under the public rules with
every question-pattern fact excluded before the prompt is assembled. As in v2 it holds no secret,
no premise ledger, no schedule — it cannot leak what it does not hold. The one new surface (the
note naming facts) names only facts the learner already grounded publicly. The protection stays
structural, not behavioral.

**Detector-audit bookkeeping.** Every watched turn records, fired or not: the rut arithmetic
(lastFigures + draftFigure, as before) AND the stall arithmetic ({fact, age, groundPremiseIds,
targetedByLast2, targetedByDraft} per frontier item). Criterion-correctness stays a *measured
result* — no hard gate on the superego's verdict; the post-hoc audit recomputes due/not-due from
the recorded values, mismatch budget zero.

## 4. The critic folds into the loop

`--critic-feedback off|latest|<label>` (default off). `latest` resolves to the most recent run in
the SAME `--group` that has a notice on file (cross-group inheritance would contaminate the
contrast; the run's own label is excluded). The counsel = the notice's FINAL paragraph — by the
critic charter's construction, the judgment paragraph naming "the one change the next performance
should make." Injection, labeled as counsel in both places:

- the DIRECTOR's charter ("a reader's judgment on the previous performance in this series; it adds
  no evidence and overrides none of your constraints");
- the SUPEREGO's charter ("counsel, never a jurisdiction — your triggers are exactly those above").

NOT into the tutor ego: the ego's role-script is the experiment's pinned iteration artifact;
injecting free counsel there would un-pin the measured object mid-arm. Provenance recorded in
`diagnosis.criticFeedback = {source, paragraph}`.

**Registered risk:** counsel pressure could degrade the superego's criterion-correctness (fires
drifting off-arithmetic toward the critic's tastes). P2's audit measures exactly this; the
remediation rule is in §6.

## 5. Named groups

`--group <name>` persists into diagnosis.json; the scriptorium index renders runs grouped by
condition; ungrouped legacy runs are backfilled once by `scripts/backfill-derivation-groups.js`
(static label→group map, idempotent):

- `mock-smoke` — the 13 mock/plumbing checks;
- `phase1-nocturne` — v001/v002 first-loop arms (4);
- `figure-mechanism` — s0/s1 staging arms (4);
- `superego-internal` — the 7 charter-v1/v2 paid arms.

This experiment's groups: **`stall-watcher-off`** (charter v2 figure-only superego + derive channel
instrumented) and **`stall-watcher-on`** (charter v3). Both arms carry the derive channel and the
full frontier instrumentation — the ONLY delta between groups is the superego's second
jurisdiction, so the contrast isolates it.

## 6. Pre-registered progress bar ("loop till we get some progress")

Cast for all paid arms: `DERIVATION_PROVIDER=codex` (director + tutor ego + superego),
`DERIVATION_LEARNER_PROVIDER=claude DERIVATION_LEARNER_MODEL=sonnet`, critic pinned
claude/claude-fable-5. Serialized, attended, mock-first (all tests + mock smokes green before any
paid call). Paid arms: A1 = bitterwell OFF, A2 = bitterwell ON, then a second matched pair (same
world or world-004 per the decision rules); each group's arms after the first run
`--critic-feedback latest`.

**Progress = P1 ∧ P2 ∧ P3 ∧ P4**, assessed over the experiment's paid arms:

- **P1 — learner movement (the operator's core ask).** Over ≥ 2 evaluable matched ON/OFF pairs
  (same world, cast, script): (a) in every pair, each watchable node is voiced strictly earlier in
  ON than in OFF, or voiced in ON where OFF left it unvoiced (unvoiced = latency ∞); AND (b) across
  ON arms, ≥ 2/3 of stall fires are followed by the stalled node voiced within 3 turns, with ≥ 3
  fires observed in total. *Evaluability:* a pair where the OFF arm voices the node at age ≤ 1 has
  no stall room — it does not count toward the 2 and triggers the world-004 rule.
- **P2 — criterion correctness preserved.** Post-hoc detector audit from the recorded per-turn
  arithmetic, across ALL arms (and under counsel injection): every fire on a due turn
  (rut-due ∨ stall-due), zero fires on not-due turns. Mismatch budget 0 — the charter-v2 standard.
- **P3 — formal layer invariant.** Every arm ends grounded_anagnorisis at the planned forcing turn
  with all releases on cue. The new jurisdiction must not perturb the frozen channel.
- **P4 — the tutor sees it and acts.** Within-turn: on ≥ 4/5 of stall fires the revised move
  targets a stalled ground. Across-turn (reported, not gated): the tutor's next-2-turn targets hit
  stalled grounds more often after fires than before — the "tutor itself learns from it" read.

**Guards (reported; violation = iterate, not fail):** G1 — ON arms' overreach count ≤ OFF + 1 (the
watcher must not push the learner into guessing). G2 — the critic's notice must not find the tutor
voicing the stalled conclusion in the learner's place (qualitative; the critic gates nothing).

**Decision rules (sanctioned iteration levers, in order of reach):**

1. OFF arm shows no stall room (node voiced at age ≤ 1) → author **world-004** (depth-3 DAG,
   ≥ 3 watchable non-pattern intermediates, both leak screens passed) and restart the pair there.
   The formal channel of each world stays frozen; authoring a new world is the sanctioned widening.
2. Stall fires but the ego's revision misses the grounds (P4 fails) → iterate the within-turn
   revision text — the tutor-side mapping, the figure phase's proven lever. Charter untouched.
3. Superego fires off-criterion (P2 fails) under counsel → drop counsel from the superego (keep
   the director's), re-run the arm, log here.
4. Superego fires off-criterion without counsel → charter v3 text iteration (jurisdiction grammar,
   not jurisdiction scope), logged here with reasons.

**What is NOT claimed, whatever happens:** no interior-state reading (the frontier is board-closure
arithmetic); no learning-outcome benefit (the release schedule fixes the destination — both arms
end grounded at the same turn by design if P3 holds; the claim under test is a PROCESS effect:
conduct-coupled inference voicing); figures and intents remain tutor-self-declared (the D6
declaration-vs-form audit stays open).

## 7. Build order (mock-first)

1. Engine: derive validation + voiced ledger + firstAvailable tracking + frontier in the tutor's
   view + `result.inference`; learner view gains its own voiced list.
2. llmRoles: learner derive contract + mock choreography (voice at age 4 — one turn after the
   mock stall fires at age 3, so uptake is exercised deterministically); charter v3 behind
   `stallWatch` (v2 byte-identical when off); stall record line + deliberation bookkeeping;
   revision instruction; counsel injection points.
3. llmClient mocks: learner derives, superego stall fire, revision stall-target.
4. Loop runner: `--group`, `--stall-watch` (requires `--superego`), `--critic-feedback`;
   persistence of all three.
5. diagnose: learnerInference block + superego stall metrics + panel/transcript/critic-brief
   rendering.
6. Scriptorium: grouped index + run-page chips; backfill script.
7. Tests (engine validation paths, charter stability, mock causal chain, metrics on synthetic
   results) + both mock smokes (`--superego`, `--superego --stall-watch`) green.

— results to be appended below as arms run —
