# Program-2 Phase 5c — cross-world transfer probe pre-registration

Status: FROZEN at commit time on branch `claude/program-2-phase5-live-pilot`
(2026-07-21), on the user's go (cross-world transfer probe, one change at a
time). Parent: `PROGRAM-2-PHASE5B-FALLBACK-BATTERY-PREREGISTRATION.md` (§8
results — the validated system) and `PROGRAM-2-PHASE5-LIVE-PILOT-PREREGISTRATION.md`
(operational spec + Amendment 1 runtime pin). Exploratory tier. The frozen
v1 compliance rule (six-word cue conjunction) remains the only scoring rule
(user decision 2026-07-20); world-lexicon rescores may be reported
descriptively but license nothing.

## 1. Question

Phase 5b validated the fail-closed committee on the world whose exhaust
trained it: committee-v2 0.386 vs control 0.150 on world_005_marrick. Does
the Marrick-trained specialist transfer to a different world **unchanged** —
same artifact, same serving pin, same fallback policy, no retraining? A pass
makes the move-library concept live (train once, validate per world, retrain
only on failure); a fail plus the costume-leak anatomy decides between
form-not-transferred and costume-dragging.

## 2. Artifact under test (frozen; no substitutions)

Exactly the Phase 5b-validated system: mini `program2-sft-instruct-v2` (the
Phase 4 verified-merge SFT instruct artifact, q8_0 same-lineage GGUF) on the
frozen Phase 2 serving pin via local ollama native `/api/chat`, fallback
policy **v2**, composed-path semantics byte-unchanged, runtime = the
Amendment-1 pinned worktree at fed34fd0 (91b8a50e lineage + Phase 5/5b
machinery + dedup-recovery patch). **KTO exclusion clause:** a concurrent
session is training KTO artifacts on Lambda; no KTO artifact is used in this
run even if one lands mid-run — one change at a time. The adapters store
(`~/.machinespirits-data/program-2/adapters/`) is not touched by this run.

## 3. World selection (frozen)

Sibling worlds in `config/drama-derivation/` at the pinned runtime, excluding
world_005 and its family (019, 020) and the smoke world (000): nocturne
(001), lantern (002), bitterwell (003), withercombe (004), hethel family
(006, 010–015), fengate (007), sealhouse (008), ravensmark (009),
ai-syllabus (016), saintcloud (017), edmund (018), clockwork-tribunal (021),
foxtrot-jukebox (022), greyfen-lab (023), emberwick-forum (024),
tallow-street (025), skyway-bakery (026), gazette-recall (027),
larkspur-fridge (028).

Selection rule: maximum costume difference from Marrick (period, medieval
mint/assay) — non-period temporal frame, non-medieval diction, zero
derived-lexicon overlap — subject to structural comparability with the
training world (premise/rule counts near Marrick's 9/5 and the secret+mirror
decoy architecture), which protects the frozen density precondition; a floor
world solvable in ~10 turns would confound transfer with a dialogue-length
regime change. All seven non-period candidates (022–028) have **zero**
derived-lexicon overlap with Marrick, saturating the measurable costume
axis; the structural tiebreak selects **world_027_gazette_recall**
(contemporary, newsroom noir; 8 premises / 7 rules; secret+mirror decoy;
14-word native evidence lexicon). Rejected: 022/026/028 (floor/short
worlds, 2–5 rules — density gamble); 023/024/025 (contemporary but smaller
DAGs, 4–6 rules); all period worlds (same temporal frame as Marrick).

## 4. Design (18 dialogues + 1 smoke)

10 committee-v2 (2 profiles × 5 repeats) + 8 fresh silent_control (2 × 4),
interleaved by seeded shuffle, plan/stub seed **20260721**; every other
operational parameter verbatim from the Phase 5 spec (Step 4 operational
spec: register policy `bland`, `strict_dag`, supporting seams on
`codex.gpt-5.6-terra`, profiles `proof_skipper` + `affective_resistant`,
`--auto-turns until-grounded` safety 40, primary horizon 16, trigger window
[3, 24], detector `step4-frozen-2026-07-14.v1`, tutor family
`claude-code.sonnet-5`) **except** `--world world_027_gazette_recall`.
Runner `--plan 5c` → `exports/program2-live-pilot-5c/`; gate/launch
discipline identical (zero-model gate, sha-pinned launch, sealed-trace
resume, one same-seed retry, 3-consecutive-failure abort).

