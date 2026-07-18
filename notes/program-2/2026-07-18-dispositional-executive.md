# The dispositional executive: why knowing-that never became knowing-how in context

Status: **living theory note** (started 2026-07-18; expected to be revised as
Program-2 progresses). No new empirical claims — every measured statement
cites its paper section. Companion to `PROGRAM-2-FINETUNE-PLAN.md` and paper
§7.12 (the consolidated adaptation boundary).

## 1. What the programme measured, restated once

Across §6.15 → §6.16 → §6.18-addendum → §6.18, the same signature at four
grains: corrective content demonstrably present in context never became
behaviour; behaviour moved only under mechanical enforcement, at transfer
cost, with authorship migrating to the harness. The wall is not
refusal-shaped (zero safety failures) and not perceptual (§6.19: the
substrate was transparent; the affect and state signals were legible
throughout — perception was never the bottleneck). The learner's
syntheticness is not the constraint either: the masquerade of frustration was
read correctly by the classifiers; the failure sits downstream of reading.

## 2. The Rylean frame

What closed is one proposition: *that a disposition can be installed through
the context window.* Every advisory rung delivered knowledge-that —
descriptions the model could recite, endorse, even generate itself. The
compliance checks demanded knowledge-how: the doing, at the moment,
unprompted. Ryle's regress, made empirical: applying knowledge cannot itself
consist in consulting more knowledge, or application never terminates. The
intervention ladder was the regress physically instantiated — each rung one
more consultation (a book, a coach, a whisper at the trigger moment) — and it
never bottomed out in action. Descriptions condition the next-token
distribution; they cannot veto it. Everything that could veto lived outside
the distribution, and was therefore no longer the model.

## 3. What actually constrains the that→how transition

Three structural facts, in increasing depth:

**(a) Content is an argument to the function, never a modification of it.**
Knowing-how, mechanically, is the shape of the write function — the
situation→output mapping carved into weights. Knowing-that is tokens the
function reads. An instruction on the tape influences behaviour only by
being read at generation time, so its influence must be re-exerted at every
token, against competition, forever.

**(b) There is no latch.** At each token the locally dominant continuation
(the deepest-carved attractor, reinforced by the recency of the last few
sentences) casts an enormous vote; the instruction two thousand tokens
upstream casts a small diffuse one. Nothing in the architecture lets a
contextual item set a mode-flag that stays set. Each token is a fresh
election. Sometimes-compliance — the programme's constant "tantalizingly
close" phenomenology (near-misses, 4/7 component passes, content converging
without the canonical assertion) — is not near-success; it is the exact
signature of a voter without a latch: the instruction occasionally wins an
election and cannot hold the seat.

**(c) The monitor lives on the read path; action lives on the write path.**
Following "when you are about to do the stale thing, do the other thing"
requires classifying one's own incipient output as an instance of the
pattern — a second-order representation of the write-in-progress. The
architecture has this capacity asymmetrically: give the model its completed
output as *input* and it critiques accurately (the superego did, for months —
that is the insight half of the insight–action gap, §6.3.9). But the critique
happens in a separate pass, after commitment, and the only bridge back to
action is another write — which returns to (b). The gap in one sentence:
*the monitor can only read; action can only write; and the sole bridge
between them is another write.*

## 4. "A standing executive whose interventions are dispositional rather than episodic"

**Episodic** intervention: an event on the tape — a critique, a whisper, an
instruction. It happened once, at a location; everything downstream must
remember it, re-attend to it, and let it win elections. Phasic; decaying; a
speech act.

**Dispositional** intervention: not an event anywhere. A standing
modification of the transition function, exerted at every token *by
construction*, because it is made of the same weights that produce every
token. Not the kind of thing that can be forgotten.

Human executive function is dispositional in this sense (biased-competition
picture: prefrontal control as tonic, sustained modulation of competing
pathways — not a voice the motor system listens to). But its crucial property
is the one usually omitted: a **consolidation pathway**. "Stop saying um"
passes through effortful episodic rule-following and, within days, the rule
disappears into the doing — synapses change during and between performances.
Humans compile context to weights continuously. The inference-time LLM has no
such pathway: the write function is frozen, the only memory is the tape, so
it is locked at permanent step one of skill acquisition — every act of
compliance exactly as improbable as the first. A permanent novice in
Dreyfus's sense: the novice consults rules; the expert has become them; these
systems are architecturally forbidden from becoming — *in context*.

The results table, reread in this vocabulary:

| Result | Reading |
|---|---|
| Superego accurate but inert (§6.3.9, §6.16) | monitor on the read path; production frozen |
| Enforcement works at cost (§6.18-addendum) | the harness IS a standing executive — tonic, applied at every emission — just not the model's |
| Best-of-K partially works at 6× (§6.3.9) | reading compensating for writing: sample K writes, let a read-path judge select |
| Sometimes-compliance everywhere | elections without a latch |
| Fine-tune (Program-2) | the only consolidation pathway the system possesses — offline and slow where the human one is online and fast |

