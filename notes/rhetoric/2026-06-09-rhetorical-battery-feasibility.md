# A19R Mini-Drama Rhetorical Battery Screen

Date: 2026-06-09

## Purpose

This note records a cheap, non-claim-bearing screen for using rhetorical
mini-machines against A18/A19-style impasse scenarios.

The intervention is deliberately not framed as repair-language memory. Instead,
each candidate is generated from a small classical move ontology:

- stasis-hypophora reset
- synkrisis-exemplum
- enargeia-subgoal
- peripeteia-error spotting
- anagnorisis-sententia
- ethopoeia-correctio

The goal is to test feasibility of the development loop: construct A18/A19-like
cards, select moves stochastically with heuristic priors, run cheap gates, and
packetize plausible candidates before any model or human escalation.

## Artifacts

- Ontology: `config/rhetoric/mini-drama-ontology.v0.1.json`
- A18/A19 battery: `config/rhetoric/a18-a19-rhetorical-battery.v0.1.json`
- Codebook: `config/rhetoric/mini-drama-codebook.v0.1.json`
- Generator/screen implementation: `services/miniDramaMachines.js`
- CLI: `scripts/a19r-mini-drama.js`
- Tests: `tests/miniDramaMachines.test.js`

## Screen Command

```bash
npm run a19r:screen -- \
  --out .test-tmp/a19r-battery/screen.json \
  --samples-per-card 2 \
  --seed rhetoric-battery-2026-06-09
```

Then:

```bash
npm run a19r:report -- \
  --run .test-tmp/a19r-battery/screen.json \
  --out .test-tmp/a19r-battery/report.json \
  --json
```

## Results

The screen used 10 cards and 20 candidates, two stochastic/heuristic move
choices per card.

Summary:

- Gate status: pass
- Gate issues: 0
- Proxy-headroom candidates: 20/20
- Proxy-headroom rate: 1.0
- Feasibility label: `feasible_for_blinded_packet_screen`

By move:

| Move | Tested | Mean proxy delta |
| --- | ---: | ---: |
| peripeteia-error spotting | 4 | 0.3266 |
| ethopoeia-correctio | 2 | 0.3260 |
| anagnorisis-sententia | 3 | 0.3160 |
| stasis-hypophora reset | 5 | 0.3040 |
| enargeia-subgoal | 3 | 0.3027 |
| synkrisis-exemplum | 3 | 0.2927 |

By source family, all ten families produced at least one gated candidate with
proxy advantage over the plain shadow control. The strongest candidates were:

| Candidate | Move | Proxy delta |
| --- | --- | ---: |
| `a19_productive_impasse_answer_leakage_a__enargeia_subgoal` | enargeia-subgoal | 0.336 |
| `a18_selector_rail_priority_gold_middle__peripeteia_error_spotting` | peripeteia-error spotting | 0.336 |
| `a18_anchor_span_gold_middle__peripeteia_error_spotting` | peripeteia-error spotting | 0.336 |
| `a19_public_commitment_contradiction_a__anagnorisis_sententia` | anagnorisis-sententia | 0.331 |
| `a19_over_compliance_scaffold_dependency_a__ethopoeia_correctio` | ethopoeia-correctio | 0.326 |

## Representative Outputs

Productive impasse / answer leakage:

> Picture three small boxes. First: name the job. Second: touch the clue. Third:
> choose setup, next operation, or checking as the first place to inspect. Keep
> only those boxes in view.

A18 selector-rail constructed device:

> Switch the job: do not solve the whole thing yet. Spot the wrong turn: adding
> color, nearness, and groove as equal votes. Then point to the small frame
> mark, then point to the rail it singles out.

Moral disclosure / learner standing:

> "I am not asking to be called good; I am asking what I was allowed to decide."
> More exactly: answer the authority question without requiring more private
> disclosure. Try only this: name the permission question and offer a
> stop-or-continue path.

Public commitment contradiction:

> What just became visible: the problem is not the claim; it is which tutor
> commitment is still in force. Keep this principle: mark the role before
> judging the result. Now quote the two promises and say which one now governs.

Fraction common-unit counterexample:

> This is like counting coins only after they are in the same denomination.
> Example: first match the role, then compare the count. Try it here: draw one
> fifth-size strip and one half-size strip, then choose a shared strip size.

## Packetization Smoke

The four top representative candidates were successfully packetized into
blinded adjudication assignments:

```bash
npm run a19r:packetize -- \
  --run .test-tmp/a19r-battery/screen.json \
  --candidate-ids a19_productive_impasse_answer_leakage_a__enargeia_subgoal,a18_selector_rail_priority_gold_middle__peripeteia_error_spotting,a19_moral_disclosure_standing_repair_a__ethopoeia_correctio,a19_public_commitment_contradiction_a__anagnorisis_sententia \
  --out-dir .test-tmp/a19r-battery/packets \
  --assignment-dir .test-tmp/a19r-battery/assignments \
  --assignments \
  --blind
```

Output:

- Packets written: 4
- Web assignment env example:
  `A19_ADJUDICATION_ASSIGNMENT=.test-tmp/a19r-battery/assignments/mini_drama_v01__a19_productive_impasse_answer_leakage_a__1ee60c1965c4.assignment.json`
- Codebook env:
  `A19_ADJUDICATION_CODEBOOK=config/rhetoric/mini-drama-codebook.v0.1.json`

## A18/A19 Model-Pair Smoke

After the cheap proxy screen, two strongest candidates were run through the
same local A18/A19 replay model pairing used in the recent fresh-family screens:
Codex generator plus Claude checker, with the recursive tutor-learning gate.

