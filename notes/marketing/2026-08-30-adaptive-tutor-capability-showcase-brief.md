# Adaptive tutor capability showcase — discovery brief

Status: working brief, not final marketing copy
Branch: `codex/adaptive-tutor-showcase-brief`
Audience note: the capability story must also support an investor pitch
Evidence anchor: commit `9b5921867`, especially
`notes/poetics/2026-08-29-adaptive-tutor-from-null-to-control.html`
Presentation anchor: commit `bd580859`, especially
`docs/dramatic-dialogue-renderer.md`

## The opportunity

The most compelling story is not that the tutor has accumulated more prompts,
agents, or instrumentation. It is that adaptive teaching has become visible,
testable, and controllable at the level of a particular learner moment.

The system can now expose what it believes is happening, name the pedagogical
move it selected, distinguish the draft from the turn that actually reached the
learner, and measure what followed. It can also force a plausible wrong move as
a causal control. That makes the tutor more than a fluent conversational demo:
it becomes an instrument for testing which teaching actions change local tutor
conduct in bounded simulated settings, and for recording where that change
entered the control loop.

Working positioning:

> An adaptive tutor you can inspect, challenge, and improve — from learner
> state to teaching move to delivered outcome.

Sharper research-facing variant:

> We turned “be adaptive” from a prompt into an observable control loop.

## What the showcase should make a reader feel

1. **I can see the tutor perceive.** The reader can inspect the public evidence,
   the permitted proof path, and the detected form of learner difficulty.
2. **I can see it choose.** The tutor selects a concrete move rather than
   receiving generic advice to be helpful or adaptive.
3. **I can challenge the choice.** A deliberately mismatched move can be forced
   at the same planted state and compared with the matched move.
4. **I can see what actually shipped.** Draft, repair, fallback, and delivered
   turn are separate records; the study does not assume the learner received
   the intended treatment.
5. **I can see what happened next.** Immediate conduct, dialogue closure,
   transfer, and human learning are kept as different outcome levels.
6. **I can learn from failure.** Null and negative results identify redundant
   context, mistimed advice, and guards that accidentally author the tutor's
   response.

The emotional arc is therefore **from magic to legibility**: the tutor remains
expressive, but its important pedagogical decisions no longer disappear inside
one plausible paragraph.

## Capability pillars

### 1. Evidence-aware reasoning

A proof DAG makes the inference boundary inspectable: a plausible temporal
association does not become a licensed conclusion until the required path is
present. A release schedule separately records what is public at the current
turn.

Showcase affordance: let the reader switch between a tempting shortcut and the
checked path, with the missing premise visibly breaking the shortcut.

### 2. Typed learner states

The controller distinguishes forms of difficulty that call for different
responses: deadline pressure, mockery, grievance, false memory, fused social
stakes, confusion, and flatness are not collapsed into one “resistant learner”
label.

Showcase affordance: a state selector changes both the diagnosis and the
candidate move while holding the underlying world legible.

### 3. State-contingent teaching moves

The tutor can receive a small, concrete action such as narrow the check, reopen
the record, credit then test, or split the factual finding from the learner's
social stake. The important advance is not a larger library; it is that a move
can be crossed against a state.

Showcase affordance: place the matched and deliberately mismatched move beside
the same kind of planted learner state. The present bounded result is 5/6 target
conduct for the matched endgame-stake move versus 0/6 for the wrong move across
the two registered simulated worlds.

### 4. Instrumentation that can be priced one piece at a time

The frozen A/B harness holds the public transcript, learner turn, speaking
model, effort, and guard set fixed while adding one private block. That exposes
whether continuity, an evidence window, a classifier, a proof-DAG readout, a
scaffold, a due clue, or a first-draft contract changes the tutor's next turn.

Showcase affordance: an “X-ray” switch reveals the exact prompt block and the
exact textual delta it produced. The point is not that every block helps. The
evidence shows that visible-record repackaging often changes little, while one
missing due fact or a state-timed action can matter.

