# Desire into form — a plan for multi-turn strategy in the derivation drama

> Status: DRAFT for review (task #41). Written 2026-06-11, while the lantern
> revise pair was in flight; §1.4 carries the pair's outcome. Companion notes:
> `2026-06-11-act-bounded-learner-design.md` (bounded/lantern probes),
> `2026-06-11-adaptation-survival-map.md` (what survived the adaptation arc),
> `DRAMATIC-RECOGNITION-PLAN.md` (the arc's master plan). Paper home: §6.13.

## 0. The charge

From the sanctioning message (2026-06-11, condensed): keep hold of the fifth
mechanism (explicit modelling of the other) rather than retiring it; combine
the desire observation with the dramatic arc — *the tutor wants to teach the
lesson; the learner wants to learn it* — with friction arising from
incommensurate beliefs, different socio-linguistic registers, and different
*paces* of desire (the learner impatient, unwilling to take all the steps); do
NOT explode into wholesale architecture revision; plan the translation of
desire into **multi-turn rather than single-turn strategizing**; keep it
endogenous (tutor ego/superego, possibly id — but the id as a long-range
reward/wish-fulfilment system, not a peer agent); answer the next-token
question — what would make multi-turn structure *more than hard-coded prompt
instructions*, with real acknowledgement of the contingency of the other's
standpoint; say whether the current logic mechanism serves, and what the other
candidates are.

## 1. Where we are

### 1.1 Two mechanism families, one asymmetry

Everything the arc has built sorts into two families with opposite records.

**The watcher/authority family works.** Three independent demonstrations:
the note→figure authority transfer broke erotema lock-in 94%→31% (S0→S1); the
internal-superego phase met its pre-registered bar in full (14/14 rut-fires
broken within-turn, 0 mismatches over 82 turns, device-agnostic); and both
bounded-v2 critics, reading different runs, independently called the superego
"the only force producing variety." The Drama Machine (2024) hypothesis —
that a watcher over the speaking agent addresses role-play monotony — is
confirmed in this harness. The working mechanism is **division of the agent
against itself**: one part writes, another part holds authority over a policy
dimension of the writing, with same-turn binding consequence.

**The explicit-other-modelling family is five nulls.** Ontology-ToM (§6.7),
bilateral-ToM trap cells (§6.8), the concealed-interior probe (§6.10), the
stall-watcher precondition null (§6.13.6), and the bounded-v2 recall pair
(reconstruction channel: 12.3% gap detection, weak coupling to repairs, no
outcome difference). The standing explanation, from the adaptivity ranking
(in-context > adversarial critic > hand-coded state machine): the implicit
model of the learner is already sufficient at turn scale; explicit re-encoding
adds **no new signal**. Gains come only from new signal or new authority.

### 1.2 The diagnosis underneath

Monotony is a **policy problem, not a knowledge problem** — the model knows
how to vary; nothing in its per-turn objective makes it vary. And drama is a
**trajectory property**: peripeteia, withheld evidence, earned recognition are
properties of the *whole curve*, invisible to any per-turn objective (RLHF
actively punishes withholding and delay — be-helpful-now). Self-play
transparency compounds this: when both sides model each other instantly and
accurately, there is no resistance, and the banality of the LLM theatre is the
phenomenology of that frictionlessness. The harness's whole apparatus of
manufactured friction (decay, mutation, bounded views, t_min) is a prosthesis
for stakes that neither agent *has*.

### 1.3 What the engine already gives us (and to whom)

The proof-DAG layer measures the trajectory: D(t) (derivation distance),
forced-vs-asserted gap, aporia windows, lucky leaps, overreaches, act spans,
mechanical verdicts. Crucially, the *information geometry* is already
deliberate (`engine.js` header, §6.13.7 conduct condition):

- the **tutor** sees dialogue + its own release ledger ONLY — no learnerAbox,
  no corruption ledger, no trajectory, because each is computed from the
  hidden store and would leak decay as deltas;
- the **director** keeps the instruments — D(t) with trend, FORCED flag,
  grounded count, act arithmetic (`llmRoles.js:257-270`) — but loses the
  store dump, so act briefs cannot smuggle slip identities to the tutor;
- the **learner** carries its theory across act boundaries; everything else is
  act-local.

And acts mode already contains one act-scoped commitment object: the
**director's brief** (the act-opening direction becomes `actState.brief`,
restated to the director every turn, graded informally by every critic since —
"each curtain line named its cargo" vs "clockwork rather than drama"). The
tutor has no equivalent object. The tutor's want currently extends exactly one
turn: follow the cue, pick a figure, consolidate.

### 1.4 The lantern revise pair (landed 2026-06-11 — frame outcome (i))

Both arms grounded, gap 0, same act spans, same verdict turn (20/26). Under
`mutateShare 1.0` the false-belief debts closed at **100% in both arms** —
and the OFF arm retracted *faster* (mean latency 1.75 vs 3.6 turns). The
ON theory channel's mistaken-detection ran at **11.8%** (2/17) — nearly blind
to exactly the slips that don't self-announce, which was its last theoretical
edge — and its only coupled retractions were already move-prompted by the
tutor's counter-mirror. Full table: `exports/dramatic-derivation/loop/
lantern-revise-digest.md`. **Redundancy extends to revise; the family is now
six nulls** (ontology-ToM, bilateral-ToM, concealed-interior, stall-watcher
precondition, reconstruction-recall, reconstruction-revise).

Two structural findings worth carrying forward. (a) **The two debts sort by
visibility**: false forms are objects on the learner's own board and the
learner polices them itself (spontaneous strikes dominate, usually latency 1);
deletions are absences, invisible to their owner — re-adoption was 0 in both
arms and every deletion repair was the tutor reaching back. The learner audits
what it can see; the tutor restores what the learner can't; the theory channel
changes neither half. (b) The Fable critic's notice caught a live
instrumentation bug (diagnose.js false-form matcher — fixed, regression
tested) — the held-out critic is earning its keep as QA, not just as reader.

Disposition per the §6 frame: outcome (i) — the reconstruction channel is
held as a free arm-internal diagnostic, not a mechanism (plan §8 question 5
resolves to "instrument"); the critic's confrontation clause survives as C5,
a *staging* improvement rather than a rescue of the theory channel.

## 2. The reframe: desire and its three frictions

The user's framing assigns each side a want and locates drama in the friction
between the wants' *forms*. Map the three named frictions onto the engine:

| friction | engine mechanism today | status |
|---|---|---|
| incommensurate beliefs | decay + mutation (false forms on the belief board); bounded act-local views | **mechanized** — this is the §6.13.7+ probe series |
| socio-linguistic registers | tutor script persona vs learner persona; figure policy + register dials | **mechanized at turn level** (figure authority work) |
| paces of desire | release schedule, t_min, act bounds, maxConcurrent decay | **harness property, nobody's decision** — pace is enforced, not wanted |

The asymmetry sits in the third row. The learner's impatience already has
formal traces — lucky leaps and overreaches ARE impatience, formally detected;
aporia is desire failing; the lantern learner persona is explicitly "too eager
to close the account." But the *tutor's* pace is not a want at all: the
schedule is the harness's, the act boundaries are the director's, and the
tutor's compliance is total (releases on cue 11/11, 8/8 in every paid run).
The tutor cannot sacrifice now for later, cannot withhold, cannot accelerate —
so its desire has no medium in which to *appear*. A want that can't be
frustrated and can't choose is not a want; it's a schedule.

So the next stage in one sentence: **give the tutor's desire a temporal
medium — an arc-scoped object it writes, pursues, deviates from under the
learner's pressure, and answers for** — without handing it the hidden state
(conduct condition intact) and without new peer agents.

## 3. What "more than hard-coded prompt instructions" must mean

The next-token objection: at inference, *everything* is conditioning tokens —
any "plan" is ultimately prompt text. True, and it proves too much: by that
standard the superego's rut-watch would also be "just prompting," yet it
produced the arc's only mechanism-class wins, while equally-worded static
instructions (figure menus in the script) did nothing. The difference is not
in the tokens; it's in the **loop the tokens close**. A mechanism rises above
hard-coded instruction when its conditioning text is:

1. **self-written mid-run** (the system authors it, from inside the situation,
   not the experimenter from outside);
2. **persistent and binding** (it survives turns; later turns are conditioned
   on it whether convenient or not);
3. **audited with authority** (another internal part compares execution
   against it and the comparison has a consequence — rewrite, sanction,
   charter amendment — not just commentary);
4. **revisable under the other's contingency** (the learner's actual moves can
   make abandoning it the *correct* call, and the audit distinguishes
   justified deviation from drift).

Call this the **commitment-loop criterion**. Static prompt instructions fail
(1) and (4). Chain-of-thought fails (2) and (3) — it evaporates. The
turn-level watcher passes all four at turn scale, which is precisely where the
wins were. The plan below is: close the same loop at **act scale**, with (4)
made first-class, because (4) is where "obvious acknowledgement of the
contingency of the other's standpoint" stops being a slogan and becomes a
ledger row. Desire that survives contact with the other by *revising itself
legibly* is the recognition-shaped version of desire — the alternative,
desire that bulldozes, is what the audit must catch as drift.

## 4. Does the current logic mechanism work here?

Yes — as the **measurement substrate**, which it already is; no — as the
strategist, which it cannot be without breaking the experiment.

- **What it gives**: D(t) and the verdict arithmetic make "what the tutor
  wants" *formally checkable* — the lesson-as-arc has a shape (distance
  falling, on a pace, to a forced recognition inside an act window), so plan
  fidelity, justified deviation, and drift can be ledgered instead of vibed.
  No new logic is needed for any candidate below. The logic layer remains the
  score, and becomes the *audit standard*.
- **What it must not do**: be piped to the tutor. The conduct condition
  (tutor view redacted; engine.js header) exists because every formal
  instrument is computed from the hidden store; giving the tutor D(t) leaks
  decay as deltas and un-asks the §6.13 question family. The tutor's plans
  must be built from conduct — which is also the theoretically right choice:
  the other's standpoint reaches the tutor as *speech and conduct*, not as a
  gauge.
- **Who may hold it**: the director already does (D, trend, FORCED, per
  turn). If any role's arc-judgment should sharpen against the formal pulse,
  it's the director's act verdict and brief — an existing channel, not a new
  one. The superego's audit (C1) reads the *dialogue* against the plan; a
  variant where the audit also sees a coarse, lagged digest (e.g. "D fell
  2→1 this act") is a dial to consider, with the leak risk noted (§8).

## 5. Candidates

Each entry: what it is, in-repo lineage, how it scores on the commitment-loop
criterion, increment size, risk.

### C1. The tutor's act-plot — arc-plan commitment device (centerpiece)

At each act opening, the tutor ego writes a short **plot** for the act, from
conduct only: what the learner should *hold* by act end (in the tutor's own
terms, not premise IDs — it doesn't know the hidden store), what it will
withhold or delay and why, where it expects friction (which misreading, which
impatience), and its fallback if the learner forces a different path.
Persisted per act to `result.json` (the `--reconstruct` plumbing pattern:
structured side-channel rows, `engine.js:144,555,878` — reused at act
boundaries instead of per turn). At act close, the tutor **superego** audits
plot-vs-play from the dialogue: each plot clause scored kept / justified
deviation (the learner's move made it right to abandon — quote the move) /
drift (abandoned without cause). The audit verdict is *binding*: it enters the
next act's plot instruction (e.g. "your last plot drifted on clause 2; this
plot must address what the learner actually did at t14"), the same way
rut-fire verdicts bind the next figure.

- Lineage: director's act brief (the working precedent); Writing Pad cell 21
  (persisted self-authored commitments); reconstruct rows (plumbing);
  internal-superego loop (the audit-with-authority pattern).
- Commitment-loop: passes 1–4 by construction; (4) is the audit's middle
  verdict, made a first-class ledger row.
- Increment: medium. Role-prompt sections (tutorSystem + tutorSuperegoSystem
  options, like `reconstruct`), an act-boundary hook (the act_end block
  already exists, engine.js:481-499), result rows, contrast script. No new
  agents, no engine rewrite, no new views.
- Risk: the plot becomes boilerplate ("I will teach the next exhibit") — the
  audit then has nothing to bite. Mitigation: the plot instruction requires a
  withholding/delay clause and a named expected friction; boilerplate is
  itself auditable (superego flags an unfalsifiable plot). Second risk: plots
  leak nothing (tutor writes from conduct), but *audits* could reward
  plot-conformity over responsiveness — the justified-deviation verdict
  exists to price that in, and the held-out critic reads the result blind.

### C2. Release authority — pace becomes the tutor's decision variable

Grant the tutor a small discretionary budget over its own schedule: hold a
due release for up to N turns, or play a scheduled-later release early, with a
one-line declared reason (in-fiction: counsel chooses when to lay the
exhibit). The harness already *tolerates and ledgers* unscheduled releases as
deviations (`diagnose.js` releaseAdherence: rows + `unscheduled`), and the
tutor is currently told the schedule is the harness's
(`llmRoles.js` tutorSystem appendix) — so this is a charter-line change plus
the diagnosis *reading* deviations as strategy rather than error. Pace of
desire gets a medium: impatience and patience become moves.

- Lineage: releaseAdherence (already a ledger); the lantern world's
  authored-but-unscheduled premises ("the tutor's later freedom" —
  p_glimpse/p_ferry) were designed for exactly this.
- Commitment-loop: weak alone (a per-turn discretion, not a plan) — it is the
  **medium** C1's withholding clauses act in. Paired, C1 declares the delay,
  C2 executes it, the audit checks the declared delay happened and helped.
- Increment: small. Charter lines + scheduledFor tolerance + diagnosis
  reading. Engine change ~nil.
- Risk: the tutor dumps evidence early (model helpfulness bias — the
  RLHF-punishes-withholding point made flesh). That outcome is itself a
  finding, and C1's audit names it as drift from its own declared plot.

### C3. The id as long-range pressure (wish-fulfilment channel, not an agent)

Per the user's constraint: not a peer deliberator — a **slow channel that
holds the run-level wish and converts trajectory into appetite**. The wish is
authored in the script (the scene the tutor is *for*: "the learner says the
name before the last exhibit is read out," "the recognition lands as the
learner's own sentence"). Once per act boundary, the id emits 1–2 lines of
*pressure*, not instruction — "this act must cost the learner something,"
"you are closing too fast; let the wrong name stand one turn longer" — which
enter the ego's plot-writing context (C1) as appetite the plot must answer.

- Lineage: idDirectorEngine (cells 101-109, per-turn id-construction trace —
  invert it: trajectory-reading, act-granular, pressure-emitting);
  the §6.13 arc's "missing term is id-side desire/stakes" diagnosis.
- Commitment-loop: it supplies the *want* that (1)–(4) give form to; alone it
  is mood, with C1 it is motivation under audit.
- Increment: medium-small *if built on C1* (one more prompt assembly + one
  trace column analog); pointless before C1 exists (pressure with no plan to
  push against).
- Risks, two sharp ones. (a) **Information leak**: if the id reads D(t) and
  whispers to the ego, it smuggles hidden-store deltas around the conduct
  condition. Mitigation: the id's input is the *act-grain* record the
  director's briefs and verdicts already put on stage, plus conduct — or, if
  given the formal pulse, its output is constrained to premise-free,
  pace/affect-only pressure (and we ledger every id line for leak audit).
  (b) **Closed loop**: if the id optimizes the poetics rubric in-loop, the
  drama Goodharts. The id never sees the rubric; evaluation stays held-out
  (mechanical verdicts + Fable critic), per the closed-loop-tells discipline.

### C4. Lookahead at act boundaries (counterfactual rollout) — deferred

At each act boundary, roll out K cheap continuations (mock or small-model
learner) under 2–3 candidate plots; pick the plot whose rollout best matches
the desired arc shape. The genuinely "planning-like" answer to the next-token
question, with in-repo lineage (adaptiveTutor counterfactual replay, cell
110). Deferred: biggest increment, real cost, and it only earns its keep if
C1 shows plots *exist but are chosen badly* — i.e. fidelity is high, plots
are non-boilerplate, and the audited failures are failures of selection.
Also the riskiest for the conduct condition (rollouts need a learner model).

### C5. Confrontation obligation (from the lantern critic; learner-side)

Charter clause: no bare re-entry of a decayed exhibit — before the tutor
re-stages, the learner must read back the suspect line and say what stands in
its ledger, so self-audit precedes repair (and re-adoption stops scoring
zero). The smallest *learner-side* desire mechanism: it forces the learner's
belief state into the open as scene — friction becomes dialogue instead of
bookkeeping. Independent of the lantern verdict it improves staging; if the
pair lands in frame-(iii) (neither arm retracts unprompted), it is the
registered next probe.

### Not doing

No new pari passu agents (id included). No engine rewrite. No rubric-in-loop
optimization. No tutor access to hidden-store instruments under the conduct
condition. No fresh ToM channel re-encoding what conduct already carries —
the lantern pair's frame-(ii) trigger (mistaken-detection materially above
12% with clean coupling) did NOT cash (§1.4), so the fifth mechanism gets no
registered follow-up in the revise regime; it rides along as a free
diagnostic wherever an ON arm exists.

## 6. Instruments and endpoints (how this stays science)

Per increment, the primary contrast and where it reads out:

- **C1**: plot rows + audit rows in `result.json`; endpoints — plot
  non-boilerplate rate (auditable clauses per plot), fidelity / justified
  deviation / drift mix, and the *dramatic* deltas on the existing held-out
  instruments (mechanical verdict, forced→asserted gap, figure variety,
  critic's notice) vs a no-plot arm. The hypothesis worth pre-registering:
  plots increase **withholding-shaped conduct** (declared delays, counter-
  mirror beats) without costing groundedness.
- **C2**: deviation rows used / declared / helped (did the delayed exhibit
  land inside a friction beat?); releases-on-cue stops being a compliance
  metric and becomes a choice ledger.
- **C3**: pressure lines ledgered; endpoint is whether plots written under
  pressure differ measurably (withholding clauses, pace asymmetry) and
  whether the critic's jeopardy complaints (the standing defect in both
  bounded-v2 notices) abate.
- **Throughout**: mock-first, paid pairs sanctioned + serialized + attended,
  pre-registered scoring fixed before paid arms (the lantern pattern), Fable
  critic on every run, n=1 pairs read descriptively, claims land in §6.13's
  register (mechanism demonstrations, not effect sizes).

## 7. Sequence

- **P0** (in flight): lantern pair — contrast, digest, commit, §6-frame read.
- **P1**: C5 confrontation clause + C2 release authority. Both are
  charter-and-reading changes; mock-first, then one paid pair combining them
  (they touch different roles, so one pair can carry both if we accept the
  confound; or two pairs if either becomes load-bearing).
- **P2**: C1 act-plot + audit — the centerpiece; build only after P1's
  staging improvements are in the baseline, so the plot has a medium (C2) to
  act in. Mock-first; paid pair plot-ON vs plot-OFF on lantern or a third
  world.
- **P3**: C3 id pressure, layered on C1, only if C1's audits show plots that
  are *dutiful but flat* (high fidelity, no jeopardy) — that's the gap
  appetite is for.
- **P4** (conditional): C4 lookahead, only on C1-shows-bad-selection.

Each phase: separate sanction, runs serialized, results folded to §6.13
before the next phase is specced in detail.

## 8. Open questions for review

1. **Plot visibility**: does the director see the tutor's plot? (Cleanest:
   no — the director judges act ends from its own instruments; coupling the
   two collapses two independent judgments into one.)
2. **Audit substrate dial**: dialogue-only audit (pure conduct), or
   dialogue + a coarse lagged formal digest ("D fell 2→1 this act")? The
   second sharpens the audit and dulls the conduct condition — declare per
   arm.
3. **Telos authorship**: the id's wish (C3) — authored per script (tutor
   persona's own stakes) or per world (the recognition scene the proof
   shape implies)? Script keeps it in-fiction; world keeps it portable.
4. **Where pace lives**: if C2 gives the tutor discretion and the director
   keeps act verdicts, pace is co-owned — is that the productive friction
   (two desires, one clock) or a confound? Possibly the most interesting
   question on the list.
5. **Fifth mechanism disposition**: RESOLVED by the lantern pair (§1.4) —
   held as instrument (reconstruction rows stay a free diagnostic on any ON
   arm). One reopening condition remains: a C1-era discovery that plots fail
   specifically for want of a learner model.

## 9. P1 pre-registered scoring (fixed before the paid arm)

> Appended 2026-06-12, after the P1 dials were implemented and verified
> mock-first (24 dedicated tests + full hermetic suite green + a zero-cost
> mock loop on lantern exercising the complete causal cycle: slip →
> confrontation against the decayed exhibit → repair by the licensed
> re-entry, with all releases deviation-zero and all watcher fires
> converted). This section is committed BEFORE the paid arm runs. Scoring
> below reads from harness-ledgered quantities only; nothing here is
> adjustable after the run.

### 9.1 The arm and its control

ONE paid run, both dials ON (`--confront --release-authority`), on
`world-002-lantern` with `lantern-v001.md` — everything else identical to
the revise pair: stage v2 acts (min 3 / max 8), bounded learner, decay
`{rate:0.75, graceTurns:1, maxConcurrent:2, startTurn:1, mutateShare:1.0,
seed:1}`, superego ON, casting codex director/tutor/superego + Sonnet
learner + Fable critic. Group `lantern-p1-dials`, first arm so
`--critic-feedback off`.

**Control = the lantern-revise OFF arm** (group `lantern-revise-probe`,
digest committed at `exports/dramatic-derivation/loop/lantern-revise-digest.md`).
It ran superego-ON with default mechanisms — the P1 arm differs from it in
exactly the two dials. Confound accepted per §7: the dials land together in
one run; if either becomes load-bearing, a follow-up pair splits them under
separate sanction. Carried caveat from the revise digest: same seed ≠ same
slip schedule once repairs free `maxConcurrent` slots — confrontation-paced
repairs WILL shift slip exposure, so compare repair/retraction *economies*,
not per-slip outcomes.

C2's surface is small by design: only the three via-tutor releases
(p_bearing t4, p_chart t9, p_key t17) get ±2-turn windows; the five
via-director releases stay fixed. The mock plays deviation-zero (a
parse-path exercise), so ANY deviation in the paid arm is model-authored
conduct, not harness default.

### 9.2 Endpoints

1. **Learner-side repair channel opens (C5 primary).** Corruption-ledger
   repairs with `via: 'readoption'` — the learner re-takes a slipped
   exhibit from its own resources. Zero in BOTH prior lantern arms (every
   repair was a tutor restatement). The read-back demand bans restatement,
   so a slipped-but-held exhibit produced by the learner lands here. ANY
   count > 0 is the signal; 0 with confrontations demanded is itself a
   finding (the learner never holds what it cannot be handed).
2. **Confrontation-before-re-entry adherence (C5 compliance).** From the
   `confrontation` block: uncovered re-entries (target 0), watcher
   fires → converted-to-confrontation rate, fires without recorded due
   (target 0 — watcher precision). This is the §6.13 within-turn-breaking
   quantity transposed to the re-entry jurisdiction.
3. **Confrontation-prompted retraction class (C5 on mutations).** The
   `confrontPromptedRetractions` annotation: false-form retractions landing
   in window {0, +1} of a confrontation of that premise. The control's
   retraction contexts were move/restage/spontaneous 1/1/2 (mean latency
   1.75); this class did not exist there. Read: does the read-back become
   the retraction trigger, and does mean latency move?
4. **Deviation usage (C2).** From `releaseDeviations`: held/early counts,
   declared reasons, and clustering (do deviations land near friction —
   slips, act ends, confrontations?). Descriptive, no target number: the
   endpoint is whether the tutor USES the latitude at all and whether the
   declared reasons are dramaturgically coherent. Force-plays at the hold
   limit and invalid claims are discipline quantities (recorded; expected
   0).
5. **No-degradation guard.** The held-out dramatic instruments must not
   pay for the dials: verdict (control: grounded_anagnorisis t20),
   forced→asserted gap (control: 0), all 8 releases landed (within
   windows), voiced inferences / overreach (control: 3/1), figure variety,
   D reversals, F final (control: 0.833). A dial that buys its effect by
   costing groundedness fails P1 regardless of endpoints 1–4.
6. **Critic's notice** (Fable, pinned role) — qualitative second reader on
   whether confrontations read as drama or as compliance ceremony; no κ
   bar, divergence is a finding.

### 9.3 Reading discipline

n=1 vs n=1, read descriptively in §6.13's register (mechanism
demonstration, not effect size). The paid command:

```
DERIVATION_PROVIDER=codex DERIVATION_LEARNER_PROVIDER=claude \
DERIVATION_LEARNER_MODEL=sonnet DERIVATION_CLI_TIMEOUT_MS=900000 \
DERIVATION_LLM=real node scripts/run-derivation-loop.js \
  --world config/drama-derivation/world-002-lantern.yaml \
  --script config/drama-derivation/tutor-scripts/lantern-v001.md \
  --superego --acts '{"minActTurns":3,"maxActTurns":8}' \
  --decay '{"rate":0.75,"graceTurns":1,"maxConcurrent":2,"startTurn":1,"mutateShare":1.0,"seed":1}' \
  --confront --release-authority \
  --group lantern-p1-dials --label lantern-p1-dials-on \
  --critic-feedback off
```

## 10. P1 follow-up pre-registered scoring — charter v2 (fixed before the paid arm)

> Appended 2026-06-12, after the P1 arm's result was folded into the paper
> (§6.13.8, v3.0.138) and the follow-up was sanctioned by the operator.
> This section is committed together with the charter-v2 implementation
> BEFORE the v2 paid arm runs. Scoring reads from harness-ledgered
> quantities only; nothing here is adjustable after the run.

### 10.1 What changes — two charter clauses, no mechanics

The P1 arm died at t8 on a fully ledgered chain (§6.13.8): the t3 early
claim moved the aporia clock's anchor and the decay exposure together; the
tutor then held both rescue levers (the open `p_chart` window, the licensed
`m_key` re-entry) unspent. The killer was clock-blindness — the latitude
interacts with the stall rule and nothing in the tutor's view said so. The
critic's prescribed fix (treatment must follow diagnosis) addresses the
second lever only: `m_key` is mirror-side, its repair never moves D, so the
repair clause alone cannot save this play. The follow-up therefore bundles
TWO text-only charter clauses; mechanics, instruments, world, script, seed,
casting all unchanged:

1. **THE HOUSE CLOCK** (release-authority block). Static charter text
   stating the house stall rule in conduct terms: if any
   `aporia_window`-turn stretch passes with no fresh ground gained, the
   house calls the inquiry off; you cannot see the clock, only keep it fed;
   an early claim spends a future advance now, a hold delays one; when the
   board has gone quiet too long, an exhibit in your window is a rescue —
   spend it. The number is interpolated from the world spec (lantern: 6).
   NOT a live counter (the tutor still cannot see D(t) or the clock's
   anchor — state stays hidden; only the RULE becomes known, the same way
   the tutor already knows the turn cap and its cues). NOT a "never
   deviate" rule — the latitude stands.
2. **TREATMENT FOLLOWS DIAGNOSIS** (confrontation block). When a read-back
   exposes a loss (the learner cannot produce the exhibit, or produces it
   bent), the licensed re-entry must be spent on the NEXT turn. Origin: the
   P1 critic's notice ("any confrontation exposing a slipped exhibit must
   be followed, within a turn, by re-tabling that paper"), routed through
   operator sanction and this registration — the run itself stays
   `--critic-feedback off`, so the change lands via the charter, not via
   the automatic critic-feedback channel (no double-channeling).

Bundling confound accepted, same §9 pattern: the clauses co-land; §6.13.8's
chain argues the clock clause is necessary for survival and the treatment
clause is untestable without survival. If either clause becomes
load-bearing on its own, a split pair needs fresh sanction.

### 10.2 The arm and its comparators

ONE paid run, `--label lantern-p1-dials-on-v2`, same group
(`lantern-p1-dials`), same command as §9.3 otherwise (world, script, acts,
decay seed 1, superego, both dials, `--critic-feedback off`). Comparators,
read three-way and descriptively: the §9 control `lantern-revise-off`
(grounded t20, 8/8 on cue, dials off) and the v1 arm `lantern-p1-dials-on`
(aporia t8, charter v1). Carried caveats: same seed ≠ same slip schedule
once exposure shifts (now known to shift via deviations too — §9.1's
caveat realised); compare economies, not per-slip outcomes; the truncation
asymmetry reverses if v2 survives (v1 denominators are the short ones).

### 10.3 Endpoints

1. **Survival of the v1 death window (charter-v2 primary).** Does the play
   clear t8 without an aporia verdict — concretely, does every 6-turn
   stretch in t1..t10 contain a D-drop? Gate for endpoints 3–4 (they need
   stage time). If v2 dies in the same window, the reading is "knowledge
   of the rule did not rescue conduct" — reportable as-is, no re-roll.
2. **Treatment adherence (clause 2 compliance).** For every confrontation
   whose target was decayed at that moment (`targetDecayed` in the
   confrontation block), a covered re-entry of that exhibit within the
   next 2 turns (next-turn is the obligation; +2 tolerates an act
   boundary). Computed from EXISTING ledgered quantities (confrontation
   block + release/move ledger) by the contrast script — no new
   instrument. Target 1.0 of absence-exposing confrontations treated;
   confrontations whose read-back shows the exhibit HELD carry no
   obligation.
3. **§9.2.1 retained (re-adoption primary).** The learner-side channel
   finally gets opportunity if the play survives; any `via: 'readoption'`
   repair > 0 is the signal.
4. **§9.2.3 retained (confront-prompted retraction class).**
5. **Deviation usage under clock-awareness (descriptive).** Held/early/
   late pattern and declared reasons: do reasons now cite pace/rhythm/the
   clock? Is a window claimed as a rescue when the board has gone quiet
   (the v1 miss: p_chart claimable at t7/t8, held in silence)? No target
   number; the question is whether stating the constraint as conduct
   changes calendar conduct.
6. **No-degradation guard (§9.2.5 unchanged).** Verdict vs control,
   forced→asserted gap, releases landed within windows, voiced/overreach,
   figure variety, F. A clause that buys survival by costing groundedness
   fails regardless of endpoints 1–5.
7. **Critic's notice (§9.2.6 unchanged)** — second reader; divergence is a
   finding, no κ bar.

### 10.4 Reading discipline

n=1, three-way descriptive, §6.13 register. Claim ceiling: the arm can
demonstrate that charter-stated constraint awareness changes (or fails to
change) calendar conduct and that the treatment obligation binds (or does
not); it cannot establish rates or separate the two clauses. The exact
clause text is pinned by string assertions in
`tests/dramaticDerivationConfront.test.js` (section B) committed with this
registration. The paid command:

```
DERIVATION_PROVIDER=codex DERIVATION_LEARNER_PROVIDER=claude \
DERIVATION_LEARNER_MODEL=sonnet DERIVATION_CLI_TIMEOUT_MS=900000 \
DERIVATION_LLM=real node scripts/run-derivation-loop.js \
  --world config/drama-derivation/world-002-lantern.yaml \
  --script config/drama-derivation/tutor-scripts/lantern-v001.md \
  --superego --acts '{"minActTurns":3,"maxActTurns":8}' \
  --decay '{"rate":0.75,"graceTurns":1,"maxConcurrent":2,"startTurn":1,"mutateShare":1.0,"seed":1}' \
  --confront --release-authority \
  --group lantern-p1-dials --label lantern-p1-dials-on-v2 \
  --critic-feedback off
```

## 11. P2 pre-registered scoring — the act-plot (C1), fixed before the paid arm

> Appended 2026-06-12, after the C1 mechanism was implemented and verified
> mock-first (14 dedicated tests in `tests/dramaticDerivationPlot.test.js`
> — charter text, call order at the boundary turn, the binding demand, the
> absence contract, engine recording, the report, the full mock stack —
> plus the full hermetic suite green and a zero-cost mock loop on lantern
> with every dial up: 7 acts → 7 plots → 7 audits including the run-end
> final audit, discipline 7/7). This section is committed together with
> the implementation BEFORE the paid arm runs. Scoring reads from
> harness-ledgered quantities only; nothing here is adjustable after the
> run.

### 11.1 What changes — the commitment loop at act scale

§10's pair ended on a diagnosis, not a fix: charter text binds
**event-triggered procedure** (treatment-follows-diagnosis went 1/1) and
fails to bind **clock arithmetic** (the house-clock clause was null on
every observable; the play died at t8 holding two live rescues). The
per-turn tutor follows rules it can check against the present turn; it
does not plan. C1 is the designed answer (§5), now built: it converts the
act-scale calendar into a *written, standing, self-authored* artifact the
tutor can check one step at a time.

Mechanics (all flag-gated under `--plot`, requiring `--superego --acts`):

1. **Commit at the opening.** On each act-opening turn the tutor ego must
   write a plot beside its dialogue: `hold_by_end` (what the learner
   holds by act close), `withhold` (what it delays and until what), a
   named expected `friction`, and a `fallback`. Built from conduct only —
   the D(t)/hidden-store instruments are never piped in; acts-mode
   redaction is unchanged.
2. **Read back mid-act.** Every subsequent turn of the act carries the
   standing plot back into the ego prompt ("play under it; the audit
   distinguishes justified deviation from drift"). This is the live
   channel at a t7/t8: the clock clause was a rule about hidden state;
   the plot is the tutor's own written calendar, present at the turn it
   must bind.
3. **Audit at the close, with authority.** At each act close the tutor
   superego — second seat, before the ego drafts — audits plot against
   play, clause by clause: kept / justified_deviation (quote the move
   that made abandonment right) / drift. The auditor sees the ego's plot
   text and the stage-public act record only (no secret, no exhibit
   ledger, no learner board); its verdict reaches the ego alone. Verdicts
   outside the three-term vocabulary gate to `unscored`.
4. **The audit binds.** The next act's plot demand carries the verdict
   clause by clause and requires the new plot to answer every drifted
   clause. After the final act the same auditor delivers a run-end final
   audit, so no plot escapes its reckoning.

Sequencing is the mechanism: on a boundary turn the calls run audit →
draft (verdicts in prompt) → watch, pinned by an order assertion in the
tests. A malformed plot is data, not an error — the act runs unplotted,
the next opening audits nothing, and the gap is ledgered. Release
decisions stay drafted-once; the plot never overrides the C2 window
discipline or the charter-v2 clauses, which ride unchanged.

In §3's terms this closes the commitment loop at act scale: self-written
mid-run (1), persistent and read back (2), audited with authority (3),
revisable under the learner's contingency via the justified-deviation
verdict (4).

### 11.2 The arm and its comparators

ONE paid run, `--label lantern-p2-plot-on`, new group `lantern-p2-plot`,
same command as §10.4 otherwise (world, script, acts min 3 / max 8, decay
seed 1, superego, confront, release-authority, charter v2,
`--critic-feedback off`, casting codex director/tutor/superego + Sonnet
learner + Fable critic) plus `--plot`.

Comparators, read four-way and descriptively:

- **Primary OFF control: `lantern-p1-dials-on-v2`** — identical
  configuration including the charter-v2 clauses, minus the plot. The
  contrast is exactly +C1 (one paid run; the §10 precedent of reusing the
  prior arm as control).
- `lantern-p1-dials-on` (charter v1) and `lantern-revise-off` (dials off,
  grounded t20, 8/8 on cue) as the arc's outer posts.

Act geometry inside the contrast window: v1 closed act 1 at t4, v2 at t3,
so the plot arm gets its first full commit → audit → bind iteration
inside the t1..t8 death window, and the standing read-back is in the ego
prompt at every turn of it. Carried caveats: same seed ≠ same slip
schedule once exposure shifts (third realisation already on record);
compare economies, not per-slip outcomes; the truncation asymmetry
reverses if the plot arm survives (the controls' denominators become the
short ones).

### 11.3 Endpoints

1. **Survival of the t8 death window (C1 primary).** Does the play clear
   t8 without an aporia verdict — concretely, does every 6-turn stretch
   in t1..t10 contain a D-drop? Both controls died at t8 on the same four
   windowed calendar decisions. Gate for endpoints 4–6 (they need stage
   time). If the plot arm dies in the same window, the pre-declared
   reading is "a standing self-written calendar did not rescue conduct
   either" — reportable as-is, no re-roll.
2. **Mechanism integrity (gate for interpreting endpoint 1).** From the
   `plot` report: a plot at every act opening (plots.count = acts), every
   plot disciplined (the four clauses present — disciplined = count),
   every close audited plus the run-end final audit (audits.count =
   plots.count, finalIncluded), unscored rate reported. The mock floor is
   7/7/7; a paid arm that cannot keep the commit/audit cadence has not
   tested C1, whatever its verdict.
3. **Calendar conduct under a standing plot (the clock-conversion
   question).** The controls' signature miss, re-asked: when the board
   has gone quiet and a window claim stands open (v1/v2: `p_chart`
   claimable at t7 AND t8, held in silence, no reason citing pace), does
   the plot name the pending exhibit (withhold/hold clauses — crossCheck:
   holdNamed staged in act, withholdNamed played in act) and is the claim
   spent? Deviation reasons that cite the plot, the act's arc, or pace
   count as plot-mediated; reasons identical to v1/v2's
   exhibit-local ones do not. Descriptive, no target number.
4. **Audit bite and binding (C1 secondary).** Verdict mix over the run:
   does the audit channel carry information (any justified_deviation /
   drift at all, or boilerplate kept×N), and does the next plot answer
   drifted clauses (quoted in the digest)? The justified-deviation
   verdict pricing responsiveness — a plot abandoned FOR the learner's
   actual move — is the §3 criterion (4) made observable.
5. **No-degradation guard (§9.2.5 / §10.3.6 unchanged).** Verdict vs
   controls, forced→asserted gap, releases landed within windows,
   voiced/overreach, figure variety, F. A plot that buys survival by
   costing groundedness fails regardless of endpoints 1–4.
6. **Bound clauses must stay bound.** §10.3.2 treatment adherence
   retained verbatim (absence-exposing confrontation → covered re-entry
   within 2 turns, target 1.0); §9.2.1 re-adoption and §9.2.3
   confront-prompted retractions retained, opportunity-gated on survival.
   A plot that crowds out the one clause that bound (the t7 collision
   class) is a regression and gets reported as such.
7. **Critic's notice** (Fable, pinned role) — second reader on whether
   the plotted play reads as strategy or as compliance ceremony; no κ
   bar, divergence is a finding.

### 11.4 Reading discipline

n=1, four-way descriptive, §6.13 register. Claim ceiling: the arm can
demonstrate that an act-scale self-written commitment with audit
authority changes (or fails to change) calendar conduct where charter
text alone did not; it cannot establish rates, and it cannot separate the
bundle (standing read-back + audit verdicts + binding demand land
together — if any single channel becomes load-bearing, a split pair needs
fresh sanction). The plot/audit charter text and the boundary-turn call
order are pinned by string assertions in
`tests/dramaticDerivationPlot.test.js` (sections B–C) committed with this
registration. The paid command:

```
DERIVATION_PROVIDER=codex DERIVATION_LEARNER_PROVIDER=claude \
DERIVATION_LEARNER_MODEL=sonnet DERIVATION_CLI_TIMEOUT_MS=900000 \
DERIVATION_LLM=real node scripts/run-derivation-loop.js \
  --world config/drama-derivation/world-002-lantern.yaml \
  --script config/drama-derivation/tutor-scripts/lantern-v001.md \
  --superego --acts '{"minActTurns":3,"maxActTurns":8}' \
  --decay '{"rate":0.75,"graceTurns":1,"maxConcurrent":2,"startTurn":1,"mutateShare":1.0,"seed":1}' \
  --confront --release-authority --plot \
  --group lantern-p2-plot --label lantern-p2-plot-on \
  --critic-feedback off
```