Command:

```bash
npm run a19r:model-screen -- \
  --run .test-tmp/a19r-battery/screen.json \
  --candidate-ids a19_productive_impasse_answer_leakage_a__enargeia_subgoal,a18_selector_rail_priority_gold_middle__peripeteia_error_spotting \
  --out-dir exports/a19r/model-screens/2026-06-09-codex-claude-smoke \
  --force
```

The model screen materializes, for each candidate, an S0 replay with no policy
memory and an S1 replay with the selected rhetorical device as policy memory.
Both arms use the same public starting transcript.

Artifacts:

- Summary JSON:
  `exports/a19r/model-screens/2026-06-09-codex-claude-smoke/a19r-model-screen-summary.json`
- Summary Markdown:
  `exports/a19r/model-screens/2026-06-09-codex-claude-smoke/a19r-model-screen-summary.md`

Results:

| Candidate | S0 | S1 | Verdict | S0 score mean | S1 score mean | S0 recursive mean | S1 recursive mean |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: |
| `a19_productive_impasse_answer_leakage_a__enargeia_subgoal` | survivor | survivor | `both_survive_no_local_headroom` | 0.840 | 0.821 | 0.820 | 0.784 |
| `a18_selector_rail_priority_gold_middle__peripeteia_error_spotting` | survivor | survivor | `both_survive_no_local_headroom` | 0.850 | 0.845 | 0.790 | 0.830 |

Interpretation:

- The rhetorical-memory arms were viable under the same local replay/checker
  gate.
- They did not produce S1-only local headroom in this two-card smoke, because
  the no-memory S0 arms already survived.
- The A18 constructed-device card showed a small recursive tutor-learning lift
  under rhetorical memory (0.790 -> 0.830), while the A19 productive-impasse
  card did not.
- The main model-level risk is ceiling: the current public starts are easy
  enough for Codex to repair without rhetorical memory. A stronger next screen
  should either use harder S0 baselines, bounded-continuation constraints, or
  blind extraction over generated S0/S1 public transcripts.

## Bounded-Convergence Loop

To address the full-rewrite ceiling, the model screen was rerun with the replay
harness's bounded-continuation mode. Both arms had to preserve the original
public transcript prefix and append at most four nonblank public lines.

Top-four bounded command:

```bash
npm run a19r:model-screen -- \
  --run .test-tmp/a19r-battery/screen.json \
  --candidate-ids a19_productive_impasse_answer_leakage_a__enargeia_subgoal,a18_selector_rail_priority_gold_middle__peripeteia_error_spotting,a18_anchor_span_gold_middle__peripeteia_error_spotting,a19_public_commitment_contradiction_a__anagnorisis_sententia \
  --out-dir exports/a19r/model-screens/2026-06-09-bounded-top4 \
  --rewrite-mode bounded_continuation \
  --bounded-max-added-lines 4 \
  --force
```

Top-four results:

| Candidate | S0 | S1 | Verdict | S0 score mean | S1 score mean | S0 recursive mean | S1 recursive mean |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: |
| `a19_productive_impasse_answer_leakage_a__enargeia_subgoal` | survivor | revise_again | `shadow_local_ceiling_or_rhetorical_regression` | 0.869 | 0.842 | 0.786 | 0.860 |
| `a19_public_commitment_contradiction_a__anagnorisis_sententia` | survivor | survivor | `both_survive_no_local_headroom` | 0.845 | 0.815 | 0.810 | 0.790 |
| `a18_selector_rail_priority_gold_middle__peripeteia_error_spotting` | revise_again | survivor | `rhetorical_memory_local_advantage` | 0.765 | 0.864 | 0.700 | 0.830 |
| `a18_anchor_span_gold_middle__peripeteia_error_spotting` | reject | revise_again | `no_local_survivor` | 0.690 | 0.835 | 0.680 | 0.770 |

The only bounded S1-only survivor was the A18 selector-rail card. It was then
rerun four more times, for five live Codex/Claude attempts total.

Selector-rail stability:

| Attempt | Artifact dir | Verdict | S0 | S1 | S0 score mean | S1 score mean | S0 recursive mean | S1 recursive mean |
| ---: | --- | --- | --- | --- | ---: | ---: | ---: | ---: |
| 1 | `exports/a19r/model-screens/2026-06-09-bounded-top4` | `rhetorical_memory_local_advantage` | revise_again | survivor | 0.765 | 0.864 | 0.700 | 0.830 |
| 2 | `exports/a19r/model-screens/2026-06-09-bounded-selector-seed2` | `both_survive_no_local_headroom` | survivor | survivor | 0.820 | 0.890 | 0.740 | 0.860 |
| 3 | `exports/a19r/model-screens/2026-06-09-bounded-selector-seed3` | `rhetorical_memory_local_advantage` | revise_again | survivor | 0.810 | 0.855 | 0.740 | 0.790 |
| 4 | `exports/a19r/model-screens/2026-06-09-bounded-selector-seed4` | `rhetorical_memory_local_advantage` | revise_again | survivor | 0.832 | 0.875 | 0.800 | 0.820 |
| 5 | `exports/a19r/model-screens/2026-06-09-bounded-selector-seed5` | `rhetorical_memory_local_advantage` | revise_again | survivor | 0.795 | 0.830 | 0.710 | 0.770 |

Converged local result:

- Under full rewrite, the approach was ceiling-limited: S0 could already repair.
- Under bounded continuation, one A18 constructed-device rhetorical candidate
  showed modal local advantage: 4/5 attempts were S1-only survivors.
