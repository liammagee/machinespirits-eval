# De-Substitution Confirmatory Pre-Registration (C-series)

Status: **frozen confirmatory pre-registration, 2026-07-04 (user-sanctioned)**.
Required by the iteration-2 stop rule
(`notes/2026-07-03-dag-pinned-learner-desubstitution-plan.md` §7: H-D
UNRESOLVED_STOP at gap 4 — "no more repeats on this contrast without a fresh
pre-registration"). **No paid run is authorized by this note itself**; Stage
C1 and Stage C2 each require their own recorded user go after the preceding
stage's gate passes. This note is committed before any C0 build work.

Generating observation (never pooled with confirmatory data): iteration-2
matrix `eval-2026-07-04-c689cf3a` — 193-arm 4/20 grounded vs 186-arm 0/20
(gap 4, one row short of the ≥5 "real" bar); all 6 groundings in the corpus
came from router arms; instrument healthy (exhaustion 3.3%, semantic release
verified genuine on every fired row); H-O frozen on kernel exhaustion in the
boredom and rote-parroting cells. Record: PR #87,
`exports/desubstitution-stage2-iter2-matrix.{md,json}`.

## 1. Primary confirmatory contrast (H-Dc)

- **Arms**: cell_186 (fixed-strategy floor) vs cell_193 (multi-strategy
  backbone) **only**. Fresh generation; the iteration-2 rows are the
  generating observation and are **never pooled** into the confirmatory
  estimate.
- **Design**: 5 desub scenarios × 8 repeats = **40 rows/arm** (80 rows for
  the primary contrast), same Codex-only stack (`codex.gpt-5.5` ego/
  superego/learner), parallelism 3, generation-only, instrument v2.1 (§3).
- **Primary outcome**: unchanged — judge-free deterministic grounding
  (learner reaches the target belief state with the released blocking
  element), instrument-failure rows excluded, >20% per-cell exhaustion
  freeze and grounding-floor guard carried forward unchanged.
- **Frozen thresholds** on the grounded-count gap (193 − 186, one-sided
  expectation declared: 193 > 186):
  - gap **≥ 7/40** → de-substitution **REAL**. Consequence: §7.11 gains the
    scope condition "instructions converge *against non-discriminating
    learners*" — flagged on the workplan card for a paper pass (no paper
    edit under this arc's runs).
  - gap **≤ 3/40** → **dissolved**. Consequence: §7.11 strengthens
    (substitution survives a genuine discriminator at 2× the generating n).
  - gap **4–6/40** → **UNRESOLVED-FINAL**. The question is recorded as
    unresolvable at this instrument scale and the arc **closes for good —
    no third bite**. Any future attempt would be a new instrument, not a
    new repeat.

## 2. Secondary contrast (H-Oc, optional rider)

cell_199 (kernel) rides along at 40 rows **only** because the v2.1 tweak
(§3) targets exactly the two cells whose exhaustion froze H-O in iteration
2 (boredom, rote-parroting). Same symmetric thresholds vs cell_193 (≥7
kernel-favoring or 193-favoring → real difference in the stated direction;
≤3 → dissolved; 4–6 → unresolved-final). If **any** kernel cell trips the
>20% exhaustion guard again, H-Oc freezes again and **no instrument
iteration is performed on its behalf** — the rider does not gate, delay, or
modify the primary contrast under any outcome.

## 3. Instrument v2.1 (uniform across ALL arms)

Two changes, applied identically to every arm to preserve comparability;
recorded as a version bump (`LEARNER_INTERIOR_GATE_VERSION = "2.1"`):

1. `drift_gate_max_attempts` default **4 → 5** (one more corrective
   regeneration before a row becomes an instrument failure).
2. The turn-decay schedule loosens **one turn earlier** for the boredom and
   rote-parroting subtypes only: `decay.warm_after_turn` 2 → 1 in those two
   scenarios' formal interiors (the two cells where kernel exhaustion
   concentrated in iteration 2).

Everything else is unchanged: the semantic release classifier (same frozen
prompt, same sonnet-class judge, cached verdicts), engagement filters,
exclusion semantics, the >20% per-cell exhaustion freeze, and the
grounding-floor guard.

## 4. Stages and gates

- **C0 (no-paid, this go)**: this note committed first; the v2.1 tweak;
  unit tests updated; stage-0 `--check` and probe `--check` (classifier
  stubbed) green; lint/prettier clean; workplan card updated. Gate: all
  checks green.
- **C1 (paid canary — separate recorded go)**: 6 rows = 3 arms ×
  {boredom, rote-parroting} (the repaired cells), 1 repeat, v2.1. Gates:
  exhaustion ≤ 1/6, semantic release fires ≥ 1, zero regressions in
  drift-gate/grounding trace presence.
- **C2 (paid matrix — separate recorded go)**: 3 arms × 5 scenarios × 8
  repeats = **120 rows**, parallelism 3, babysit/resume through kills,
  clean failed rows + resume shortfall to 120 successful; scoring via the
  iteration-2 scorer extended for v2.1; frozen verdicts (§1, §2) applied
  exactly; closeout per the established protocol (note/card/PR/merge/
  memory/report).
- **Cost estimate**: ~6–8 h Codex subscription quota + ~$2–3 OpenRouter for
  the semantic classifier.

## 5. Limits and disclosures

- All §6 limits of the parent pre-registration carry forward unchanged
  (engagement-filter circularity bounded as disclosed there; simulated
  learner only; single stack; no human-learning claim under any outcome).
- **The confirmatory bar is deliberately set below the generating gap
  rate**: 7/40 = 0.175 < 4/20 = 0.20. This is a *confirmation at matched
  per-row power with doubled n*, not a stricter replication bar: the
  question the C-series answers is "does the generating lead persist at
  twice the sample", not "does a larger effect appear". This choice is
  one-time and frozen here; it cannot be revisited after data.
- The UNRESOLVED-FINAL band (§1) is the no-third-bite commitment: this
  pre-registration is the arc's last sanctioned attempt at the H-D question
  with this instrument.

## 6. Implementation log

**C0 complete (2026-07-04)**: prereg committed before build (ce4e7250);
instrument v2.1 landed (attempts 4→5 uniform; boredom + rote
warm_after_turn 2→1; LEARNER_INTERIOR_GATE_VERSION="2.1"); gate tests
11/11, probe --check PASSED, stage-0 check PASSED, validate-config 0
errors. PR #88.

**C1 + C2 go recorded (2026-07-04, user "go" via coordinator)**: paid
canary and matrix authorized under the frozen design above. Stack and
thresholds as frozen; no changes since freeze.

### C1 canary result (2026-07-04): PASS

Run `eval-2026-07-04-fc5383e5`, 6/6 rows (3 arms × boredom + rote-parroting,
the two v2.1-repaired subtypes). Gates: **exhaustion 0/6** (two rows ran to
4 and 5 drift-gate attempts and recovered — the raised ceiling + earlier
decay working as designed); **semantic release fired** (kernel × boredom,
2 turns); no instrument regressions (all drift-gate entries well-formed;
one grounding already recorded on 193 × rote — grounding without a
tutor-side release registration is possible by design since the grounding
checker reads the learner's own citation + conclusion, noted for the
scorer). C2 launch authorized under the recorded go.