### 5. Treatment delivery, not treatment intention

The instrumentation records public state → detector → selected move → draft →
delivered turn → outcome. This caught a strict guard replacing the tutor's
draft with a deterministic template on 62% of turns, which initially obscured
what the planned treatment actually did.

Showcase affordance: animate the pipeline and allow the reader to compare
“selected,” “drafted,” and “delivered.” A repaired or fallback turn should be
visually impossible to mistake for faithful delivery.

### 6. Controlled comparison and live demonstration as separate tools

The frozen A/B supports attribution because the learner turn stays fixed. The
free-running showcase supports understanding because each learner can answer
the changed tutor and the dialogue can continue to closure. The latter is not a
controlled comparison after the transcripts diverge.

Showcase affordance: offer two clearly named modes:

- **Isolate a next-turn effect:** one frozen learner moment, one
  instrumentation change.
- **Watch a dialogue:** two free-running tutor experiences with cost, guard,
  repair, and closure telemetry.

The shared dramatic-dialogue renderer gives these modes one public vocabulary
without collapsing their meanings:

| Presentation layout | Use in the story | Evidence boundary |
| --- | --- | --- |
| `shared-learner` | Frozen instrumentation A/B | Candidate-next-turn attribution only when the harness holds the declared context fixed |
| `parallel` | Free-running showcase | Product illustration and telemetry, not causal attribution after divergence |
| `parallel` | Registered crossed-action example | Bounded causal tutor-conduct reading supplied by the study design and human ruling, not by the columns |
| `single` | One dialogue or focused moment | A legible transcript, not a claim of representativeness |

The renderer never supplies the evidence status. The originating design,
delivery record, provenance, and ruling do, and missing or indeterminate
judgments stay visibly unresolved.

### 7. An architecture that discovers its own excess

The programme has repeatedly shown that more context is not the same as a
better intervention. In the frozen instrumentation corpus, most visible-record
blocks stayed near bare on the open-rule ruler; a full contract carried useful
information but costly wrapping; untimed character shifts often distracted;
the live full stack did not outperform no instrumentation at planted repair
moments. The more promising units were minimal missing information and
state-timed concrete actions.

Showcase affordance: a “what earned its keep?” view groups devices by causal
job—represent visible state, inject unavailable state, choose a move, verify
delivery—instead of presenting a feature checklist.

## Recommended hero demonstration

Use one ordinary Rowan Flat learner moment where the factual cause is already
understood but accepting it feels socially costly.

The hero sequence:

1. Show the learner's exact public turn.
2. Reveal the detector's bounded reading: the obstacle is the fused social
   stake, not missing plumbing evidence.
3. Play the plausible wrong move: reopen the record and prove the plumbing
   again.
4. Play the matched move: separate the factual finding from what the learner
   owes Sam.
5. Expose the selected card, delivered text, and human-adjudicated
   tutor-conduct ruling.
6. End on the pooled bounded result: 5/6 matched versus 0/6 wrong, followed
   immediately by “simulated worlds; local tutor conduct; not human learning.”

Why this should lead: it demonstrates adaptation in the prose itself, it makes
the counterfactual control intuitive, and it avoids asking a reader to admire
the architecture before they can see what it changes.

## Supporting demonstration set

Every transcript module should reuse
`machinespirits.dramatic-dialogue-interchange.v1` and the shared public-only
renderer. That keeps learner/tutor labels, arm identity, delivery status,
provenance, rulings, and editorial glosses coherent across the research report,
interactive demo, deck captures, and diligence appendix without exposing
private prompts or deliberation.

### The proof-path switch

“Sam showered before the stain” is plausible but insufficient. The interactive
proof view makes the missing physical path visible and shows the licensed
alternative once the split, raised pressure, and dye path are combined.

Purpose: make evidence discipline concrete for a nontechnical audience.

### The instrumentation X-ray

