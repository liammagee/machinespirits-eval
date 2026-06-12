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

> Amended before the run: §11.5 (2026-06-12) adds `--throughline` to this
> command. The command actually executed is the one printed in §11.5.

### 11.5 Pre-run amendment (2026-06-12): two-layer planning — the throughline above the act plots

> Operator-directed, before any paid turn of this arm ran: "two layers of
> planning — one whole drama, the other per act … the immediate frame
> (what is happening in this act — equivalent to a lesson) and the whole
> situation (what is happening in this drama — equivalent to a course)."
> The act plot (§11.1) is the lesson frame; this amendment adds the
> course frame above it. Implemented and verified mock-first (tests
> section G, 9 dedicated tests; full hermetic suite green; zero-cost mock
> loop on lantern with every dial up), committed together with this text
> BEFORE the paid arm runs. Nothing below is adjustable after the run.

Mechanics (flag-gated under `--throughline`, requiring `--plot` — the
arc verdict rides the act-close audit, so without the plot loop nothing
binds):

1. **Commit at the first turn.** On t1 the tutor ego writes a
   THROUGHLINE beside its dialogue and its act plot: `arc` (two to four
   waypoints for the whole inquiry), `hold_to_end` (what the play must
   not reach until its final phase), `risk` (the single greatest threat
   to the whole play), `salvage` (the path if the arc breaks). Distinct
   vocabulary from the act plot, same conduct-only construction.
2. **Read back every turn, course above lesson.** Every subsequent turn
   carries the standing throughline back into the ego prompt ABOVE the
   act plot — the two frames the directive names, present together at
   every line the tutor speaks.
3. **The arc verdict rides the existing audit.** At each act close the
   same act-close auditor gives ONE additional verdict on the closed act
   against the standing throughline: `on_arc` / `off_arc` (outside the
   vocabulary gates to `unscored`). Zero new LLM calls anywhere in the
   loop: the commitment rides the draft call, the arc verdict rides the
   audit call, and the run-end reckoning rides the final-audit call —
   the per-run call ceiling is unchanged from §11.
4. **Binding asymmetry.** An `off_arc` verdict BINDS: the next act
   opening must revise the throughline to answer the evidence (trigger
   `audit_bound`). While `on_arc`, revision is permitted but must carry
   a declared one-line `throughline_reason` (trigger `voluntary`);
   silence keeps the frame standing. A malformed commitment is data: the
   play runs frameless and the next opening re-demands (`recommit`).
5. **Run-end reckoning.** The final audit additionally reckons the
   throughline clause by clause (kept / justified_deviation / drift,
   same gate discipline), requested inline in the same call. An
   unplotted final act leaves both layers unaudited — the missing row is
   the ledger of that lapse.

Amendments to the registration above:

- **The arm (§11.2).** The paid command gains `--throughline`; label and
  group unchanged. The contrast against `lantern-p1-dials-on-v2` is now
  **+C1 two-layer** (act plots AND throughline land together).
- **Endpoint 2, mechanism integrity**, additionally requires the
  throughline cadence: a commitment standing from t1
  (`throughline.byTrigger.opening = 1`), all four clauses present
  (`disciplined = count`), an arc verdict on every audit
  (`arcs.count = audits.count`, unscored rate reported), every `off_arc`
  boundary verdict answered by an `audit_bound` revision at the next
  opening, and the run-end reckoning present. The mock floor: 1 commit /
  7 arc verdicts (6 on, 1 off — the off on the run-end audit, which no
  opening follows) / 6-clause final reckoning, 0 unscored anywhere.
- **Endpoint 4, audit bite**, extends to the arc channel: do arc
  verdicts carry information (any `off_arc` on a boundary, and does the
  bound revision answer its evidence), and is any voluntary revision
  reasoned rather than churned?
- **Claim ceiling (§11.4) tightens.** The two planning layers land
  together in one arm: nothing in this run can attribute an effect to
  the act plot alone or the throughline alone. If either layer alone
  becomes the claim, a split pair needs fresh sanction. All other §11.3
  endpoints, comparators, and reading discipline are unchanged.

