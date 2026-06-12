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