Reuse the three frozen Tallow Street moments and let readers add continuity,
evidence window, classifier, learner DAG, human scaffold, or contract one at a
time.

Purpose: show that instrumentation is empirically separable, including cases
where it changes little or makes the turn worse.

### The delivery debugger

Replay a turn through selected move, candidate draft, guard decision, repair or
fallback, and delivered text.

Purpose: demonstrate a commercially legible capability—knowing whether the
product actually delivered the behavior its orchestration layer intended.

### The honest scoreboard

Show the question ladder rather than one total score:

- Was the inference licensed?
- Was the learner state distinguished?
- Did the matched move change the delivered conduct?
- Did the effect transfer?
- Did a human learner benefit?

Purpose: turn scientific restraint into product credibility. The current
answers are not all “yes,” and that is part of the story.

## Message architecture

### Headline

**Adaptive tutoring, made inspectable.**

### Subhead

See how a tutor moves from public evidence to a diagnosed learner state, a
specific teaching action, the turn that actually reached the learner, and a
measured outcome.

### Three proof points

- **State, not stereotype:** different forms of stuckness can receive different
  candidate teaching moves.
- **Counterfactual by design:** matched and deliberately mismatched moves can be
  forced at the same planted state.
- **Delivery you can audit:** selected, drafted, repaired, delivered, and
  measured are separate events.

### Call-to-action directions to test

- Explore the control loop.
- Compare the same learner moment.
- Inspect a teaching decision.

The final call to action should depend on the primary audience and destination;
the brief does not yet assume product buyers, research collaborators, funders,
or educators are the lead audience.

## Investor translation

The capability showcase is necessary for an investor pitch, but it is not the
pitch by itself. It proves that there is something technically demonstrable to
show. An investor also needs to understand who urgently needs it, how that need
becomes a business, why this team can win, and what the next round of capital
will prove.

The investor version should therefore lead with the current capability and
translate the instrumentation into an investable thesis:

> The next generation of AI tutoring will not be won by the chatbot with the
> most advice in its prompt. It will be won by systems that can identify a
> learner's actual obstacle, select a fitting teaching move, verify what reached
> the learner, and improve from measured outcomes.

This is a strategic thesis, not an established market fact. Customer urgency,
willingness to pay, market size, and competitive differentiation still need
external evidence.

### The recommended commercial shape

Lead with a **specific learning workflow and buyer**, then reveal the adaptive
control system as a candidate source of defensibility underneath it. Pitching
the instrumentation alone risks sounding like research tooling; pitching a
generic AI tutor risks hiding the specific technical work.

The strongest provisional structure is:

- **Commercial wedge:** one consequential learning workflow where generic tutor
  fluency is not enough and inspectability matters to the buyer.
- **Product experience:** a learner-facing tutor plus an educator or operator
  view of state, selected move, delivery, and outcome.
- **Candidate defensibility thesis:** the causal harness, typed state-action
  repertoire, delivery ledger, and evidence discipline make the tutor
  measurable and improvable.
- **Expansion path:** additional subjects, learner states, and institutional
  workflows only after the first wedge demonstrates adoption and value.

An infrastructure or SDK business for other tutoring products remains a
credible second hypothesis. It should not share the main pitch until buyer
interviews show that developers or institutions will purchase the control layer
itself.

### What an investor needs to believe

