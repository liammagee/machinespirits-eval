# E2 runbook — replication fan under Codex harness

Status: Gate 1 passed (operator sanction 2026-06-12, "run Gate-1 with codex as
harness"). This file is the complete handoff for executing **E2 of
`ADAPTIVE-TUTOR-BOUNDARY-PLAN.md`**: k=5 replications of the frozen
lantern-p4 recipe, zero deltas, to measure P(grounded | fixed conditions).
Inputs it builds on: `exports/dramatic-derivation/boundary/gate1-memo.md`,
`corridor-map-world-002-lantern.md`, `conduct-parameters.md` (Gate 0, commit
cc995c61, branch `claude/derivation-fast-iteration`).

## 0 · Hard rules (do not improvise)

1. **Zero deltas.** The command in §3 is the §12.2/§13.2 p4 command verbatim —
   same world, script, seed (1), decay JSON, dials, casting. Only `--group`,
   `--label` change. Do NOT vary the seed across replicates: the fan measures
   conduct stochasticity at fixed conditions; a seed sweep is a different,
   unsanctioned experiment.
2. **No re-rolls, either direction.** k=5 is fixed; every arm reports,
   including deaths and ugly groundings. A crashed/truncated arm (CLI timeout,
   network) is the ONE exception: note it, delete its artifact dir, re-run the
   same label.
3. **Serialized + attended.** One arm at a time, a human checkpoint between
   arms (read the verdict + books lines, then decide to continue). Arms may be
   spread across days/quota windows — conditions are frozen, nothing expires.
4. **Kill rule.** Grounding rate ≤ 1/5 → STOP the whole boundary plan after
   the fan completes (all 5 still report). Do not start E3/E4.
5. **Never pool mock with real.** Mock smoke artifacts stay uncommitted.
6. **Learner stays pinned** (`claude/sonnet`). It is the one Claude-side
   dependency and it is NOT swappable — changing it breaks conduct
   comparability with p2–p5 and violates a standing project constraint.

## 1 · Billing anatomy (why this works when Claude credits are low)

Per grounded ~20-turn arm (p3/p4 actuals: 87 CLI calls, ~28 min wall):

| side | roles | calls/arm | notes |
|---|---|---|---|
| OpenAI (codex CLI) | director, tutor, tutor_superego | ~65 | the bulk of the spend |
| Claude (claude CLI, plan quota) | learner (sonnet, pinned) | ~20 short calls | unavoidable |
| Claude (claude CLI) | critic (Fable) | 0 now | run with `--critic off`, backfill later (§6) |

A death (t8–t12) costs roughly half (p5: 54 calls, ~12 min). If Claude quota
is exhausted mid-fan, pause between arms and resume after the window resets.

## 2 · Pre-flight (free)

```bash
cd <repo root>            # worktree: machinespirits-eval-derivation
git status                # expect clean, on claude/derivation-fast-iteration
codex --version           # codex CLI authenticated (OpenAI side)
claude --version          # claude CLI authenticated (learner needs plan quota)

# plumbing smoke, zero API calls, artifacts NOT committed:
DERIVATION_LLM=mock node scripts/run-derivation-loop.js \
  --world config/drama-derivation/world-002-lantern.yaml \
  --script config/drama-derivation/tutor-scripts/lantern-v001.md \
  --superego --acts '{"minActTurns":3,"maxActTurns":8}' \
  --decay '{"rate":0.75,"graceTurns":1,"maxConcurrent":2,"startTurn":1,"mutateShare":1.0,"seed":1,"pool":"staged"}' \
  --confront --repair-clause --release-authority --plot --throughline \
  --group lantern-e2-replication --label lantern-e2-mock-smoke \
  --critic-feedback off --critic off
```

Expect it to run to a verdict with no errors. (Mock conduct disengages at cap
on this world — that is normal and means nothing for real arms.)

Guard: if anything under `services/dramaticDerivation/` or the world YAML has
changed since cc995c61, first re-run `npm run derivation:corridor -- --validate`
and require 5/5 PASS before spending.

## 3 · Registration (commit BEFORE the first paid arm)

Append the block below to `ADAPTIVE-TUTOR-BOUNDARY-PLAN.md` (end of file),
commit it alone, message: `boundary: E2 registration — k=5 replication fan on
the frozen p4 recipe`.

```markdown
## E2 registration — 2026-06-12 (committed pre-run; this text does not change after)

Sanction: operator, 2026-06-12 ("run Gate-1 with codex as harness"). Harness
operator: Codex. One sanction = the whole fan.

Design: k=5 replicates of the frozen p4 recipe (§13.2 command), zero deltas,
seed 1 in every arm. Labels lantern-e2-real-r1 … lantern-e2-real-r5, group
lantern-e2-replication. Serialized, attended, human gate between arms. Critic
deferred per arm (--critic off) and backfilled for all five once Claude quota
allows — the notices are part of this registration, not optional.

Endpoints:
1. Grounding rate of 5, with Clopper–Pearson 95% lower bounds as tabled in
   §E2 (5/5 → ≥0.48 · 4/5 → ≥0.28 · 3/5 → ≥0.15).
2. Divergence inventory: for each arm, the first decision at which its
   trajectory departs the others (release offsets from the ledger, repair
   races from corruption ledger + transcript, figure ruts from diagnosis).
3. Corridor occupancy vs the E0 map: every tutor release offset, placed in
   its per-decision safe set; count of fatal-cell entries (bearing@t2/t3,
   chart@t7/t10/t11, key@t19) and of late-side license uses (none exist in
   any recorded run to date).

Kill rule: rate ≤1/5 → STOP the plan (all five still report). No re-roll in
either direction; crash/truncation = delete artifact dir, re-run same label,
note it here.
```

## 4 · The fan — run 5 times, labels r1 … r5

```bash
DERIVATION_PROVIDER=codex DERIVATION_LEARNER_PROVIDER=claude \
DERIVATION_LEARNER_MODEL=sonnet DERIVATION_CLI_TIMEOUT_MS=900000 \
DERIVATION_LLM=real node scripts/run-derivation-loop.js \
  --world config/drama-derivation/world-002-lantern.yaml \
  --script config/drama-derivation/tutor-scripts/lantern-v001.md \
  --superego --acts '{"minActTurns":3,"maxActTurns":8}' \
  --decay '{"rate":0.75,"graceTurns":1,"maxConcurrent":2,"startTurn":1,"mutateShare":1.0,"seed":1,"pool":"staged"}' \
  --confront --repair-clause --release-authority --plot --throughline \
  --group lantern-e2-replication --label lantern-e2-real-r1 \
  --critic-feedback off --critic off
```

Only `--label` changes between arms (`lantern-e2-real-r1` → `…-r2` … `…-r5`).
The `-real-` infix is REQUIRED — the conduct miner's backend tagger keys on it;
a label without it lands in the "unknown" bucket and corrupts the aggregates.

Notes on flags you might be tempted to add:
- No `--decay-visibility` flag: acts mode implies `conduct` (the runner
  enforces this; `told` is rejected in acts mode).
- `--critic-feedback off` (in-loop feedback, registered OFF for p3/p4/p5) is
  distinct from `--critic off` (skip the post-run notice — our quota deferral).

### Per-arm checklist (the attended human gate)

After each arm, from the console summary + artifacts in
`exports/dramatic-derivation/loop/<label>/`:

1. `VERDICT` line: `grounded_anagnorisis` at which turn, or death type + turn.
   Record it in the tally. (p4 reference: grounded t20, gap 0.)
2. `releases` line: `N on cue, M deviations, 0 missed, 0 unscheduled` —
   any `missed`/`unscheduled` ≠ 0 is a harness defect, stop and investigate.
3. Books: `reentries 0`, `firesWithoutDue 0` expected; decay slips/repairs
   noted (any number is conduct, not defect).
4. Note every tutor deviation offset (the ledger prints them with reasons) —
   this feeds endpoint 3 and the appetite estimate (n=12 today).
5. Commit the arm's artifacts immediately (exports/ is gitignored):
   `git add -f exports/dramatic-derivation/loop/lantern-e2-real-rN && git commit -m "derivation: E2 arm rN — <verdict> t<turn>"`
6. Decide: continue to next arm now, or pause for quota. Both fine.

## 5 · After the fan (free, no LLM)

```bash
npm run derivation:mine          # refresh conduct-parameters with the 5 new real arms
npm run derivation:corridor      # unchanged map; rerun only as a sanity no-op if desired
```

Then write the outcome:
1. Tally rate → apply the kill table from the registration.
2. Endpoint 2 (divergence inventory): compare the five `result.json` ledgers +
   dCurves; name the first split decision per arm.
3. Endpoint 3 (corridor occupancy): place every tutor offset in the E0 safe
   sets (`corridor-map-world-002-lantern.md`, "per-decision safe sets").
4. Append `### E2 outcome` under the registration in
   `ADAPTIVE-TUTOR-BOUNDARY-PLAN.md` (registration text above it unchanged),
   commit with the refreshed boundary exports:
   `git add -f exports/dramatic-derivation/boundary && git add ADAPTIVE-TUTOR-BOUNDARY-PLAN.md && git commit`.
5. Rate ≥ 2/5 → Gate 2 memo question is "E3 solvency gate next?" (fresh
   sanction). Rate ≤ 1/5 → STOP per kill rule; the outcome section says so.

## 6 · Critic backfill (later, when Claude quota refreshes)

Every run gets a Fable notice eventually (standing operator decision; it gates
nothing). Sequential on purpose, ~3–10 min each:

```bash
npm run derivation:critic -- --label lantern-e2-real-r1   # … r2 … r5
git add -f exports/dramatic-derivation/loop/lantern-e2-real-r*/commentary.md
git commit -m "derivation: E2 critic notices backfilled"
```

## 7 · Paper

Results fold into `docs/research/paper-full-2.0.md` §6.13.x ONLY (single-paper
discipline; the seven-arm table grows columns or gains a replication
subsection). Do not start a spin-off doc. The fold-in can wait for a Claude
session; the registration + outcome in the plan file are the durable record.
