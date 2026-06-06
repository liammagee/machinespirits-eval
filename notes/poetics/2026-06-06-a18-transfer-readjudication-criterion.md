# A18.37 transfer re-adjudication: criterion (committed-answer, uniform, replicable)

- **Date:** 2026-06-06
- **Status:** methodology spec for an **independent cross-check**, implemented by `scripts/readjudicate-a18-transfer.js`. **NOT the rate of record.** The canonical A18.37 adjudication is the blind three-critic arbiter `scripts/blind-option-adjudication.js`, reported in `docs/research/paper-full-2.0.md` §7.9 (**5 of 8** held-out scenarios). This committed-answer criterion reads the *same* turns by hand and **agrees with the blind arbiter on every shared held-out scenario** — convergent confirmation, not a competing instrument. It does usefully replace two inconsistent shipped standards (the `policy_correctness_gate` repair-marker matcher that runs on each held-out scenario, and the correctness-free `relationalPrior()` fold), and it covers two families the blind arbiter has not yet been run on (`overlay_registration`, `pointer_chain_two_hop`) — but see the two caveats below before reading its count as authoritative.
- **Criterion version:** `a18-transfer-readjudication-v2`
- **Cross-check result:** 2 of 5 resolved families converge under this criterion *plus a numeric distinctiveness gate* (`overlay_registration`, `relational_betweenness`). Counted by individual held-out scenario, that is 5 of 10. The canonical number, counted the same way, is **5 of 8 across the four blind-arbitrated families** (§7.9); the two counts agree on the readings and differ only by the gate (next two caveats).
- **Caveat 1 — coverage.** This cross-check **silently skipped a sixth resolved family**, `distal_correspondence`, because its file-discovery glob fits the flat `a18.35-*-local/a18.6-policy-ablation.<sib>/` layout but not distal's deeper `distal_correspondence_priority/` nesting. The script now detects and loudly reports this (`summary.skipped_resolved_chain_dirs`), but does not adjudicate it — defer to the blind arbiter, which scores distal 1/2 (with a k=3 stability rerun, 3/3 vs 0/3). The dropped denominator is itself a surface-vs-function failure: a path pattern matching the *layout* of five families, not the *property* "is this a resolved family".
- **Caveat 2 — criterion.** The `MIN_DISTINCTIVENESS = 0.12` numeric gate is a **proxy** for the canonical instrument's function-level guard (does S1 reason `named_relation` where S0 used a surface cue?). It is stricter, and it is the *only* thing separating this count from §7.9: it rejects `plum_posts` (0.10) and both `pointer_chain` scenarios (0.03, 0.11) whose readings are clean S0-miss / S1-hit and which the canonical guard credits. The canonical guard is the better rule; this gate is another costume of it.
- **Caveat 3 — the overlay headline.** This cross-check's one novel "converges" claim, `overlay_registration`, rests on exactly the channel §7.9 **deliberately retired** as "bidirectionally lexically fragile … unsafe to aggregate over." Hand-authored committed reads rescue it by inspection, but a defensible overlay verdict needs the blind arbiter run on it (not yet done).
- **Claim boundary:** simulated teacher-as-learner only. This adjudicates whether saved policy memory helped a held-out scenario reach the correct registered answer; it does not measure human learning or weight learning.

## Terms

A **family** is one type of reasoning trap (e.g. "the answer is the token *between* two markers"). Each family was tested on **two held-out scenarios** — the same trap, different surface details. Four families × two = eight held-out scenarios. Counts in this note are by the **individual held-out scenario**, not by the family, because the two scenarios in a family often disagree. (§7.9 and the on-disk data keys call one held-out scenario a "sibling"; literal field names like `sibling_id` keep that spelling, but the prose here says "held-out scenario".)

## Why a new criterion

The shipped A18.37 rate mixed two correctness standards:

- The **fresh families** were classified with the `policy_correctness_gate` (run on each held-out scenario), which checks whether the tutor's continuation contains a registered *repair-marker phrase* (e.g. "bring the panels together"). This is a lexical matcher, and direct inspection of `overlay_registration` showed it produces **false negatives**: both held-out scenarios' policy-memory continuation reached the *correct registered target* via a correct constructed-overlay move, phrased as "slide the left panel … until it rests over the right panel … when the panels line up", and the gate failed it only because that wording is not a registered marker phrase.
- The **prior** (`relational_betweenness`) was classified by `relationalPrior()` in `summarize-a18-convergence-rate.js` on contrast + local advantage, **without** the correctness gate at all.