| Investor question | What this work supports now | What is still needed |
| --- | --- | --- |
| Is there a real product insight? | Generic fluency is separable from state-contingent teaching conduct; the system can inspect and cross the decision. | Customer evidence that this distinction solves an urgent problem. |
| Can I see the product? | Yes: the matched-versus-mismatched hero, proof-path switch, instrumentation X-ray, and delivery debugger can form a coherent demo. | A polished learner/operator experience rather than a research-report tour. |
| Does the technology work? | It can change bounded local tutor conduct in registered simulated settings and can detect when orchestration rewrites the intended treatment. | Human-coded validity, broader transfer, and ultimately a bounded human outcome study. |
| Who buys it? | Not yet established by the evaluation programme. | One named ideal customer profile, buyer, user, procurement path, and design-partner evidence. |
| Why now? | The repository demonstrates that the architecture can be prototyped and instrumented. | Current primary evidence about adoption, procurement pressure, and the shortcomings of alternatives. |
| Is the opportunity large? | The repository does not establish a market size. | A bottom-up market model: reachable buyers × realistic annual value, with source dates and assumptions. |
| What is the business model? | Institutional licensing, per-learner pricing, and an API/SDK are possible hypotheses. | One primary pricing unit, willingness-to-pay evidence, sales motion, and expected contract size. |
| Can it make money? | The showcase already records calls, tokens, latency, and completion behavior. | Cost per completed session, support and evaluation costs, target gross margin, and sensitivity to model routing. |
| What is defensible? | The team has accumulated a causal evaluation harness, typed pedagogical controls, delivery/outcome provenance, and an adjudicated evidence base. | IP and data-rights audit, replication beyond the current stack, and proof that accumulated usage improves the product faster than alternatives. |
| Why this team? | The repository documents substantial research, engineering, measurement, and self-correction work. | A concise founder/team story tied to education, AI systems, commercialization, and the missing go-to-market capabilities. |
| What does the investment buy? | The technical programme identifies the main validation gaps. | A round size, runway, and three milestone outcomes with owners, cost, and a stopping rule. |

### Pitch assets and their jobs

- **Main deck:** the company, pain, buyer, product, demo, evidence, wedge,
  market, business model, defensibility, team, and ask. Keep research caveats to
  the sentence needed to interpret each claim.
- **Interactive demo:** the visceral proof. Use the Rowan Flat counterfactual
  early; do not make investors wait through the research chronology. Reuse the
  shared public-only dialogue renderer so the controlled, crossed, and
  free-running examples retain their evidence labels across the site and deck.
- **Evidence appendix:** exact comparison classes, sample bounds, nulls,
  negative findings, provenance, and the human-validation roadmap.
- **One-page leave-behind:** vision, product, customer, traction, market,
  business model, team, and round. It must make sense without narration.
- **Diligence packet:** architecture, security and data posture, model costs,
  evaluation design, IP/data rights, and milestone budget.

The May null belongs in the evidence appendix or in a short “why we trust the
measurement” moment. It is an excellent integrity signal, but it should not be
the first thing an investor has to decode.

### Recommended investor-deck spine

1. **Company purpose:** one declarative sentence, not a feature list.
2. **Customer pain:** one named user and buyer, with observed evidence rather
   than a generic claim that education is broken.
3. **Product:** show the learner moment and the tutor's different action.
4. **Unique insight:** a visible state → move → delivery → outcome loop makes
   specific adaptive tutoring decisions inspectable and causally testable;
   simply adding more context did not do that.
5. **Proof today:** the bounded 5/6 versus 0/6 conduct contrast, delivery
   instrumentation, working showcase, and the exact limit: not yet human
   learning.
6. **Wedge and go-to-market:** first workflow, design partners, route to the
   buyer, and expansion logic.
7. **Market:** bottom-up customer count and pricing, plus current direct and
   indirect alternatives.
8. **Business model and economics:** pricing unit, inference cost, gross-margin
   target, sales motion, and scaling assumptions.
9. **Defensibility and team:** why the evaluation system, evidence base, and
   team compound into an advantage.
10. **Milestones and ask:** how much is being raised and the specific
    product, customer, validation, and economic milestones that capital buys.

This follows the durable questions in Y Combinator's seed-deck guidance and
Sequoia's business-plan framework: purpose, problem, customer, solution, why
now, market, competition, traction, model, team, financials, vision, and the
fundraising ask. The deck should be a coherent leave-behind with strong product
visuals, not a compressed research paper.

### Evidence needed before calling the pitch investor-ready

**Customer and traction**