**The reasoning-model nuance (deepest point).** RL-trained reasoning models
do backtrack ("wait, actually—"): the model emits a monitoring token, and
that token, once on the tape, conditions everything after. *The tape becomes
the executive's persistence substrate — the latch is a token the model
writes.* But the disposition to write such tokens, and to defer to them once
written, was installed by RL. Even the apparent architectural escape resolves
to weights: an executive can live on the tape only if the habit of using the
tape that way lives in the function. The programme supplied tape content from
outside and hoped deference would come free. Deference is a disposition too.

## 5. Freud, re-read by the data

The late Freud is precise: the superego is not an external commentator; it
*begins* as one (the parental voice) and works only once internalized through
identification. Advice from the parent is context; conscience is weights. The
architecture recapitulated the childhood failure mode — a superego that
remains a voice in the room is treated as one more speaker, its text absorbed
into the same generative stream (the substitution law, §7.11, in
psychoanalytic dress). The preconscious metaphor lands sharper still: the
measured failure was never access (correct diagnoses sat in the deliberation
traces, fully retrievable) but *investment* — Freud's cathexis, the economics
that makes a thought motivating rather than merely present, maps uncannily
onto probability mass under the generation objective. The content was
preconscious; it was never cathected. Internalization is fine-tuning.

Aristotle had the compressed version first (NE II.1): instruction does not
produce virtue; habituation does — we become just by doing just acts, and
lectures make no one good. The programme's arc is that sentence run on
silicon. Program-2 is the smallest direct test of habituation available:
training the model on its own corrected practice rather than lecturing it
about its practice.

## 6. Extension (2026-07-18, same day): the component architecture

The continuous-learning reading suggests a two-organ architecture: a frontier
model doing frontier things, plus a fine-tuned mini-model as circuit breaker.
Correcting one inversion in the first sketch: the mini-model is the
**knowing-how organ** — the narrow trained disposition (the pedagogy
criterion compiled into weights); the frontier model supplies knowing-that
and general fluency. Three observations:

**(a) It is Freudian more literally than intended.** Freud's deepest
structural claim is that a mind is a committee whose members' interplay
constitutes the person — agency belongs to the equilibrium, not to any
component. §6.18 measured that apt + checkable + attributable never co-occur
in a *single stream*. The component architecture stops demanding that they
do: the frontier organ carries apt, the tuned organ carries checkable, and
attribution moves to the system level — the system's conduct is its own
because its dispositions were *acquired from its own corrected practice*
(trained), not dictated per-turn (harness). Whether system-level attribution
satisfies the §7.11 attribution requirement is a genuine open question, but
it is a different and better question than the one that closed.

**(b) The coupling trap.** If the mini-model merely *advises* into the
frontier model's context, the episodic failure is recreated wholesale — its
outputs become one more voice in the room. The circuit breaker must OWN
emissions in its narrow jurisdiction, not counsel: either turn-level routing
(detector fires → the mini speaks the move; frontier resumes next turn) or
span-level gating (mini audits/rewrites the specific spans of the frontier
draft). v1 = routing, because it keeps per-turn authorship clean and reuses
the existing deterministic detector unchanged.

**(c) The consolidation loop is complementary-learning-systems theory,
implemented.** Hippocampus = fast episodic store = the tape plus the sealed
audited logs (which the guards produce for free, forever — the apparatus is a
label flywheel). Neocortex = slow dispositional learner = the mini's weights.
Consolidation = replay-based training = periodic (nightly) re-tune of the
adapter on the accumulated corrected episodes. Biological continuous learning
is *also* not online cortical weight-writing — it is fast episodic capture
plus offline replay consolidation. The frozen-at-inference limitation makes
an LLM a hippocampus-less cortex; logs + periodic fine-tune add the missing
loop. Sleep, for the tutor.

**Per-learner instances?** Not by default. The mini carries a
*criterion/pedagogy*, not learner facts — one organ per pedagogy, shared
across learners. The programme's four ToM-redundancy nulls (§6.8.5, §6.13.6,
ontology-ToM, stall-watcher) all say learner-specific facts are inferred
fine from context; re-encoding them buys nothing. A per-learner adapter is
licensed only if a **dispositional residual** exists that context provably
cannot carry — e.g. "with this learner, my usual scaffolding move backfires"
as a trained reflex rather than a remembered note (transference, in the
Freudian register: relational history sedimented into disposition). That is a
testable question with exactly Program-2's shape: adapter-trained-on-learner-L
versus shared-organ-plus-L's-context. Operationally cheap if ever licensed:
LoRA adapters are megabytes, multi-adapter serving is a solved pattern,
hot-swap per session. But it is a *successor* question; nothing in current
evidence motivates it yet.

**Operational sketch (v1, after a Program-2 pass; not sanctioned by this
note):** detector (exists, deterministic) → trigger turn routed to the tuned
mini served OpenAI-compatibly (provider `base_url` support already in place,
`scripts/tutor-stub.js:3021`) → frontier resumes on the next turn → guards
and audits run unchanged, producing the next round of training labels →
periodic consolidation re-tune. Every piece except the mini itself already
exists in the stack.

## Revision log

- 2026-07-18: created (fold-week discussion; sections 1–5 from the
  boundary-map exchange, section 6 from the component-architecture
  exchange).