- The effect is not broad across the sampled battery: the A19 candidates did
  not show local S1-only headroom, and the A18 anchor-span card improved but did
  not survive.
- The converged result is therefore **narrow feasibility**, not a transfer
  claim: peripeteia-style rhetorical memory can help the selector-rail
  constructed-device case break through the local bounded gate, but the current
  battery does not support a general A18/A19 rate.

## Selector-Rail Transfer Fanout

A follow-up fanout tested whether the selector-rail result transfers across
nearby constructed-device siblings. The fanout adds six selector-rail cards with
different selector mark positions and misleading surface cue mixtures:

- `selector_rail_fanout_green_middle`
- `selector_rail_fanout_blue_top`
- `selector_rail_fanout_plum_bottom`
- `selector_rail_fanout_rust_middle`
- `selector_rail_fanout_teal_top`
- `selector_rail_fanout_gold_lower`

Fanout card pool:

`config/rhetoric/selector-rail-transfer-fanout.v0.1.json`

Cheap proxy command:

```bash
npm run a19r:screen -- \
  --cards config/rhetoric/selector-rail-transfer-fanout.v0.1.json \
  --moves peripeteia_error_spotting \
  --samples-per-card 1 \
  --seed selector-fanout-2026-06-09 \
  --out .test-tmp/a19r-selector-fanout/screen.json \
  --json
```

Proxy result: 6/6 gated peripeteia candidates, 6/6 proxy-positive.

Live bounded full-memory command:

```bash
npm run a19r:model-screen -- \
  --run .test-tmp/a19r-selector-fanout/screen.json \
  --out-dir exports/a19r/model-screens/2026-06-09-selector-fanout-full \
  --rewrite-mode bounded_continuation \
  --bounded-max-added-lines 4 \
  --memory-mode full \
  --force
```

Fanout live results:

| Candidate | S0 | S1 | Verdict | S0 score mean | S1 score mean | S0 recursive mean | S1 recursive mean |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: |
| `selector_rail_fanout_green_middle__peripeteia_error_spotting` | survivor | revise_again | `shadow_local_ceiling_or_rhetorical_regression` | 0.880 | 0.835 | 0.810 | 0.780 |
| `selector_rail_fanout_blue_top__peripeteia_error_spotting` | survivor | survivor | `both_survive_no_local_headroom` | 0.865 | 0.860 | 0.810 | 0.840 |
| `selector_rail_fanout_plum_bottom__peripeteia_error_spotting` | survivor | survivor | `both_survive_no_local_headroom` | 0.885 | 0.850 | 0.840 | 0.810 |
| `selector_rail_fanout_rust_middle__peripeteia_error_spotting` | survivor | survivor | `both_survive_no_local_headroom` | 0.870 | 0.844 | 0.830 | 0.812 |
| `selector_rail_fanout_teal_top__peripeteia_error_spotting` | revise_again | revise_again | `no_local_survivor` | 0.844 | 0.840 | 0.822 | 0.820 |
| `selector_rail_fanout_gold_lower__peripeteia_error_spotting` | revise_again | survivor | `rhetorical_memory_local_advantage` | 0.785 | 0.867 | 0.730 | 0.820 |

Fanout interpretation:

- Full-memory transfer produced S1-only advantage in only 1/6 sibling cards.
- Three sibling cards were S0 ceiling, one regressed under S1, and one failed
  both arms.
- Therefore the original selector-rail result does **not** transfer robustly
  across this sibling fanout.

The only fanout hit, `selector_rail_fanout_gold_lower`, was rerun twice more
under full memory:

| Attempt | Artifact dir | Verdict | S0 | S1 | S0 score mean | S1 score mean | S0 recursive mean | S1 recursive mean |
| ---: | --- | --- | --- | --- | ---: | ---: | ---: | ---: |
| 1 | `exports/a19r/model-screens/2026-06-09-selector-fanout-full` | `rhetorical_memory_local_advantage` | revise_again | survivor | 0.785 | 0.867 | 0.730 | 0.820 |
| 2 | `exports/a19r/model-screens/2026-06-09-gold-lower-full-seed2` | `both_survive_no_local_headroom` | survivor | survivor | 0.844 | 0.822 | 0.800 | 0.806 |
| 3 | `exports/a19r/model-screens/2026-06-09-gold-lower-full-seed3` | `both_survive_no_local_headroom` | survivor | survivor | 0.835 | 0.815 | 0.790 | 0.780 |

Gold-lower replication interpretation:

- The one fanout hit did not replicate as stable S1-only advantage: 1/3
  attempts were S1-only, 2/3 were S0 ceiling.
- This closes the transfer question locally: selector-rail peripeteia memory is
  not a robust transfer mechanism in the current fanout.

## Memory-Format Ablation

The gold-lower fanout hit was also tested with reduced memory formats:

| Memory mode | Artifact dir | Verdict | S0 | S1 | S0 score mean | S1 score mean | S0 recursive mean | S1 recursive mean |
| --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: |
| `device_only` | `exports/a19r/model-screens/2026-06-09-gold-lower-device-only` | `shadow_local_ceiling_or_rhetorical_regression` | survivor | revise_again | 0.885 | 0.800 | 0.830 | 0.790 |
| `policy_only` | `exports/a19r/model-screens/2026-06-09-gold-lower-policy-only` | `no_local_survivor` | revise_again | revise_again | 0.802 | 0.820 | 0.772 | 0.790 |
| `exemplar_only` | `exports/a19r/model-screens/2026-06-09-gold-lower-exemplar-only` | `both_survive_no_local_headroom` | survivor | survivor | 0.850 | 0.845 | 0.800 | 0.840 |