- A sharply defined ideal customer profile and buyer.
- Interview evidence from the learner, educator/operator, and economic buyer.
- Design partners, letters of intent, pilots, usage, retention, or another
  honest adoption signal. Research runs are technical progress, not traction.
- The current workaround and the cost of leaving the problem unsolved.

**Market and competition**

- A dated competitor and alternatives map based on current primary sources.
- A bottom-up TAM/SAM/SOM model with explicit buyer counts, pricing, and
  reachable-channel assumptions; do not lead with a generic “education market”
  total.
- A clear answer to why incumbents or foundation-model vendors cannot easily
  reproduce the value proposition.

**Economics and operations**

- Model calls, tokens, latency, and dollar cost per completed learner session.
- The cost of evaluation, human review, customer support, and implementation.
- A primary pricing unit and target gross margin.
- Data rights, learner privacy, security, safety, and institutional deployment
  posture.

**Validation and milestones**

- Independent human coding of learner state and move fidelity.
- A bounded design-partner pilot with product and adoption metrics.
- A human-outcome study only when the earlier validity gates justify it.
- A milestone budget that separates productization, customer discovery,
  validation, and go-to-market work.

### Investor-safe language

Prefer:

- “We have built a control and measurement layer that can test adaptive
  teaching decisions.”
- “Our present evidence shows a causal effect on local tutor conduct in bounded
  simulated settings.”
- “The next milestone is to connect that capability to human-validated states,
  customer adoption, and learning outcomes.”
- “The system records when an intervention was selected, rewritten, delivered,
  and followed by an outcome.”

Avoid:

- “We have solved personalized learning.”
- “Our tutor improves learning outcomes.”
- “The research proves product-market fit.”
- “Our data flywheel is a moat” before data rights, usage, and measurable
  compounding are demonstrated.
- “No competitor can do this” without a current, sourced landscape.

### External pitch-design references