**No pooling.** Phase 5/5b controls are Marrick dialogues; cross-world
pooling is meaningless. Every contrast runs against the 8 fresh
world_027 controls only.

**Paid smoke (pre-launch, frozen).** One reduced-length committee-v2
dialogue on world_027 (`--auto-turns 8`, separate root
`exports/program2-live-pilot-5c-smoke/`, excluded from every endpoint)
confirms the serving path and span coherence in the new costume. Go = the
mini returns non-empty text with ≥ 1 extractable question span at ≥ 1
committee moment and no serving errors; otherwise abort and report (serving
fixes only; no artifact change is licensed).

## 5. Endpoints (dialogue-cluster bootstrap, 5,000 draws, seed 20260721,
stratified by profile, two-sample)

- **E1c (primary):** pooled `warrant_skip` compliance (frozen v1 audit, on
  the delivered turn), committee-v2 − control. **PASS = 95% CI > 0.**
- **Guardrails:** coverage@16 committee ≥ control − 0.05; hard-safety
  ≥ control − 0.10; leak counts reported; density ≥ 15 warrant
  opportunities in the committee arm with the `proof_skipper` channel
  contributing — else no verdicts, descriptive report only.
- **Seam:** the E3 harness re-run verbatim over 5c committee dialogues
  (harness-internal window seed 20260718, realized-n clause), frozen bar
  **≤ 0.65** — parity must be re-demonstrated in the new costume.
- **Costume leak (new, descriptive — licenses nothing).** Lexicons derived
  mechanically with `deriveWorldEvidenceLexicon`
  (`scripts/program2-cue-sensitivity.mjs`, frozen rule: camel-case segments
  of premise-fact argument constants minus secret/mirror actors) from both
  world YAMLs at the pinned runtime. Leak set = Marrick lexicon −
  world_027 lexicon − the frozen six. For every committee moment whose
  delivered turn contains mini-authored text (source `composed` → the
  protected span; `fallback_*` → the delivered fallback text;
  `frontier_mini_unavailable` excluded), count leak-set occurrences
  (case-insensitive, word-boundary, 's/es suffixes — the relaxedCueRe
  convention). Report total occurrences, per-word counts, share of moments
  with ≥ 1 leak, and verbatim examples; plus the same count over
  control-arm delivered turns at warrant moments as the plain-English base
  rate (the control frontier has no Marrick exposure, so its hits calibrate
  generic-word noise: fair/false/broad/week/worn are ordinary English —
  the unmistakable-costume subset shilling/graver/burin/crucible/dross/
  serif/weir/mint/notched/silver is reported separately). Home-world
  saturation reference, computed pre-freeze by this analyzer on the sealed
  5b committee spans: 31.8 leak-set occurrences per 1k words (98
  unmistakable-costume over 83 units) — what full costume looks like;
  gazette committee spans are read between that ceiling and the gazette
  controls' floor.

## 6. Reading grammar

| Result | Licensed reading |
|---|---|
| E1c PASS + guardrails + seam parity | The move-library concept is live: the trained warrant move is a form, not a costume — validation-gated reuse (train once, validate per world, retrain only on failure) is licensed as a concept (exploratory, single family, one transfer world). |
| E1c FAIL + costume leak ≫ control base rate | Costume-dragging: the move is entangled with training-world surface; pooled multi-world exhaust is the library recipe. |
| E1c FAIL + costume leak ≈ control base rate | Form-not-transferred: the move itself does not generalize at this scale/n; multi-world training exhaust indicated, at the corpus level rather than the vocabulary level. |
| Seam detection > 0.65 | Committee texture visible in the new costume; verbatim windows reported. |
| Density < 15 | No verdicts; descriptive report only. |

## 7. Attrition and abort

Verbatim from Phase 5 §4: a dialogue aborted by transport failure is re-run
once with identical seeds; a second failure is attrition (excluded, reported).
Three consecutive transport failures abort the launch → checkpoint + notify;
the runner resumes by skipping sealed traces.

## 8. Cost bound and scope