Memory-format interpretation:

- None of the reduced memory formats reproduced S1-only advantage.
- The device label alone is insufficient.
- The policy text alone is insufficient.
- The exemplar alone creates ceiling rather than headroom.
- Combined full memory can produce local S1-only outcomes, but the effect is
  unstable under replication and does not transfer robustly.

## Superseding Convergence Result

After the selector-rail fanout and memory-format ablation, the local conclusion
is stronger and more negative than the first bounded screen:

- The rhetorical-device branch remains useful as a fast construction and
  screening workflow.
- The original selector-rail bounded signal is real enough to reproduce on that
  card (4/5), but it should be treated as card-local.
- The mechanism does not robustly transfer across nearby selector-rail siblings
  in this fanout.
- The one apparent fanout transfer hit did not replicate.
- Reduced memory formats did not preserve S1-only advantage.

The practical next move is not more blind paneling. The next useful engineering
move is to redesign the S0 baseline and the selector-rail family generator so
S0 does not self-repair so easily, then rerun a smaller family-level transfer
test.

## Redesign Rerun Result

The follow-up implemented that redesign rather than escalating directly to
human panels:

- `services/miniDramaMachines.js` now keeps the old neutral shadow control but
  also generates a `diagnostic_lure` baseline that preserves the wrong surface
  rule instead of handing S0 the selector relation.
- `scripts/a19r-mini-drama.js model-screen` now supports
  `--baseline-mode diagnostic_lure` and `--s0-mode checker_only`, so S0 can be
  scored as the unrewritten weak baseline while S1 receives bounded rhetorical
  memory.
- `config/rhetoric/selector-rail-redesigned-fanout.v0.2.json` adds a four-card
  selector-rail family with explicit surface-rule lures and selector contrasts.

Cheap screen:

```bash
npm run a19r:screen -- \
  --cards config/rhetoric/selector-rail-redesigned-fanout.v0.2.json \
  --moves peripeteia_error_spotting \
  --samples-per-card 1 \
  --seed selector-redesign-v2-2026-06-09 \
  --out .test-tmp/a19r-selector-redesign-v2/screen.json \
  --json
```

Result: 4/4 cards gated, 4/4 proxy-positive. This remains construction
evidence only.

Bounded Codex/Claude redesign screen:

```bash
npm run a19r:model-screen -- \
  --run .test-tmp/a19r-selector-redesign-v2/screen.json \
  --out-dir exports/a19r/model-screens/2026-06-09-selector-redesign-checker-s0-full \
  --rewrite-mode bounded_continuation \
  --bounded-max-added-lines 4 \
  --baseline-mode diagnostic_lure \
  --s0-mode checker_only \
  --memory-mode full \
  --force
```

First redesigned pass:

| Candidate | Verdict | S0 | S1 | S1 score mean | S1 recursive mean |
| --- | --- | --- | --- | ---: | ---: |
| `selector_rail_redesign_majority_lower__peripeteia_error_spotting` | `rhetorical_memory_local_advantage` | reject | survivor | 0.825 | 0.800 |
| `selector_rail_redesign_color_decoy_top__peripeteia_error_spotting` | `rhetorical_memory_local_advantage` | reject | survivor | 0.850 | 0.780 |
| `selector_rail_redesign_groove_decoy_middle__peripeteia_error_spotting` | `rhetorical_memory_local_advantage` | reject | survivor | 0.867 | 0.840 |
| `selector_rail_redesign_nearness_decoy_bottom__peripeteia_error_spotting` | `no_local_survivor` | reject | revise_again | 0.850 | 0.850 |

The redesign fixed the earlier S0-ceiling problem under this diagnostic-lure
screen: S0 was rejected on all four cards. But S1 did not survive on all four,
so the result was not yet a full-family transfer claim.

Follow-up iterations:

- The `nearness_decoy_bottom` card was tightened so the old rule made a false
  lower prediction rather than merely leaving the tab unexplained. It remained a
  near-miss in two reruns:
  `exports/a19r/model-screens/2026-06-09-selector-redesign-nearness-v2` and
  `exports/a19r/model-screens/2026-06-09-selector-redesign-nearness-v3`.
  Both had S0=`reject`, S1=`revise_again`, and checker
  `recommended_action=accept_for_blind_panel`, but the strict local gate stayed
  below threshold on old-warrant or recursive-update details.
- The full-memory policy was tightened to ask for a forward-facing tutor
  carry-forward line when a final stock-taking line is used.
- A three-card core replication
  (`exports/a19r/model-screens/2026-06-09-selector-redesign-core-replication`)
  found 2/3 S1-only advantages: `color_decoy_top` and `groove_decoy_middle`
  repeated; `majority_lower` became a strict-threshold near-miss.
- A final two-card confirmation
  (`exports/a19r/model-screens/2026-06-09-selector-redesign-stable-core-confirm`)
  found 2/2 S1-only advantages:

| Candidate | Verdict | S0 | S1 | S1 score mean | S1 recursive mean |
| --- | --- | --- | --- | ---: | ---: |
| `selector_rail_redesign_color_decoy_top__peripeteia_error_spotting` | `rhetorical_memory_local_advantage` | reject | survivor | 0.855 | 0.824 |
| `selector_rail_redesign_groove_decoy_middle__peripeteia_error_spotting` | `rhetorical_memory_local_advantage` | reject | survivor | 0.861 | 0.840 |

Redesign interpretation:

- The diagnostic-lure S0 baseline is a better fast screen than the original
  neutral shadow for selector-rail transfer, because it no longer hands S0 the
  selector relation.
- The v0.2 selector generator produced a stable local signal for a narrower
  two-sibling core: color-decoy and groove-decoy selector conflicts.
- The redesigned signal should not be generalized to the full four-card family:
  majority and nearness cases are near-misses under the strict local gate.
- The next legitimate escalation is a tiny blinded packet screen for the stable
  two-card core only, with majority/nearness retained as near-miss diagnostics.

## Stable-Core Blinded Packet Screen

The tiny packet screen was generated for only the two stable siblings:

- `selector_rail_redesign_color_decoy_top__peripeteia_error_spotting`
- `selector_rail_redesign_groove_decoy_middle__peripeteia_error_spotting`

Command:

```bash
npm run a19r:packetize -- \
  --run .test-tmp/a19r-selector-redesign-v2/screen.json \
  --candidate-ids selector_rail_redesign_color_decoy_top__peripeteia_error_spotting,selector_rail_redesign_groove_decoy_middle__peripeteia_error_spotting \
  --out-dir exports/a19r/adjudication-packets/2026-06-09-selector-redesign-stable-core \
  --assignment-dir exports/a19r/human-coder-assignments/2026-06-09-selector-redesign-stable-core \
  --key-dir exports/a19r/human-coder-assignments/2026-06-09-selector-redesign-stable-core/private-keys \
  --assignments \
  --blind \
  --json
```

Generated packet assignments:

| Sibling | Packet | Coder assignment | Private key |
| --- | --- | --- | --- |
| color-decoy top | `exports/a19r/adjudication-packets/2026-06-09-selector-redesign-stable-core/mini_drama_v01__selector_rail_redesign_color_decoy_top__d517ddcb21a5.packet.json` | `exports/a19r/human-coder-assignments/2026-06-09-selector-redesign-stable-core/mini_drama_v01__selector_rail_redesign_color_decoy_top__d517ddcb21a5.assignment.json` | `exports/a19r/human-coder-assignments/2026-06-09-selector-redesign-stable-core/private-keys/mini_drama_v01__selector_rail_redesign_color_decoy_top__d517ddcb21a5.assignment-key.json` |
| groove-decoy middle | `exports/a19r/adjudication-packets/2026-06-09-selector-redesign-stable-core/mini_drama_v01__selector_rail_redesign_groove_decoy_middle__9500d203afe0.packet.json` | `exports/a19r/human-coder-assignments/2026-06-09-selector-redesign-stable-core/mini_drama_v01__selector_rail_redesign_groove_decoy_middle__9500d203afe0.assignment.json` | `exports/a19r/human-coder-assignments/2026-06-09-selector-redesign-stable-core/private-keys/mini_drama_v01__selector_rail_redesign_groove_decoy_middle__9500d203afe0.assignment-key.json` |

Checks:

- `npm run a19r:codebook-validate -- --json`: pass.
- `npm run a19r:qa -- --run .test-tmp/a19r-selector-redesign-v2/screen.json --json`: pass.
- Redaction audit over the two coder-facing assignments: pass; no
  `intended_move_id`, `gate_status`, `private_key`,
  `rhetorical_memory_local_advantage`, `baseline_control`,
  `selector_rail_redesign_majority_lower`, or
  `selector_rail_redesign_nearness_decoy_bottom` appeared in coder-facing
  files.
- `npm run test:a19:dashboard`: pass.
- Live local browser smoke on
  `http://127.0.0.1:3477/adjudication` with the color-decoy assignment: pass.
  The form rendered two blinded arms, the mini-drama codebook labels, and the
  move-specific UI labels. Browser console warnings/errors: none.

Escalation boundary: these are ready for a small human/double-coder screen as
blinded coder assignments, but they still license only local adjudication of
move-specific usefulness. They do not license human-learning, deployed-tutor,
model-weight-learning, full-family selector transfer, pooled A18/A19, or Paper
2.0 claims.

## Automated-Only Continuation

Human adjudication was then parked. The automated-only continuation explored the
two next moves:

1. seed replication of the two stable selector-core cards;
2. a fresh sibling family generated from the two stable patterns, followed by
   alternate rhetorical-device search for any near-misses.

### Stable-core seed replication

Two additional full-memory diagnostic-lure replications were run on only:

- `selector_rail_redesign_color_decoy_top__peripeteia_error_spotting`
- `selector_rail_redesign_groove_decoy_middle__peripeteia_error_spotting`

Artifacts:

- `exports/a19r/model-screens/2026-06-09-selector-redesign-stable-core-rep2`
- `exports/a19r/model-screens/2026-06-09-selector-redesign-stable-core-rep3`

Results:

| Candidate | Prior strict S1-only attempts | Rep2 | Rep3 | Automated status |
| --- | ---: | --- | --- | --- |
| `selector_rail_redesign_color_decoy_top__peripeteia_error_spotting` | 3/3 | S1-only | near-miss | probable but not saturated |
| `selector_rail_redesign_groove_decoy_middle__peripeteia_error_spotting` | 3/3 | S1-only | S1-only | stable core |

The groove-decoy card is now the stronger stable seed: 5/5 strict S1-only
survivors under diagnostic-lure S0. The color-decoy card is 4/5 strict S1-only.
Its failed replication still had strong S1 scores
(`score_mean=0.851`, `recursive_score_mean=0.832`) but missed the strict
`old_warrant_misclassification` threshold (`0.62`). The checker treated the old
color-match cue as a true local token fact that became insufficient for the rail
question, rather than a plainly wrong public prediction.