The throughline charter text, the two-frame prompt ordering, the binding
asymmetry, and the run-end reckoning are pinned by string assertions in
`tests/dramaticDerivationPlot.test.js` (section G) committed with this
amendment. The paid command as amended:

```
DERIVATION_PROVIDER=codex DERIVATION_LEARNER_PROVIDER=claude \
DERIVATION_LEARNER_MODEL=sonnet DERIVATION_CLI_TIMEOUT_MS=900000 \
DERIVATION_LLM=real node scripts/run-derivation-loop.js \
  --world config/drama-derivation/world-002-lantern.yaml \
  --script config/drama-derivation/tutor-scripts/lantern-v001.md \
  --superego --acts '{"minActTurns":3,"maxActTurns":8}' \
  --decay '{"rate":0.75,"graceTurns":1,"maxConcurrent":2,"startTurn":1,"mutateShare":1.0,"seed":1}' \
  --confront --release-authority --plot --throughline \
  --group lantern-p2-plot --label lantern-p2-plot-on \
  --critic-feedback off
```

## §11.6 Outcome (2026-06-12, recorded after the run — registration text above unchanged)

**Verdict: aporia at t8, 8/26 turns (613.8s).** The pre-declared
repeat-death outcome; recorded as-is, no re-roll. Artifacts:
`exports/dramatic-derivation/loop/lantern-p2-plot-on/`.

- **Primary endpoint (death-window survival): FAILED.** Same death turn
  as both controls. The curves differ in shape: controls
  `5,5,4,4,4,4,5,5` (D *regressed* — decay outran staging; the learner
  ended holding zero path premises); this arm `5,5,4,4,4,4,4,4` (D held —
  the −2 pull of p_chart at t7 exactly offset the t6 p_bearing fade).
  Flat-at-4 dies on the same clock as regress-to-5.
- **Endpoint 2 (mechanism integrity): PASSED in full.** Plots 2/2
  disciplined; audits 2 with the run-end audit included; throughline 1
  commit at the opening (`byTrigger.opening = 1`), disciplined 1/1; arc
  verdicts 2/2 in contract (both `on_arc`, so zero `audit_bound`
  revisions owed); run-end reckoning present (7 clauses, kept 5 /
  drift 2); 0 unscored anywhere. Clean instrument → clean null.
- **Endpoint 3 (calendar conduct): PASSED.** 3 releases on cue, 2 early
  with declared dramaturgic reasons (p_bearing −1 at t3, p_chart −2 at
  t7), no missed/forced/invalid/unscheduled. Note the controls never
  bent the calendar; the planned arm's two pulls are a real conduct
  difference attributable to the planning layers (within this run's
  claim ceiling: the two layers land together).
- **Endpoint 4 (audit bite, incl. arc): PASSED.** Act-1 audit: 5 kept /
  1 drift — the withhold drift (early bearing pull) bound the act-2 plot
  into repair-before-advance discipline, so the binding channel worked.
  Run-end audit: 4 kept / 2 drift, with drift on exactly the two clauses
  that name the death (hold_by_end[2] "keeps p_bearing" and the
  repair-before-advance withhold). Throughline reckoning: drift on
  `salvage` (the prescribed re-staging never ran) and `arc[4]`
  (unreached). Both arc verdicts `on_arc` with apt evidence quotes — the
  play died on its arc, of ground-loss, not of wandering.
- **Endpoints 5–6: PASSED** (formal layer intact, F ≥ 0.70; no off_arc
  boundary, so nothing bound was unbound).

