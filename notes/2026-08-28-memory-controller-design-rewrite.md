# Memory and curriculum controller — design rewrite against current evidence

Zero-call. Workplan item `adaptive-curriculum-memory-controller`. This note
replaces the card's Phase-6 design, which was written on 2026-07-11 against a
prerequisite that has since been killed. It authorizes nothing.

## Why the old design is superseded

The card depended on `tutor-stub-transition-reward-model`, which closed as
`killed`: no claim-grade multi-world transition dataset and no supported
action effect exists for fitting a learned ranker. The reexamination question
was whether the controller needs that prerequisite at all. It does not — and
the reason is not that the ranker is merely unavailable, but that four
independent results say a learned or persisted layer is not the thing that
was missing.

- **§6.15 (agon).** Information *format*, not information, is the bottleneck.
  The playbook probe found that "action-shaped signals get uptake *including
  when stale*, because compression detaches imperatives from their
  preconditions, while state-shaped signals get no uptake at all." Working
  formula recorded: *action-shaped and freshly conditioned*. Note which half
  of that is the danger — an action-shaped memory is not ignored, it is
  obeyed after its precondition has lapsed.
- **§6.13.18 and §6.8.6.** The policy reconstructs its strategy from context
  every turn, and less learner state is more. §6.13.11 adds that the only
  confirmed lift in the derivation programme came from *re-presenting
  checkable state*, not from inferring latent state.
- **§6.16 (green room).** Judge-tier authorship, dialogic elicitation and
  curation under a hard budget produced note uptake of 3/17 (18%) against a
  pre-registered 60% bar. The recorded reading: authorship quality and memory
  hygiene were not the binding constraints; the failure is "not knowledge of
  *what* to do, but noticing *when*."
- **§6.3.10.** Cumulative superego-authored prompt rewrites are behaviourally
  inert.
- **§6.12.4.** The state-scramble placebo collapses strict shift from 6/6 to
  0/6, so the learner-state estimate is load-bearing. In the same run,
  closure-off **preserves** strict shift: the intervention-outcome ledger
  "contributes to the contract record, not to strategy selection."

That last line is the one a memory controller has to answer. The outcome
ledger already exists inside a dialogue and already fails to change which
action gets selected. A cross-dialogue memory built on the same outcomes
inherits that burden and must say what it adds.

## What signal a cross-dialogue memory would add

Not anything about the learner. §6.10's kill gate settled that the simulated
learner's concealed interior is surface-determined, and §6.13.18 found the
policy reconstructs its strategy from context every turn. A memory that
re-encodes what the transcript already implies adds nothing the model cannot
infer for itself. Every screen this programme has tried failed in that
direction.

The one quantity that is genuinely absent from any single transcript is the
**tutor's own historical hit rate, per action family, per detected
condition, per world**. A dialogue cannot contain it: it is a statistic over
other dialogues. Concretely, after `writing-pad-intervention-outcomes`
(landed 2026-08-28) each strategy the tutor used carries a success or failure
mark under a transcript-derivable rule, so the raw material now exists where
it did not on 2026-07-11.

So the candidate signal is one number with a name attached: *when condition C
was detected in world W, action family A landed k times in n.* That is new
signal, it is action-shaped, and it says nothing about the learner's
interior.

## The shape the evidence licenses

Not a memory screen the tutor reads before speaking. Three arrivals at the
same boundary say a persisted advisory block does not change conduct, however
well authored.

The shape §6.15 and §6.16 both point at is a **detector that fires at the
moment its condition holds** — the green room's licensed successor of
"side-coaching that delivers the note at the moment its condition holds",
compiled into trigger quantities that already exist in the stub's
register-policy layer (field and DAG velocity, the stagnation composite).

So the controller is proposed as a *conditioned demotion*, not a briefing:

1. The existing within-dialogue detector fires condition C, as it already
   does.
2. The controller looks up the cross-dialogue record for (C, W) and, where an
   action family's historical rate is below a registered floor at a
   registered minimum support, **demotes that family in the candidate
   ranking for this turn only**.
3. Nothing is written into a prompt. No note, no book, no advice. The memory
   changes which candidates are available at the moment of choice, which is
   the seam §6.12.4 showed is load-bearing.

This is deliberately the narrowest thing that could work, and it is testable
against the strongest control this programme owns.

## The stale and contradictory-memory controls

The registered placebo is the scramble analogue of `policy.state_scramble`,
which §6.12.4 calls the strongest evidence in the Plan 2.x line.

- **Memory scramble.** Permute the (condition, action-family) association
  while holding the record's schema, support counts and marginal rate
  distribution intact, immediately after lookup and before the demotion is
  applied. The controller then acts on a record that no longer corresponds to
  this world's history. If the treatment moves the endpoint and the scramble
  does not, the effect is carried by the association rather than by the mere
  presence of a demotion step.
- **Stale memory.** Serve the record frozen at a checkpoint N dialogues old
  while the world's behaviour has moved on. This is the *first* control, not
  a robustness note, because §6.15 measured exactly this failure: action-shaped
  signals are taken up even when stale, since compression detaches the
  imperative from its precondition. A demotion is an imperative. If the stale
  arm performs like the live one, the controller is not reading its record —
  it is obeying a habit, and the line closes there.
- **Contradictory memory.** Inject a record whose association is inverted for
  one (C, W) cell against the run's own observed rate. This is the honesty
  control: a controller that follows a contradicted record without a
  supersession rule is recording faith, not evidence.
- **Support floor.** Below the registered minimum support the controller must
  abstain, and abstention must be visible in the trace. A demotion taken on
  n = 1 is noise dressed as memory.

Each control is a separate registered arm with its own disposition. None is
an after-the-fact robustness check.

## The endpoint

Assisted closure is not admissible. A tutor that talks a learner across the
line inside the dialogue tells us nothing about whether the learner improved,
and the card's own verification line already says so.

Two endpoints, both computed rather than judged:

- **Unassisted improvement.** The outcome-only score on the tutor-stub
  headroom contrast — "did the learner do the task" as a machine check, which
  the `tutor-stub-headroom-contrast` line established as a confound-free way
  to rank policies. Measured on **held-out worlds** the memory record never
  saw, so a controller cannot win by memorising the world it was fitted on.
- **Transfer.** The same score on a world held out from the record entirely,
  against the same tutor with the controller disabled.

Both are proof-DAG or keyed-demonstration quantities, not rubric scores.
§6.15 records why: its zero-judge referee is "immune by construction to judge
gullibility, ceiling compression, sycophancy coupling, and closed-loop
scoring", which is exactly the exposure an LLM-judged endpoint would carry
into a claim of this kind.

## The discriminating prediction

The design is worth running only if it can fail informatively. It predicts:

- treatment beats control on unassisted improvement in held-out worlds;
- memory scramble does **not** beat control, at a registered margin;
- stale and contradictory arms sit at or below control.

If treatment and scramble move together, the controller is a demotion-step
artifact and the line closes. If nothing moves, that is the fourth
independent arrival at the §6.15/§6.16 boundary, from the one direction those
three did not try — memory acting on the candidate set at the moment of
choice rather than on the prompt beforehand — and the boundary should then be
written up as a general result rather than probed again.

## What this does not authorize

No build, no run, no model call. The next zero-call step is a registration
under `docs/paid-study-authorization-policy.md` naming arms, worlds, sizing
against a measured base rate, floors, ceilings and the claim boundary. The
prerequisite `tutor-stub-transition-reward-model` is dropped: this design
fits no ranker and needs no transition dataset.