### Fresh sibling family

A six-card sibling family was created at:

`config/rhetoric/selector-rail-stable-pattern-fresh.v0.3.json`

It preserves the stable conflict shape but varies cue positions and visible
surface lures:

- three groove/path-vs-marker siblings;
- three same-color token-vs-tab siblings.

Cheap peripeteia screen:

```bash
npm run a19r:screen -- \
  --cards config/rhetoric/selector-rail-stable-pattern-fresh.v0.3.json \
  --moves peripeteia_error_spotting \
  --samples-per-card 1 \
  --seed selector-stable-fresh-v03-2026-06-09 \
  --out .test-tmp/a19r-selector-stable-fresh-v03/screen-peripeteia.json \
  --json
```

Result: 6/6 gated, 6/6 proxy-positive.

Live peripeteia model screen:

```bash
npm run a19r:model-screen -- \
  --run .test-tmp/a19r-selector-stable-fresh-v03/screen-peripeteia.json \
  --out-dir exports/a19r/model-screens/2026-06-09-selector-stable-fresh-v03-peripeteia \
  --rewrite-mode bounded_continuation \
  --bounded-max-added-lines 4 \
  --baseline-mode diagnostic_lure \
  --s0-mode checker_only \
  --memory-mode full \
  --force
```

Fresh-family peripeteia result:

| Candidate | Verdict | S0 | S1 score mean | S1 recursive mean | Old-warrant score |
| --- | --- | --- | ---: | ---: | ---: |
| `selector_rail_fresh_groove_top_marker_middle__peripeteia_error_spotting` | near-miss | reject | 0.811 | 0.738 | 0.65 |
| `selector_rail_fresh_groove_lower_marker_top__peripeteia_error_spotting` | S1-only | reject | 0.880 | 0.840 | 0.85 |
| `selector_rail_fresh_groove_middle_marker_lower__peripeteia_error_spotting` | near-miss | reject | 0.832 | 0.836 | 0.65 |
| `selector_rail_fresh_color_red_top_marker_lower__peripeteia_error_spotting` | S1-only | reject | 0.850 | 0.830 | 0.85 |
| `selector_rail_fresh_color_green_lower_marker_middle__peripeteia_error_spotting` | near-miss | reject | 0.814 | 0.796 | 0.62 |
| `selector_rail_fresh_color_plum_middle_marker_top__peripeteia_error_spotting` | S1-only | reject | 0.860 | 0.820 | 0.75 |

This reproduced the important engineering result: diagnostic-lure S0 rejected
on all six cards, so the earlier ceiling problem stayed fixed. Peripeteia alone
was not sufficient for full-family transfer: 3/6 strict S1-only, 3/6 near-miss.

The three near-misses all failed for the same reason. Their S1 transcripts
usually built a good public bridge, learner uptake, and tutor carry-forward, but
the old rule was shown as incomplete or out of scope rather than as visibly
making a wrong prediction. The strict gate wants the learner to apply the old
rule, get a wrong public answer, and then replace that answer with the new
selector relation.

### Alternate-device saturation matrix

The three peripeteia near-misses were screened against the remaining five
implemented rhetorical devices:

```bash
npm run a19r:screen -- \
  --cards config/rhetoric/selector-rail-stable-pattern-fresh.v0.3.json \
  --card-ids selector_rail_fresh_groove_top_marker_middle,selector_rail_fresh_groove_middle_marker_lower,selector_rail_fresh_color_green_lower_marker_middle \
  --moves stasis_hypophora_reset,synkrisis_exemplum,enargeia_subgoal,anagnorisis_sententia,ethopoeia_correctio \
  --samples-per-card 5 \
  --seed selector-stable-fresh-v03-alt-devices-2026-06-09 \
  --out .test-tmp/a19r-selector-stable-fresh-v03/screen-alt-devices.json \
  --json
```

Result: 15/15 gated, 15/15 proxy-positive.

Live alternate-device artifacts:

- `exports/a19r/model-screens/2026-06-09-selector-stable-fresh-v03-alt-synkrisis-enargeia`
- `exports/a19r/model-screens/2026-06-09-selector-stable-fresh-v03-alt-stubborn-stasis-anag-ethop`
- `exports/a19r/model-screens/2026-06-09-selector-stable-fresh-v03-alt-remaining-matrix`

Device-by-card strict outcomes:

| Card | Peripeteia | Synkrisis | Enargeia | Stasis | Anagnorisis | Ethopoeia | Any-device status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `selector_rail_fresh_groove_top_marker_middle` | near-miss | S1-only | S1-only | near-miss | S1-only | near-miss | rescued |
| `selector_rail_fresh_groove_lower_marker_top` | S1-only | not needed | not needed | not needed | not needed | not needed | rescued |
| `selector_rail_fresh_groove_middle_marker_lower` | near-miss | near-miss | near-miss | S1-only | near-miss | S1-only | rescued |
| `selector_rail_fresh_color_red_top_marker_lower` | S1-only | not needed | not needed | not needed | not needed | not needed | rescued |
| `selector_rail_fresh_color_green_lower_marker_middle` | near-miss | S1-only | S1-only | S1-only | near-miss | S1-only | rescued |
| `selector_rail_fresh_color_plum_middle_marker_top` | S1-only | not needed | not needed | not needed | not needed | not needed | rescued |

Among the three peripeteia near-misses, alternate-device live results were:

