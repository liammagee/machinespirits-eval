# Process: two new resistant learners — bored, and defiant on principle

Status: design note, no registration yet. Written 2026-08-16. Nothing here
authorizes a paid call.

## The process, in order

Every step before 7 is free and deterministic.

1. **Write the contract.** One entry per profile in
   `scripts/tutor-stub-learner-profile-contracts.js` (schema v4): a voice
   signature, sample moves, stance ranges, separation notes against the
   nearest existing profiles, and a gate (maximum cosine similarity to the
   diligent baseline, expected nearest neighbor, minimum signature pass
   rate).
2. **Run the discrimination check** —
   `scripts/analyze-tutor-stub-profile-discrimination.js`. The new profile
   must land nearest its declared neighbor and clear its cosine gate. Fail
   here means rewrite the contract, not proceed.
3. **Register the name** in the supported-profiles list
   (`services/adaptiveWarrantOutcomeLearnerProfiles.js`). The outcome driver
   refuses names not on the list.
4. **Check the public-turn rules** still hold: learner text must never name
   its profile, its labels, or the proof-DAG.
5. **Zero-cost smoke** of the outcome driver with the new profile in mock
   mode.
6. **Seal a registration** for that profile's study. The lesson of the
   passive and overconfident arcs goes here: **pick the conduct channels to
   fit the resistance shape before the pilot**, and declare a variance gate
   per channel (the passive presence channel died at pilot for taking one
   value on >90% of cases; the overconfident block then had no
   reader-checked conduct channel at all). A channel the profile rarely uses
   is a dead channel. The registration must answer one question in writing
   before it seals: **if the mechanism works on this learner, which
   registered number moves?** The named channel must have room to move —
   not at floor, not at ceiling, and not pinned by the persona contract's
   own voice rules.
7. **GO note + explicit human approval**, then an 18-dialogue pilot; pilot
   gates rule; re-register if a channel dies; only then a main block. No
   approval carries forward between phases.

## Bored

Nearest neighbor: the passive learner (low_agency) — both under-act, so the
separation gate matters most here. The difference: the passive learner asks
permission for everything ("may I try...?"); the bored learner withholds
effort ("sure, whatever"). High compliance, low investment, no permission
seeking.

Voice: short flat replies, dropped threads, minimal answers that satisfy the
letter of the question, no questions back.

Design risks: (a) too few commitments per dialogue — the decision channel
(was this shift warranted?) starves when the learner barely commits to
anything; the registration needs a floor on scoreable cases per dialogue.
(b) Deference measures are dead by construction — never defers, never
challenges.

Conduct channels that fit the shape: reply effort over turns (length,
specificity), thread pickup (does the learner return to a point the tutor
left open), unprompted contributions.

## Defiant (objects on principle)

Nearest neighbors: the evidence skeptic and the low-trust skeptic. The
difference is jurisdiction, not evidence: the skeptic doubts a claim and
wants proof; the defiant learner disputes the tutor's standing to set the
frame at all — the premise of the exercise, the tutor's right to pose tests,
the world's rules.

Voice: disputes premises, reframes questions, refuses assigned tests while
staying articulate and engaged.

Design risks: (a) warrant cases may be rare — a learner who accepts no frame
makes few commitment shifts to judge; (b) the gate's challenge family may
backfire — challenging defiance can escalate rather than repair, which is
itself worth measuring, not avoiding.

Conduct channels that fit the shape: first engagement with a test on its
merits (turn number, if ever), concession events, premise-dispute rate over
turns.

## Cost shape

Contracts through smoke: free. Per profile after that, at main-block scale:
about 1,850 generation calls and 1,150 reader calls, following the
overconfident block's budget. Pilot first (about a quarter of that).