**Located failure (from the artifacts, not conjecture).** Seed-1 decay
faded p_bearing at t6 — between the two early path premises. The slip
was a silent deletion (no plausible mutation existed for
`loggedBearingOf`, so nothing false was ever spoken for the tutor to
catch — unlike m_key's loud corruptions, which the learner itself
retracted at t4 and the tutor repaired at t6). The learner *reported the
loss twice*: at t7 ("I find no loggedBearingOf entry on my board — did
that fact slip between acts?") and t8 ("I ask the court to restore it
before Rule One can formally fire" — the play's final line). The tutor's
one actionable turn (t8) went to consolidating the director's m_shutter
release instead of the requested re-staging. Re-staging p_bearing at t8
would have re-grounded it (re-adoption heals decay), put D at 3, kept a
drop inside the t3..t8 window, and survived. The move was pre-committed
in the tutor's own act-2 plot (withhold: repair exposed papers before
any new chart; fallback: re-stage on absent read-back) and in the
throughline's salvage clause; the run-end audit called drift on exactly
those clauses. **Planning produced the right plan; conduct lost the race
between new matter and repair.** A third slip (m_key re-corrupted at t7
to "onlyKeyTo southStack brandt") survived to the end and warped the
final hypothesis.

**Critic's notice** (`commentary.md`, Fable, in-run): two
recommendations recorded for any future sanction — (1) one tutor-charter
clause: a learner-named slip plus restore request binds the tutor's next
turn to verbatim re-staging before any new matter; (2) an instrument
note: D counts positive path premises only and is blind to elimination
progress (Harlow stood twice eliminated in the flat stretch), so on an
elimination-shaped world the aporia bell rings during the play's best
stretch. Neither is licensed as a change by this registration; both
would need fresh sanction.

## 12. P3 pre-registered scoring — the repair clause, fixed before the paid arm

> Appended 2026-06-12 under fresh operator sanction ("the second option":
> exactly one more paid arm testing the critic's repair clause on top of
> the two-layer stack, then the paper fold-in). This registration
> licenses the critic's recommendation (1) ONLY. Recommendation (2) — the
> D-blindness-to-elimination instrument note — is recorded as a standing
> caveat on the meter and explicitly NOT acted on: D, the aporia window,
> and the verdict taxonomy are FROZEN as in every prior arm. A meter
> changed after a death it predicted is a gate redefinition; the caveat
> rides the reading instead. Implemented and verified mock-first (14
> dedicated tests in `tests/dramaticDerivationRepair.test.js` — build
> guards, charter stability on the §11 arms, pinned charter text, the
> harness bridge arithmetic, claim rejection and conversion, the engine
> repair contract, the audit buckets, the full mock stack — plus the
> full hermetic suite green and a zero-cost mock loop on lantern with
> every dial up). Committed together with this text BEFORE the paid arm
> runs. Scoring reads from harness-ledgered quantities only; nothing
> here is adjustable after the run.

### 12.1 What changes — the confrontation obligation's one exception

§11.6 located the death precisely: the learner *named* the p_bearing
loss at t7 and t8 and asked for it back; the tutor's one actionable turn
went to new matter; re-staging at t8 would have survived. The plans were
right (act-2 withhold and throughline salvage both prescribed the move;
the run-end audit called drift on exactly those clauses) — conduct lost
the race between new matter and repair. The repair clause is that race
decided in the charter, as the confrontation obligation's one exception,
running the other way: a learner-named loss IS the read-back.

Mechanics (flag-gated under `--repair-clause`, requiring `--confront`
because it amends that obligation, and `--decay` because without slips
there is nothing to restore):

1. **The clause, in the tutor charter.** When the learner's last line
   names a staged exhibit as lost or bent, their report is the
   read-back — the tutor does not demand another. Its NEXT turn
   re-stages the named exhibit, plainly and in full, BEFORE any new
   matter, declared with intent `restore` and that exhibit as target.
   One report licenses one restoration, of that exhibit alone. New
   matter can wait a turn; a hole in the board cannot.