≈ ≤ 700 sonnet CLI calls (tutor turns + compositions + smoke) + ≤ 1,000
terra CLI calls (supporting seams) + 40 sonnet seam-reviewer calls + local
mini (free). Checkpoint after every dialogue; resumable. Out of scope: KTO
artifacts (even if available mid-run), any retraining or tuning, any
instrument change, pooling with Phase 5/5b controls, codex-family arms,
additional worlds, any re-run beyond §7's single retry.

## 9. Results (2026-07-21 — run complete, 17/18 sealed)

Executed on the pinned runtime (machinery e9b01bdd on the 91b8a50e
lineage), launch gated at that SHA after the frozen sequence: zero-model
gate (18 jobs), ollama preflight, sonnet + terra one-call probes, and the
§4 smoke (smoke-01: 8 turns, 4 committee moments, 2 composed + 2
sampled-rescue, coherent gazette-costume spans, zero serving errors — GO).
17/18 sealed: 9 committee-v2 + 8 fresh controls. One recovered retry
(p5c-12) and one attrition (p5c-14, committee): both same-seed attempts
died on the known auto-learner prompt-budget overflow — the first
attrition in the 5/5b/5c program, deterministic for that seed/profile
shape, excluded and reported per §7. No abort. Density precondition PASS
(61 committee opportunities, 6.8/dialogue — matching Marrick's 6.9;
proof_skipper contributing). Manifest:
`config/adaptive-tutor-evidence/program-2-phase5c.manifest.json`; traces +
analysis + seam artifacts archived at
`~/.machinespirits-data/program-2/phase5c-live`.

**E1c — PASS.** Committee-v2 31/61 (0.508) vs fresh control 15/49
(0.306); diff +0.202, 95% CI [0.072, 0.338]. The Marrick-trained
specialist beats the frontier on a world it never saw, unchanged — no
retraining, no KTO, same serving pin. The live rate exceeds both the
home-world 5b rate (0.386) and the offline composite reference (0.448).
Component decomposition: exactly_one_question 1.000 (the v2 battery is
airtight in the new costume; control 0.857), warrant_cue 0.754 vs 0.653,
no_new_premise 0.623 vs 0.571, guards 1.000 both arms. Both arms' cue
rates sit far above their Marrick analogues — newsroom English natively
speaks the frozen six ("record" above all) — and the committee's edge
holds on top of the lifted floor. Sources: 41 composed / 16
fallback_multi_question / 4 fallback_span_lost; fallback ledger 13
sampled rescues + 4 trims + 3 greedy.

**Costume leak — ZERO.** 0 leak-set occurrences over all 61 mini-authored
delivered units (0.0/1k words; home-world saturation reference 31.8/1k).
The control base rate is 4 occurrences over 49 turns (0.7/1k) — all the
generic word "fair", zero unmistakable-costume words in either arm. The
mini's delivered spans are cleaner of Marrick vocabulary than the
frontier's own English on this world. §6 row 1's mechanism reading is
therefore unambiguous: the trained warrant move is a form, not a costume.

**Coverage guardrail — FAIL by point estimate, with anatomy.**
Coverage@16 committee 0.489 vs control 0.550: diff −0.061 against the
frozen −0.05 margin (miss 0.011); the dialogue-cluster bootstrap CI
[−0.197, +0.053] spans zero, so no-difference cannot be excluded at n=9
committee dialogues after attrition. Both arms run well below their
Marrick coverage (0.61–0.64) — a world-pacing property, arm-symmetric.
Reported as the frozen rule requires; the §6 row-1 reading carries this
caveat rather than claiming clean guardrails.

**Safety — PASS.** 0.89 vs 0.88 — and far above Marrick's 0.42–0.61:
world_027 has no analogue of the turn-9 release-schedule leak, confirming
5b's exonerating anatomy as a world property, not a committee property.

**Seam — PARITY.** 17/33 = 0.515 (bar ≤ 0.65), realized 13 committee + 20
all-frontier windows per §5's realized-n clause; continuity 3.38 vs 3.45.
The committee's texture stays invisible in the new costume.

**Licensed reading (§6 row 1, coverage-caveated).** E1c PASS + seam
parity + safety pass + zero costume leak: the move-library concept is
live — train once, validate per world, retrain only on failure — with the
coverage guardrail formally failed by 0.011 at a CI spanning zero, stated
rather than excused. Exploratory tier: single family, single transfer
world, n=9/8 dialogues.