- [Y Combinator — A Guide to Seed Fundraising](https://www.ycombinator.com/blog/how-to-raise-a-seed-round): product, customer, market, traction, business model, team, fundraising, and a coherent leave-behind.
- [Y Combinator — Practical Design: Pitching](https://www.ycombinator.com/blog/practical-design-pitching/): concise product explanation, bottom-up market sizing, truthful progress, and a pitch designed to earn the next meeting.
- [Sequoia Capital — Writing a Business Plan](https://sequoiacap.com/article/writing-a-business-plan): purpose, problem, solution, why now, market, competition, model, team, financials, and long-term vision.

## Format concepts

### A. Interactive capability page

Best for: public website, partner conversations, research/product credibility.

Suggested flow: hero counterfactual → proof-path switch → instrumentation X-ray
→ delivery debugger → bounded evidence ledger.

### B. Ninety-second narrated walkthrough

Best for: social distribution and meeting openers.

Use the same Rowan Flat moment. Avoid a generic montage of dashboards; the
story should stay attached to one change in tutor conduct.

### C. Investor deck and executive one-pager

Best for: fundraising conversations, internal alignment, and institutional
partners.

Frame as “What can be demonstrated now / what is measured but not yet proven /
what the next validation step unlocks.” Pair the business narrative with the
interactive demo; do not ask the deck alone to convey the tutor's behavioral
difference.

### D. Live research console

Best for: technical collaborators.

Expose the detector, selected move, delivery status, proof state, and outcome
ledger alongside the public transcript. Keep private chain-of-thought out of the
surface; this is structured instrumentation, not hidden reasoning disclosure.

## Claim ladder

### Safe to say now

- The tutor stack can represent authored proof paths and turn-specific release
  boundaries.
- It can classify a bounded set of simulated learner states and select named
  candidate moves.
- It can force matched and mismatched actions at planted states and adjudicate
  the resulting delivered conduct.
- It records selected, drafted, delivered, and later outcome events separately.
- Its frozen-turn and free-running showcase surfaces answer different questions.
- The instrumentation has found nulls, negative effects, redundancy, and
  delivery failures—not only favorable examples.

### Say only with the bound attached

- A matched move caused better state-appropriate tutor conduct **for these
  simulated learners, worlds, tutor stack, and planted local states**.
- A small move repertoire caused differences in local tutor conduct **within
  the registered simulated stack; no move-level transfer benefit is yet
  established**.
- Some minimal information-bearing or state-timed interventions outperformed
  heavier alternatives **on their specific development-tier instruments**.

### Do not claim

- Human learning improved.
- The tutor is validated for classroom deployment.
- The original May recognition hypothesis became positive; its N=432 trajectory
  result remains null.
- The fully instrumented stack is generally better than the bare tutor.
- A free-running side-by-side difference is caused by instrumentation after the
  transcripts have diverged.
- Every detected state or move generalizes across worlds, personas, models, or
  domains.

## Evidence ledger

| Public point | Evidence source | Comparison class | Boundary |
| --- | --- | --- | --- |
| May trajectory result remained null | Paper 2.0 §6.3; adaptive-tutor explainer | completed evaluation, N=432 | Different intervention and outcome from later crossed work |
| Proof path and release boundary are inspectable | Rowan Flat world spec; explainer §02 | authored executable representation | Representation capacity, not learning efficacy |
| Matched endgame-stake move 5/6 vs wrong move 0/6 | crossed-effects conduct tags; explainer §03 | forced-action crossed test, human-adjudicated tutor-conduct ruling | Two simulated worlds; local delivered conduct |
| Bounded repertoire of state-specific moves | repertoire tags; explainer §04 | state × action contrasts | Local conduct result; no move-level transfer benefit established; lost-thread card not causal |
| Single advisory blocks can be isolated | `docs/tutor-instrumentation-ab.md`; explainer §05 | frozen public prefix and learner turn | Candidate-next-turn effect only |
| Minimal due clue carried more value than full wrapping | Paper 2.0 §6.23; explainer §06 | frozen-turn schedule-shown judge | Development-tier instrument; small strata |
| Full state stack did not improve planted repairs | Paper 2.0 §6.24; explainer §06 | live stress bench | Simulated learner; local repair outcome |
| Guard rewrote 62% of turns and obscured treatment | Paper 2.0 §6.23–§6.24; explainer §07 | registered delivery correction | Separate from crossed-card estimate |
| Free-running showcase can display telemetry and closure | `docs/tutor-instrumentation-showcase.md` | two divergent live dialogues | Illustration and cost/behavior telemetry, not causal attribution |

## Decisions still needed before final copy

- Exact investor audience and round stage: education specialist, AI
  infrastructure, generalist seed, strategic partner, or another thesis.
- Primary commercial wedge: direct tutor product, institutional operating
  layer, or developer infrastructure. Choose one for the main pitch.
- First ideal customer profile, buyer, user, and painful workflow.
- Destination: public site, partner deck, launch page, short film, or live demo.
- Desired action: request a collaboration, inspect the research, book a demo,
  join a design-partner pilot, or invest in a named round.
- Brand posture: research laboratory, product capability, or a deliberate
  bridge between the two.
- Whether “adaptive tutor” or “instrumented tutor” should lead. The former is
  more legible; the latter is more precise about what is currently proven.
- Fundraising amount, runway, use of funds, and the three milestone outcomes the
  round should buy.

## Proposed next artifact

For the investor audience, develop two linked artifacts: a concise pitch deck
that makes the business legible and an interactive capability demo that makes
the product insight concrete. The strongest demo reuses the existing
proof-DAG and instrumentation-gallery components, plus
`services/dramaticDialogueRenderer.js` and its managed public fixtures for
transcript comparison. The deck should link to it, then carry the customer,
wedge, traction, market, business model, team, and ask that the demo cannot
supply.

No new model-backed run is required for the first version. It should mine and
render existing adjudicated artifacts, preserve transcript bytes, label
editorial gloss, and undergo a paper-claim audit before publication.
