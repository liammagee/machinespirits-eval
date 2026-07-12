# Green Room Gate-1 diagnosis — why coached memory didn't change behaviour

2026-07-12. Companion to `GREEN-ROOM-PLAN.md` §7 (Gate-1 FAIL: 3/17 notes improved,
18% vs the 60% bar; placebo 0/2) and the evidence at
`exports/greenroom-gate1-2026-07-12/`. This note records the post-mortem
analysis that feeds the paper section's discussion; it originates no new
empirical claims beyond the committed gate artifacts.

## The result being explained

A judge-tier coach (Opus 4.8) held six dialogic notes sessions with a Sonnet-5
tutor across an eight-performance arc on world-005-marrick (proof_skipper
learner, headroom flags). Notes were craft-grade (Gate 0: owner-scored 5/5)
and were distilled into a token-budgeted prompt book injected into the tutor's
system prompt for every post-note performance. Per-note behavioural compliance
did not improve: 3/17 scoreable notes, placebo 0/2.

## Ranked diagnosis

**1. Wrong channel — advice as passive text vs behaviour in a policy layer.**
The book entered as a static system-prompt block. The stub's turn-level
behaviour is substantially steered elsewhere: per-turn advisories (classifier,
learner-DAG, discourse, closure, comprehension) that are fresh and
situation-specific every turn, plus the register/stance-selection layer that
picks the tutor's posture *before* generation. The behaviours the coach
targeted (when to hold, when to hand over the verdict) are partly owned by
that stance machinery — which never reads the book. Local, fresh signals
rationally dominate a standing paragraph about past lives.

**2. Wrong grain — notes as micro-programs requiring real-time
self-monitoring.** The v6 book's entries are conditional procedures ("before
re-speaking, name two divergent next-moves; break the hold only when the
learner's line carries a legitimacy-claim word, not a completion word").
Executing them requires the tutor to (a) recognize the triggering situation
in-flight and (b) run a self-audit mid-generation — precisely the skills whose
absence the coach was diagnosing. The coach's own session 2 flagged that the
tutor "has no counter for its own repetition," then the book kept adding
self-monitoring obligations. Human actors convert such notes into behaviour
through rehearsal; the gate design (deliberately, for cost) went note →
performance with no rehearsal arm.

**3. Trained priors beat standing instructions.** The flagged habits (closing
for the learner, re-glossing, reassuring) are deep dispositions reinforced by
the local pull of every turn. This replicates Finding 11 (insight–action gap)
at the training level and rhymes with A16 (§6.3.10): superego-authored prompt
rewrites, even cumulative, did not shift per-turn behaviour. In-context text
changes what the model *says about* its teaching more easily than its
interactional *policy*. The one in-repo architecture that reliably moves
register-level behaviour — the id-director — replaces the whole persona per
turn rather than amending it.

**4. Secondary: blunt measurement.** Rare triggering situations, n=1–4 binary
observations per note, strict n/a discipline, haiku judge. This could hide a
small real effect; it cannot explain 18% vs a 60% bar. Recorded without
un-failing the gate.

## What the failure localizes

Not the coach (Gate 0 passed), not memory hygiene (the book curated *down* —
three edits, net compression, v6 = 534/1800 tokens — the anti-accumulation
behaviour the rich-memory arc lacked), not the apparatus (all gates ran,
provenance intact). The failure is the last inch: written insight → enacted
policy. The bottleneck looks like situation-*recognition* at performance time,
not knowledge of what to do.

## Levers a successor item would test (new pre-registration, not a retry)

1. **Compile notes into the mechanism**: the stub already computes the trigger
   quantities (`field.velocity`, `dag.velocity`, the stagnation composite);
   "after two re-glosses, force a hold" can be a register-policy constraint
   instead of prose.
2. **Rehearsal between note and performance** (the unrun T2/T4 arms): notes as
   things practiced, not read.
3. **Side-coaching** (the unrun mid-performance whisper, reserved cell 206):
   deliver the note at the moment its situation arises — the coach does the
   situation-recognition, the actor only complies. Cleanest attack on the
   diagnosed bottleneck.
4. Constrain coaching to high-frequency predicates so compliance denominators
   are dense enough to measure cheaply.