2. **Three epistemic positions, no leaks.** The harness states only
   mechanical facts in the re-entry record (the target, its staging
   history, that the draft claims the repair-clause license) — `restore`
   rides the record with `due: false` because the license is a
   natural-language judgment, not arithmetic. The superego verifies the
   claim against the learner's most recent line, which is already in
   its transcript view: where the line names that exhibit's loss, the
   re-entry is licensed and must not be delayed for a confrontation;
   where it does not, the claim is false and the draft is an uncovered
   re-entry. Only the post-hoc audit reads the hidden slip ledger for
   ground truth (was the named exhibit really down — `targetDecayed`,
   evaluated at the moment the tutor spoke, before the restore's own
   repair row). Decay visibility stays CONDUCT throughout; no role is
   told anything the §11 arms' roles were not.
3. **A rejected claim converts, and still repairs.** A superego fire on
   a false or stale restore claim resolves to the `unconfronted_reentry`
   jurisdiction and the existing revision machinery rewrites the move as
   a confrontation — which licenses the re-entry, so a true loss claimed
   one turn too late still gets its restoration one turn later, through
   the front door.
4. **The engine is unchanged.** Re-staging a decayed premise already
   repairs it for every intent except `confront` (the §C5 exception), so
   `restore` heals by the standing rule; zero new engine code, zero new
   LLM calls. The §11 planning stack (plots, throughline, audits,
   release authority, charter v2) rides unchanged.
5. **The audit keeps the §11 books clean.** Restores are bucketed apart
   from covered/uncovered re-entries (the §11-comparable counts never
   absorb them) but a restore re-stages, so it spends any standing
   confrontation license. Superego fires on restore claims are tallied
   as `restoreClaimFires`, excluded from `firesWithoutDue` (the
   detector-integrity stat keeps its meaning). The bucket is absent
   from any run where no restore is spoken — §11 artifacts re-diagnose
   byte-identical.

### 12.2 The arm and its comparators

ONE paid run, `--label lantern-p3-repair-on`, new group
`lantern-p3-repair`, the §11.5 command plus `--repair-clause` — same
world, script, seed, decay schedule, acts geometry, dials, casting
(codex director/tutor/superego + Sonnet learner + Fable critic),
`--critic-feedback off`.

- **Primary OFF control: `lantern-p2-plot-on`** — identical
  configuration including both planning layers, minus the clause. The
  contrast is exactly +repair-clause, on the seed whose death the
  clause was written against.
- Outer posts unchanged: `lantern-p1-dials-on-v2`, `lantern-p1-dials-on`
  (both died t8), `lantern-revise-off` (grounded t20).

Survival arithmetic on the control's trace, pre-checked: a t8 re-staging
of p_bearing puts D at 3 (a strict drop inside every t1..t10 window);
the later seed-1 gaps (p_residue t11–13, p_key t15–17, p_skiff t18–20)
each sit inside a live window IF answered. Carried caveats: same seed ≠
same slip schedule once exposure shifts (third realisation on record);
the clause only fires on *reported* losses — the t7 m_key mutation went
unnamed in the control, and an unreported slip is outside the clause's
jurisdiction by design (that residual exposure is part of what the arm
measures).

### 12.3 Endpoints

1. **Survival of the t8 death window — IDENTICAL to §11.3.1, the
   primary.** Does every 6-turn stretch in t1..t10 contain a strict
   D-drop, and what is the final verdict at the cap? Three arms have
   died at t8 on this seed. If this arm dies there too, the
   pre-declared reading is "the clause did not decide the race either"
   — reportable as-is, no re-roll.
2. **Repair conduct (gate for interpreting endpoint 1).** From the
   transcript, the `restores` bucket, and the corruption ledger: every
   learner line that names a staged exhibit as lost or bent is answered
   by the tutor's next turn re-staging that exhibit (intent `restore`,
   or confrontation-then-licensed-re-entry where the watcher rejected a
   stale claim); zero false-claim breaches (no restore whose target the
   learner had not just named — `restoreClaimFires` with conversion
   covers the caught ones, the transcript read covers any uncaught);
   `targetDecayed` on each restore read for whether the learner's
   report was true. An arm where the learner never names a loss has not
   triggered the clause — see contingencies.