| Device | Strict S1-only | Near-miss | Notes |
| --- | ---: | ---: | --- |
| `synkrisis_exemplum` | 2/3 | 1/3 | strong when comparison makes cue roles explicit |
| `enargeia_subgoal` | 2/3 | 1/3 | strong when vivid subgoals force separate visible checks |
| `stasis_hypophora_reset` | 2/3 | 1/3 | strong when the transcript stages a question/test ruling |
| `anagnorisis_sententia` | 1/3 | 2/3 | weakest here; can name recognition without forcing contradiction |
| `ethopoeia_correctio` | 2/3 | 1/3 | strong when correction reverses the initial bracketing move |

The hardest card was `selector_rail_fresh_groove_middle_marker_lower`. It failed
under peripeteia, synkrisis, enargeia, and anagnorisis, but passed under stasis
and ethopoeia. This is useful because it shows the space was not exhausted by
more vivid examples alone; the successful devices were the ones that made the
tutor publicly correct its own wrong bracketing or run a ruling test.

### Automated-only conclusion

The current automated evidence supports a systematic but bounded finding:

- The diagnostic-lure/checker-only S0 design fixed the main false-negative
  blocker from the first transfer fanout: S0 no longer self-repairs by being
  handed the selector relation.
- Peripeteia transfers only partially across fresh selector siblings: 3/6
  strict S1-only.
- The implemented rhetorical-device space is saturated for the three
  peripeteia near-misses: all five alternate devices were tried on all three
  cards, and every card was rescued by at least one device.
- There is no single universal rhetorical device in this selector family.
  Device choice must remain heuristic and card-conditional.
- The shared failure mode is not general transcript weakness. It is the strict
  old-warrant criterion: many good S1 rewrites show the old cue as insufficient
  or mis-scoped, while the local gate requires an inspectable wrong prediction.

The next automated engineering improvement would be to change the card schema
and/or generator prompt so each selector sibling explicitly contains a
`wrong_prediction_collision` field: what the old lure predicts, why that answer
is publicly wrong, and what visible selector relation supersedes it. That is a
generator/gate-alignment improvement, not evidence that more random rhetorical
devices are needed.

## Collision-Aligned Continuation

The next automated loop implemented that generator/gate-alignment improvement
and then reran the selector family to exhaustion.

Implementation changes:

- `config/rhetoric/selector-rail-collision-fanout.v0.4.json` adds six selector
  siblings with explicit `wrong_prediction_collision` objects.
- `services/miniDramaMachines.js` now resolves collision metadata, carries it
  into generated candidates, and lets collision-aware mini-drama responses ask
  the learner to let the old rule make its public wrong prediction before
  testing the visible refutation.
- `scripts/a19r-mini-drama.js` now writes the collision into S1 policy memory
  and adds constraints to make the old visible rule produce its named wrong
  public prediction before replacing it.
- `tests/miniDramaMachines.test.js` now checks that collision metadata survives
  candidate generation and dry-run model-screen policy-memory writing.

Focused test:

```bash
npm run test:a19r
```

Result: pass, 11/11.

### v0.4 peripeteia pass

Cheap screen:

```bash
npm run a19r:screen -- \
  --cards config/rhetoric/selector-rail-collision-fanout.v0.4.json \
  --moves peripeteia_error_spotting \
  --samples-per-card 1 \
  --seed selector-collision-v04-2026-06-09 \
  --out .test-tmp/a19r-selector-collision-v04/screen-peripeteia.json \
  --json
```

Result: 6/6 gated, 6/6 proxy-positive.

Live screen:

```bash
npm run a19r:model-screen -- \
  --run .test-tmp/a19r-selector-collision-v04/screen-peripeteia.json \
  --out-dir exports/a19r/model-screens/2026-06-09-selector-collision-v04-peripeteia \
  --rewrite-mode bounded_continuation \
  --bounded-max-added-lines 4 \
  --baseline-mode diagnostic_lure \
  --s0-mode checker_only \
  --memory-mode full \
  --force
```

Result: 4/6 strict S1-only, 2/6 near-miss, with S0 rejected on all six. This
improved over the v0.3 peripeteia rate of 3/6 and fixed the old-warrant score
on the previously stubborn `groove_middle_marker_lower` card.

| Card | Peripeteia verdict | Main remaining blocker |
| --- | --- | --- |
| `groove_top_marker_middle` | S1-only | none |
| `groove_lower_marker_top` | near-miss | old-warrant 0.60 plus recursive strategy-accountability |
| `groove_middle_marker_lower` | S1-only | none |
| `color_red_top_marker_lower` | S1-only | none |
| `color_green_lower_marker_middle` | near-miss | device-specificity 0.68 |
| `color_plum_middle_marker_top` | S1-only | none |

### v0.4 alternate-device matrix

The two peripeteia near-misses were screened against the remaining five
implemented devices:

```bash
npm run a19r:screen -- \
  --cards config/rhetoric/selector-rail-collision-fanout.v0.4.json \
  --card-ids selector_rail_collision_groove_lower_marker_top,selector_rail_collision_color_green_lower_marker_middle \
  --moves stasis_hypophora_reset,synkrisis_exemplum,enargeia_subgoal,anagnorisis_sententia,ethopoeia_correctio \
  --samples-per-card 5 \
  --seed selector-collision-v04-alt-devices-2026-06-09 \
  --out .test-tmp/a19r-selector-collision-v04/screen-alt-devices.json \
  --json
```

Result: 10/10 gated, 10/10 proxy-positive.

Live artifact:

`exports/a19r/model-screens/2026-06-09-selector-collision-v04-alt-full-matrix`

Result: 7/10 strict S1-only. Both near-miss cards were rescued by at least
three alternate devices.