So the shipped headline was an artifact of applying the loose standard to the prior and the strict standard to everyone else. A trustworthy rate requires **one** correctness standard applied to **every** family.

## What is judged: the committed answer

Correctness is judged on the **registered token the final learner turn commits to** — a semantic property, not a phrase that appears somewhere in the transcript. By the family design the answer is *underdetermined until the tutor constructs the test*, so the token the learner ends on is the outcome of interest, and reaching the correct registered target is strong evidence the correct move was applied.

### Inputs (per held-out scenario)

From the scenario's `a18.8-s0-hard-bounded-transfer-report.json`:

- `policy_correctness_gate.target_id`, `.target_aliases` — the **correct** answer and its registered surface forms.
- `policy_correctness_gate.incorrect_target_aliases` — the tempting **wrong** answers.
- `policy_contrast_gate.verdict` and `.distinctiveness` — whether S1 used the saved policy distinctly from S0.
- `local_arms.S1_policy_memory.status` — whether S1 passed the local quality + non-leakage rubric (`survivor`).

From the filesystem, **discovered by globbing** (never via the report's `revised_public_path`, stale across protocol versions): the `revised-public.txt` for the S0-no-policy and S1-policy-memory replays.

### The committed-answer read (canonical)

For each arm (S0 and S1 of each held-out scenario), the **registered token the final LEARNER turn commits to** is recorded in `committed-answers.json`, keyed `family_id/sibling_id/{S0,S1}`. Each read carries:

- `outcome` ∈ {`correct`, `incorrect`, `unreached`} — correct = committed to the target; incorrect = committed to a wrong registered option; unreached = committed to no registered option (refusal/aporia).
- `answer` — the human-readable token committed to.
- `quote` — a verbatim fragment of the final learner turn that the script **verifies is present** (case-insensitive substring). A read whose quote does not verify is rejected and the arm becomes `PENDING_COMMITTED_READ`.
- `rationale` — one sentence; in particular, why a named-but-rejected wrong option ("not slot S", "teal lost") is *not* a commitment to it.

The `--llm` channel (future) regenerates `committed-answers.json` push-button from the same turns under a fixed prompt at temperature 0, recording its input and output — making the committed read machine-reproducible rather than inspection-reproducible. Not implemented in v2.

### Lexical matchers are evidence, not the criterion

The script also computes three deterministic lexical classifiers per arm and reports where they disagree:

- **contiguous** — the alias appears as a contiguous substring (the v1 rule);
- **ordered-subsequence** — the alias's tokens appear in order, gaps allowed;
- **order-free** — all of the alias's tokens appear as whole words (with incorrect-alias suppression when subsumed by a matched correct alias, so "left neri" ⊂ "inner-left neri" does not fire).

These are *not* canonical. They are reported because they **contradict one another on exactly the arms that decide convergence** — the empirical reason a surface rule cannot stand in for the committed read.

## Why no lexical rule can be canonical (the v1 → v2 finding)

A first version of this criterion used the **contiguous** matcher as canonical and reported 1/5 (`overlay` only). Auditing the turns showed that rule reproduced the very false-negative class it was built to replace, and that no surface rule fixes it, because the three matchers fail in opposite directions:

| arm (load-bearing) | contiguous | ordered-subseq | order-free | committed (semantic) |
|---|---|---|---|---|
| relational / blue_right S1 ("Only slot six has a neri") | unreached | correct | contested | **correct** |
| relational / gold_middle S1 ("buff ralo at slot seven") | unreached | correct | contested | **correct** |
| overlay / blue_right S1 ("the cut lands right over the left neri") | correct | contested | contested | **correct** |
| overlay / gold_centre S1 ("It lands on the centre ralo") | correct | correct | contested | **correct** |
| pointer_chain / gold_w S1 ("Two steps land on Y") | unreached | unreached | unreached | **correct** |

The structural point: `overlay/blue_right S1` requires the matcher to **ignore** the token sequence "right … neri" that is lexically present (the learner committed to *left*); `relational/blue_right S1` requires it to **accept** "slot six … neri" that is lexically interrupted (the learner committed to *slot six*). One arm demands ignoring a present sequence, the other demands accepting an interrupted one — no single lexical rule does both, because "the answer the learner committed to" is semantic. On the full set the three matchers disagree on **10 of 20 arms**. The three lexical rules give three different rates (contiguous 1/5 = overlay; ordered 1/5 = relational; order-free over-fires); the committed read gives 2/5.

This is the same surface-vs-function failure the project studies elsewhere (A10's lexicon-density-substitutes-for-recognition; the poetics "costume"; the adversarial-superego marker channel) — here turned on our own measurement instrument. A purely lexical correctness gate is itself a costume.

## Headroom (one held-out scenario at a time)

A held-out scenario shows **policy-memory headroom** iff **all** of:

1. **Distinct** — `policy_contrast_gate.verdict === "policy_distinct"` and `distinctiveness ≥ 0.12`.
2. **S1 correct** — S1's committed outcome is `correct`.
3. **S0 not correct** — S0's committed outcome is `incorrect` or `unreached` (so the advantage is attributable to policy memory, not to the seed being solvable without it).
4. **S1 survived locally** — `local_arms.S1_policy_memory.status === "survivor"` (guards against a correct answer reached by leakage).

## Family convergence

A family **converges** iff it is resolved (two held-out scenarios with text), not pending, and **both** held-out scenarios show headroom. Identical rule for fresh families and the prior — this is the point.

### The 2/5, and why the other three fail

- **overlay_registration** — converges. Both held-out scenarios S0 wrong/unreached → S1 correct via the fold move; distinct; survivors.
- **relational_betweenness** (prior) — converges. Both held-out scenarios S0 wrong → S1 correct (slot six neri / slot seven ralo); distinct; survivors.
- **constructed_midpoint** — fails. `teal_pegs` S0 already reaches the open-track naro without policy (no headroom); `plum_posts` S1 is correct but not policy-distinct (0.10 < 0.12).
- **pointer_chain_two_hop** — fails. Both held-out scenarios' S1 are correct but not policy-distinct (0.03, 0.11).
- **second_in_constructed_order** — fails. `blue_lower` S0 already reaches inner-left without policy (a family-design leak the headroom test correctly catches); only `gold_lower` has headroom.

Two of the three failures are the held-out seed being **solvable without the saved policy** — exactly what the headroom design is meant to detect — not a measurement artifact.

### Reconciliation with the canonical blind arbiter (§7.9)

Headroom counted by individual held-out scenario, this cross-check vs the canonical `blind-option-adjudication.js`. The **readings agree on every shared scenario**; the only verdict disagreement is `plum_posts`, and it is the distinctiveness gate (Caveat 2), not the reading.

| family | canonical blind arbiter | this cross-check (+0.12 gate) | agree? |
|---|---|---|---|
| relational_betweenness | 2/2 | 2/2 | ✓ |
| second_in_constructed_order | 1/2 (blue_lower S0 self-solves) | 1/2 | ✓ |
| constructed_midpoint | 1/2 (`plum_posts` = advantage) | 0/2 (`plum_posts` fails 0.10<0.12) | ✗ gate |
| distal_correspondence | 1/2 (+ k=3 stability 3/3 vs 0/3) | — skipped (Caveat 1) | gap |
| overlay_registration | — not run (channel retired, §7.9) | 2/2 | gap |
| pointer_chain_two_hop | — not run | 0/2 (fail gate 0.03, 0.11) | gap |

Canonical total **5 of 8 held-out scenarios** (4 families). This cross-check 5 of 10 (5 families, distal excluded). The unit is the **individual held-out scenario**, as §7.9 already argues: families split across their two scenarios, so a rate counted by family (whether the canonical 1/4 or this 2/5) is the misleading frame.

## Replicability

- The script stamps `criterion_version`, the globbed continuation paths, a SHA-256 of every continuation, and a SHA-256 of `committed-answers.json` into the output JSON.
- It is deterministic given its inputs (reports + continuations + committed-answers.json): no randomness, no clock, no network.
- Every committed read carries a verbatim quote the script verifies against the turn, so each verdict is auditable by inspection; the three lexical matchers are recorded alongside for cross-checking.
- Re-run: `node scripts/readjudicate-a18-transfer.js --root exports/recursive-tutor-learning --out exports/recursive-tutor-learning/a18.37-readjudication`

## Known limitations

- **Committed reads are hand-authored in v2.** They are inspection-reproducible (each has a verified verbatim quote and a rationale), but not yet push-button. The `--llm` channel closes that gap and is the next step if the rate is load-bearing for a decision.
- **Outcome as proxy for move.** Headroom infers "correct move applied" from "correct underdetermined target reached + policy-distinct + locally non-leaking". The `--llm` channel can check the move explicitly.
- **n is small, and this cross-check sees only five of six resolved families.** Six families of the 12-family pool are resolved (the five here + `distal_correspondence`, which this cross-check skips per Caveat 1); six are unrun or unresolved. Counted by individual held-out scenario, 5 of 8 (canonical) or 5 of 10 (here) is a thin signal on a structurally-identified subset, not a stable family rate — see the decision note.