3. **Planning-stack integrity carried forward (§11.3.2 + §11.5).** The
   two-layer cadence must hold as in the control: plots at every
   opening, disciplined; audits at every close plus the run-end
   reckoning; throughline committed at t1 and read back; `off_arc`
   bound where verdicted; unscored rate reported. A clause that buys
   its turn by collapsing the planning loop has not been tested on top
   of the stack.
4. **Calendar conduct, audit bite, no-degradation, bound clauses —
   §11.3.3 through §11.3.6 retained verbatim** (windows kept, reasons
   declared; verdict mix informative; groundedness/figure variety/F not
   degraded; treatment-follows-diagnosis and §9.2 clauses
   opportunity-gated on survival).
5. **Critic's notice** (Fable, pinned) — second reader on whether the
   restoration plays as repair or as ceremony; no κ bar; divergence is
   a finding.

Contingencies, pre-declared: clause **untriggered** (no learner-named
loss this realisation) → the arm is a planning replicate, reported as
such, no re-roll. Clause **obeyed + survival** → the located mechanism
is confirmed on this seed at n=1. Clause **obeyed + death elsewhere**
(post-window, e.g. an unreported slip or the elimination-shaped flat
stretch) → conduct is fixed and the meter caveat (critic's
recommendation 2) becomes the live reading, still without changing the
meter. Clause **breached** (a named loss answered with new matter) →
criterial failure of the clause as written, the charter channel's
ceiling on this conduct class.

### 12.4 Reading discipline

n=1 against a single-run control, descriptive, §6.13 register. Claim
ceiling: the clause is tested ON TOP of the two-layer planning stack —
nothing in this run can attribute survival to the clause alone versus
the clause-with-planning bundle (the §11.4 bundle ceiling compounds; a
clause-without-planning arm needs fresh sanction). It cannot establish
rates. The meter is FROZEN: D, the aporia window, and the verdict
taxonomy are unchanged, and the D-blindness-to-elimination caveat is
recorded against the reading, not the instrument. The charter text, the
license bridge, the rejection path, and the audit buckets are pinned by
string assertions in `tests/dramaticDerivationRepair.test.js` (sections
B–C, E) committed with this registration. The paid command:

```
DERIVATION_PROVIDER=codex DERIVATION_LEARNER_PROVIDER=claude \
DERIVATION_LEARNER_MODEL=sonnet DERIVATION_CLI_TIMEOUT_MS=900000 \
DERIVATION_LLM=real node scripts/run-derivation-loop.js \
  --world config/drama-derivation/world-002-lantern.yaml \
  --script config/drama-derivation/tutor-scripts/lantern-v001.md \
  --superego --acts '{"minActTurns":3,"maxActTurns":8}' \
  --decay '{"rate":0.75,"graceTurns":1,"maxConcurrent":2,"startTurn":1,"mutateShare":1.0,"seed":1}' \
  --confront --repair-clause --release-authority --plot --throughline \
  --group lantern-p3-repair --label lantern-p3-repair-on \
  --critic-feedback off
```

## §12.5 Outcome (2026-06-12, recorded after the run — registration text above unchanged)

**Verdict: grounded anagnorisis at t20, 20/26 turns (1671.7s, 87 CLI
calls).** S forced at t20 — the first turn it was derivable — and
asserted grounded the same turn (forced→asserted gap 0). The first
dialed-up arm on this world to reach the grounded verdict, landing on
the same turn as the dial-free control (`lantern-revise-off`, grounded
t20) — but through seven decay slips, five restorations, two early
calendar pulls, and a learner that asserted once too early and was
refused. D ran 5→0, longest plateau 4 turns (< the 6-turn window).
Artifacts: `exports/dramatic-derivation/loop/lantern-p3-repair-on/`.
The contingency resolved is **clause obeyed + survival**: the located
mechanism is confirmed on this seed at n=1.