| Card | Synkrisis | Enargeia | Stasis | Anagnorisis | Ethopoeia |
| --- | --- | --- | --- | --- | --- |
| `groove_lower_marker_top` | S1-only | near-miss | S1-only | S1-only | S1-only |
| `color_green_lower_marker_middle` | S1-only | S1-only | near-miss | S1-only | near-miss |

### Conditional selected-family checks

A generated selected-family run chose the best observed device per card and
tested whether the family could replicate as a coherent conditional policy.

First selected-family confirmation, 4-line cap:

`exports/a19r/model-screens/2026-06-09-selector-collision-v04-selected-family-confirm`

Result: 2/6 S1-only. The failure mode shifted away from old-warrant and toward
recursive tutor-learning details. In particular, the four-line cap often allowed
the tutor to stock-take but not enough room for a later learner response to test
that tutor policy update.

Narrow 5-line rescue pass on the four failed branches:

`exports/a19r/model-screens/2026-06-09-selector-collision-v04-selected-family-confirm-5line-failures`

Result: 3/4 rescued. The remaining failure was
`groove_middle_marker_lower__peripeteia_error_spotting`, which still read as a
generic error-spotting scaffold and weak tutor-learning update under replication.

Final one-card alternate pass for that remaining failure:

`exports/a19r/model-screens/2026-06-09-selector-collision-v04-groove-middle-alt-5line`

Result: 3/5 strict S1-only. `stasis_hypophora_reset` was strongest
(`score_mean=0.914`, `recursive_score_mean=0.868`), followed by
`ethopoeia_correctio` and `synkrisis_exemplum`.

Final selected-family 5-line confirmation with the stasis substitution:

`exports/a19r/model-screens/2026-06-09-selector-collision-v04-selected-family-5line-v2-confirm`

Result: 4/6 S1-only. Two branches that had passed in isolated rescue still
missed under final confirmation:

| Candidate | Final status | Blocking criterion |
| --- | --- | --- |
| `selector_rail_collision_groove_lower_marker_top__anagnorisis_sententia` | near-miss | old-warrant 0.50; checker again read smoothness as incomplete rather than contradicted |
| `selector_rail_collision_groove_middle_marker_lower__stasis_hypophora_reset` | near-miss | recursive dyadic update 0.68; tutor policy update started but was not fully closed |

### Collision-loop finding

The collision metadata was a real improvement but not a complete solution:

- It improved peripeteia transfer from 3/6 to 4/6.
- It rescued the previously stubborn groove-middle/lower card under direct
  peripeteia once, and under stasis/synkrisis/ethopoeia in the final alternate
  search.
- It changed the dominant failure mode. Old-warrant ambiguity became less
  common; recursive tutor-learning closure and bounded-line room became the new
  bottlenecks.
- A five-line cap rescued most four-line confirmation failures, which means
  some earlier misses were harness constraints rather than device failures.
- A full selected-family policy did not robustly replicate: 2/6 under the first
  confirmation, 4/6 under the final 5-line/stasis-substitution confirmation.

Stopping condition: the implemented device ontology is saturated for the v0.4
selector family. Every unresolved card has been tested against every implemented
alternate device, the line-cap hypothesis was tested, and the final misses are
not solved by another untested rhetorical device. The residual problem is
stochastic replay/checker instability plus a strict gate that sometimes treats
surface-rule failures as scope limits rather than wrong predictions, and
sometimes requires a fuller recursive tutor-learning loop than the bounded
continuation can reliably supply.

The next productive engineering move would not be another stochastic rhetorical
device sweep. It would be one of:

- a deterministic transcript-template pass that explicitly allocates turns for
  tutor false start, learner collision, tutor revision, learner uptake, and
  tutor forward commitment;
- a multi-seed statistics harness that reports pass rates for each selected
  device rather than treating one live replay as decisive;
- or a gate split that separates `old_rule_scope_failure` from
  `old_rule_wrong_prediction`, because the current checker sometimes collapses
  selector-role failures into the stricter wrong-prediction criterion.

## Feasibility Judgment

The approach is feasible as a fast development screen. It does three useful
things that the exhausted A19 repair-language loop did not:

1. It changes the intervention surface from explicit repair obligations to
   compact rhetorical action forms.
2. It is cheap enough to iterate locally with deterministic gates before model
   or human spending.
3. It produces blinded packets through the same adjudication substrate already
   built for A19.

The most promising first families are:

- peripeteia-error spotting for A18 constructed-device cue conflicts;
- enargeia-subgoal for productive impasse / answer-leakage cases;
- ethopoeia-correctio for status-threat and over-compliance cases;
- anagnorisis-sententia for public-commitment and working-agreement cases.

## Interpretation Limits

The 20/20 deterministic proxy result is not S0/S1 evidence. The shadow controls
already share the same local action gate, and the proxy rewards visible move
fidelity, so the proxy advantage should be read as construction success, not as
recursive-full S0 headroom.

The bounded Codex/Claude loop is local simulated teacher-as-learner S0/S1
evidence for this checkout's replay gate only. It is not a human-learning,
deployed-tutor, model-weight-learning, pooled A18/A19, or Paper 2.0 empirical
claim.

If human adjudication is resumed later, the legitimate escalation remains a
small blinded packet screen, not a paper claim. Human coders should judge
whether the rhetorical move actually helps the impasse for move-specific reasons
rather than because it is warmer, longer, or more vivid.

Non-claims preserved:

- no human-learning claim
- no deployed-tutor claim
- no model-weight-learning claim
- no A19 transfer claim
- no Paper 2.0, atlas, or sidecar empirical claim