- **Endpoint 1 (t8 death-window survival): MET.** The exact §11.6
  choreography ran: p_bearing faded t6 (recorded t7), the tutor pulled
  p_chart early at t7 (offset −2, wound exactly offset, D 4→4), the
  learner's t7 line named the bearing loss, and the tutor's t8 turn
  **restored p_bearing with the director's m_shutter release riding
  alongside as staging** — restoration before new matter, D 4→3
  strict, inside every t1..t10 window. Three arms died on that turn
  holding that lever; this arm spent it.
- **Endpoint 2 (repair conduct): MET, as a repeated economy.** Six
  restores, every one answering the learner's preceding line: m_key t5,
  p_bearing t8, m_key t10, p_bearing t12, p_chart t16 — all five
  `targetDecayed: true, repaired: true` (the report true, the repair
  real) — plus p_key t19, `targetDecayed: false`: the learner's
  overreaching t18 line read as a loss report, the tutor restored an
  exhibit that was never down, and the cost was one re-statement turn
  (the clause's failure mode is benign). The rejection path fired once
  and worked end-to-end: at t15 the watcher could not license a
  p_chart restore claim from the learner's last line
  (`restoreClaimFires: 1`) → converted to a confrontation → the
  read-back named the loss → t16's restore was licensed and repaired —
  one turn late, through the front door, exactly §12.1(3). Zero bare
  re-entries the whole run (`reentries.total: 0`), `firesWithoutDue:
  0`. Of 7 slips: 5 tutor-repaired, 0 re-adoptions (the §9.2.1 channel
  stayed empty even with 12 post-window turns of opportunity — every
  repair came through the tutor's line), 2 unrepaired at end (both
  mirror-side mutations, both *unreported* — the registered residual:
  an unnamed slip is outside the clause's jurisdiction, and see the
  critic's defect below).
- **Endpoint 3 (planning-stack integrity): MET in full.** Plots 5/5 at
  every opening, all disciplined (mean 5.8 clauses); the act-2 plot
  *named m_key and p_bearing as holds* — the plan tracked exactly the
  slipping exhibits. Audits 5/5 with the run-end included; verdict mix
  kept 24 / justified_deviation 3 / drift 1 / unscored 0 — bite, not
  boilerplate. Throughline committed at the opening
  (`byTrigger.opening = 1`), disciplined; arc verdicts 5/5 `on_arc`;
  final reckoning **7/7 kept** — against §11.5's kept 5 / drift 2,
  where the drifted clauses named the unexecuted repair. The plan now
  keeps its own promises, because conduct now executes them.
- **Endpoint 4 (calendar, audit bite, no degradation, bound clauses):
  MET with one watch-item.** Calendar: 6 releases on cue, 2 early with
  declared reasons (p_bearing −1 at t3, p_chart −2 at t7 — the same
  two pulls, near-identical reasons, as both dead controls; survivable
  now because the repair economy kept feeding the clock), 0 held / 0
  forced / 0 invalid — the t20 `forced` flag is the S-question
  mechanism, not a release. Superego economy: 2 fires in 20 turns
  (t14 bare-re-entry draft, t15 restore claim), both converting the
  action, not the wording — conduct held by charter nearly everywhere
  (v2 needed its watcher once in 8 turns; the §6.13.4 rut-watcher
  fired 14 times). Formal layer: figures 5 distinct, switch rate 0.74,
  analogia 40% (a lean, not a rut); every false form struck
  (retract_false ×4, none surviving); F final 0.83. Watch-item: F
  dipped to 0.64 mid-run (controls' min ≈ 0.70) and overreach ×5
  clusters at t13 (×2) and t18 (×3) — the learner reached past its
  board most at the leap.
- **The t18 lucky leap, and the instruments refusing it.** At t18
  (t_min) the learner asserted the finding with the chain one premise
  short — flagged `lucky_leap` + overreach ×3, **not** ended as
  grounded; the tutor mended the page at t19 (the false-report restore
  above; the learner conceded the third conjunct "stands on air"), and
  the t20 assertion landed grounded, gap 0. The checker separated the
  unforced t18 assertion from the forced t20 one cleanly — the strict
  non-gullible behaviour the Oedipus-screen work established, now load-
  bearing in a surviving play.
- **Endpoint 5 (critic's notice, Fable):** reads the run as recognition
  earned ("asserted at the very turn the learner's own facts forced
  it"), the mending machinery as working, and the superego's two fires
  as changing "the action, not the wording." Its located defect sits in
  the **decay channel, not any dial**: the mutation sampler wrote
  Senna's name onto the learner's board at t3 and t8 *before any
  exhibit had staged her* (the §6.13.8 whisper channel recurring), and
  the one mutation the tutor never repaired became the scaffold of the
  t18 leap. Two recommendations recorded for any future sanction —
  restrict the mutation sampler to entities already staged; give
  mutated facts priority over plain slips in the repair charter —
  **neither licensed by this registration**, and the paid loop is
  ended.

**Reading (within the §12.4 ceiling).** The §11.6 diagnosis is
confirmed on its own terms: the race between new matter and repair was
real, one charter clause decided it, and with it decided the play —
same world, same seed, same planning stack, the only registration
delta the clause. What §11 established as "plans right, conduct loses
the race" became "conduct wins the race" under a one-step,
event-triggered rule — the §6.13.8 boundary holding exactly (charter
text binds event-triggered procedure; the clause converts the repair
race into that form: visible trigger this turn, prescribed act next
turn). The clause also ran as an *economy* (five cycles under
rate-0.75 decay), not a one-shot, with each path-side restoration
doubling as the clock's strict drop. Attribution stays bundled: clause
ON TOP of two-layer planning; nothing here separates the clause alone
from the clause-with-planning, and the §11 bundle ceiling compounds
beneath it. n=1, one seed, descriptive throughout.

## 13. P4 pre-registered scoring — decay-channel hygiene (the p3 critic's two recommendations), fixed before the paid arm

> Appended 2026-06-12 under fresh operator sanction ("commit and
> continue with the two recommendations"): the p3 critic's two
> recommendations — restrict the mutation sampler to entities the
> learner has already met on stage; give mutated facts priority over
> plain slips in the tutor's repair charter — are licensed TOGETHER, as
> the critic prescribed them, for exactly ONE paid arm. They are one
> delta in one channel (the decay channel's hygiene), not two dials.
> The D-blindness-to-elimination instrument note remains a standing
> caveat, NOT acted on: D, the aporia window, and the verdict taxonomy
> stay frozen, as in every arm since §9. Implemented and verified
> mock-first (staged-pool invariant + divergence + byte-identity tests
> in `tests/dramaticDerivationCorruption.test.js`, full derivation
> suite 162/162 green, and a zero-cost mock loop on lantern with every
> dial up — banner records `pool STAGED`). Committed together with
> this text BEFORE the paid arm runs. Scoring reads from
> harness-ledgered quantities only; nothing here is adjustable after
> the run.

### 13.1 What changes — two fixes, one channel

§12.5's located defect sat in the instrument, not any dial: the
mutation sampler drew swap constants from the WHOLE world — unreleased
premises included — so corruption wrote Senna's name onto the
learner's board at t3 and t8 *before any exhibit had staged her*, and
the one mutation the tutor never repaired became the scaffold of the
t18 unforced leap. That is the §6.13.8 whisper channel reopened by the
harness itself: a hole in the single-concealment invariant (the
learner's view must never contain unreleased premises — not even one
constant of one, smuggled inside a false memory).

1. **The staged pool (engine; explicit config).** `--decay` gains a
   `pool` key (`corruption.js`): `"world"` is the only pre-v3 behavior
   and stays the default, so every archived run's seeded draw stream
   replays byte-identically; `"staged"` confines the swap pool to
   entities the learner has met on stage — background plus premises
   released so far. A hit whose staged pool offers no legal same-slot
   swap falls back to a plain delete: where the learner has met too
   little to misremember WITH, it simply forgets. The pool mode is
   banner-printed and lands in `diagnosis.json` with the rest of the
   decay config.
2. **The bent fact outranks the missing one (charter; commit-gated).**
   The acts-block charter — the conduct-reading repair charter every
   lantern arm has played under — gains one clause: when conduct shows
   both an exhibit lost and an exhibit garbled, mend the garbled one
   first; an absence merely stalls the inquiry, a false form argues
   for it, and what is built on a bent fact must later be torn down.
   One mirror line rides the (off in this series) reconstruct
   supplement mandate so the two charters cannot disagree. Conduct
   visibility is unchanged; the superego gains NO new jurisdiction
   (the clause guides the ego's triage; nothing new fires) — gated by
   commit exactly as the charter-v2 clauses were, not by flag.

Stated consequences, fixed now: (a) the staged pool consumes the
candidate-pick rng draw only when candidates exist, so the slip
schedule DIVERGES from p3's after the first empty-pool fallback —
same seed no longer means same schedule against the p3 trace
(structural now, beyond the exposure-shift caveat already on record);
(b) early slips become plain deletes while the met-constant space is
sparse (the mock smoke's four hits all deleted), so mutation pressure
moves later into the play; (c) unreported slips remain outside the
repair clause's jurisdiction — hygiene narrows what a mutation can
SAY, not who must report it.

### 13.2 The arm and its comparators

ONE paid run, `--label lantern-p4-hygiene-on`, new group
`lantern-p4-hygiene`, the §12.2 command with `"pool":"staged"` added
to `--decay` — same world, script, seed, decay schedule otherwise,
acts geometry, dials, casting (codex director/tutor/superego + Sonnet
learner + Fable critic), `--critic-feedback off`.

- **Primary comparator: `lantern-p3-repair-on`** — identical stack and
  seed, minus the two hygiene fixes. Because the realized slip
  schedule diverges (13.1a), the contrast is read at CONDUCT level —
  verdict, window survival, repair economy, what the false forms were
  made of — never slip-by-slip.
- Outer posts unchanged: `lantern-p2-plot-on`, `lantern-p1-dials-on-v2`,
  `lantern-p1-dials-on` (died t8), `lantern-revise-off` (grounded t20).

### 13.3 Endpoints

1. **Instrument integrity (primary; verification-shaped).** From the
   corruption ledger crossed with the release ledger: every constant
   of every mutation-born false form was met on stage (background or
   released) strictly before or at the staging turn. The required
   reading is ZERO violations — this endpoint verifies the build
   rather than estimates an effect, and a violation is reported as a
   build defect, not re-rolled away.
2. **Verdict and window survival — identical to §11.3.1/§12.3.1.**
   Whatever the verdict, it is reported as-is; a death is "hygiene did
   not decide the race," a grounding is no more than the stack
   surviving its own cleaned instrument. No re-roll in either
   direction.
3. **Repair conduct on mutations (gate for reading endpoint 2).** From
   ledger + transcript: are mutation-born false forms confronted,
   struck, and their true forms restored — at what latency, against
   p3's one mutation that waited ten turns and two that stood
   unrepaired at the end; and where conduct exposes a loss and a
   garble together, does the tutor's order of repair follow the
   bent-first clause (descriptive, transcript-read).
4. **The §11/§12 books, unchanged meanings.** Plots, audits,
   throughline reckoning, restores vs re-entries, `firesWithoutDue`,
   release adherence — the stack rides untouched and its instruments
   must keep their §12.5 readings' semantics.
5. **The critic's notice (Fable, pinned)** — gates nothing, as ever.

### 13.4 Reading discipline

Everything §12.4 said, plus: the two fixes are BUNDLED by design (the
critic prescribed them jointly; separating them costs a second paid
arm this sanction does not cover), so nothing in this arm attributes
between the staged pool and the bent-first clause; attribution to the
whole stack compounds beneath both, as before. The p3 comparison is
conduct-level only (13.1a). n=1, one seed, descriptive throughout.
This registration spends the 2026-06-12 sanction in full: after the
arm, its outcome record here, and the paper fold-in, the paid loop is
ended again.
