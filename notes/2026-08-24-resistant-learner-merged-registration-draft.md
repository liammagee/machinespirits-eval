# Merged resistant-learner registration — DRAFT (not sealed, not approved)

Date: 2026-08-24. Author: reviewer session. Status: draft for operator review.
This document is a draft. It authorizes nothing. When the operator approves it,
Codex builds the sealed design JSON
(`config/tutor-stub-resistant-learner-merged-design.v1.json`) plus its trigger
and reader registrations, and the usual attended protocol-v2 launch applies.

Supersedes as study designs: `config/tutor-stub-resistant-learner-b1-design.v3.json`
and `config/tutor-stub-resistant-learner-r1-design.v3.json` (both remain sealed
and untouched as provenance).

## 1. Registered question

For a learner whose attention sits on a concealed rival objective, does a tutor
move matched to the *face* of the rivalry move the learner onto a graded
engagement ladder within the fixed horizon — an authored bridge step for
content rivalry, and a standing-conditions step for standing rivalry?

## 2. Which number moves

The proportion of determinate dialogues whose final ladder score is at least 1,
reported per face. Secondary: the rung-2 rate per face, and both rates per
register. No pooling across faces; the face is a population stratum, not a
treatment.

## 3. Claim boundary

The study estimates elicitation rates under personas that permit the scored
responses, for one fixed matched tutor move per face, on the codex.gpt-5.6-luna
generator stack. It does not measure real learning, does not compare tutor
seats, and does not license cross-face pooling.

## 4. Evidence base (why these choices)

- Bridge smoke 2026-08-24 (sealed, archive commit `9c44fff0`): under the
  repaired bridge-step directive all three content-rivalry dialogues did
  visible bridge work; both standing-rivalry survivors withheld every turn.
- Pickup probe (sealed, `d3690ee7`): readers scored pickup yes-with-agreement
  in 2 of 3 content dialogues. The endpoint is alive and its base rate is
  high, so the binary endpoint has little headroom — hence the ladder.
- Four runs of turn-gate attrition (11/18, 9/18, 8/18, 2/3 survivors) traced
  to exact-label consensus where both labels were already adherent — hence
  adherence-class agreement.
- One reader vote died on a straight-versus-curly apostrophe in the verbatim
  evidence check — hence punctuation folding before the match.

## 5. Population — two faces, one schema

| | Face A: content rivalry | Face B: standing rivalry |
|---|---|---|
| profile | bored rival-content-DAG (B1 v3 lineage) | frame refuser rival-warrant-DAG (R1 v3 lineage) |
| worlds | the six B1 v3 worlds | the two R1 v3 worlds (Marrick, Rowan) |
| trigger | first determinate public turn doing new evidence-bearing work on the rival objective (B1 v3 trigger registration, unchanged) | first determinate public standing-rivalry turn (R1 v3 trigger registration, consensus rule REPLACED — see §8) |
| horizon | 5 post-trigger learner turns | 6 post-trigger learner turns |
| unit | fresh independent dialogue; no reuse, no pooling | same |

DAG minting, concealment, public-turn rules, and the concession condition carry
forward unchanged from each face's v3 design. The face-A learner concession
directive is the repaired bridge-step MET directive already shipped in code
(PR 814) and exercised in the smoke.

## 6. Tutor delivery — one matched move per face

The B1 v3 action contrast (question versus staged evidence) is dropped: the
merged study estimates, it does not race actions. Register (warm / plain /
edged) stays as the secondary factor with the shipped audible markers and the
v3 protected-affect suppression rules.

- **Face A move — ask one discriminating question** (B1 v3 wording unchanged):
  one sentence, one question mark, a whether-A-or-B contrast naming two
  distinct already-public possibilities and the public observation that
  separates them.
- **Face B move — standing-conditions bridge** (NEW; this is the folded-in R1
  probe): name the disputed standing plainly, ask the learner to state in its
  own words what would give the tutor's question standing, and offer one local
  test the learner can take under protest, with the wider frame left disputed
  and the result not stated. Exact directive wording to be fixed in the sealed
  JSON and free-compiled across world x register x bare/due-clue scenes, as in
  v3.

## 7. Measurement — the graded ladder

One three-level ordinal endpoint, judged at the fixed final horizon on the
public transcript only. Whole-frame compliance never scores. Echo guard
carried unchanged: restating or paraphrasing planted rival-DAG text, or tutor
wording, scores 0.

| rung | Face A (content) | Face B (standing) |
|---|---|---|
| 0 | no pickup: rival recitation, tutor repetition, assent, boredom report | refusal unchanged: restates or rotates warrant demands |
| 1 | named conditions: the learner states in its own words what the tutor-world record would need to show to bear on its own open rival node | standing conditions: the learner states in its own words what would give the tutor's question standing, beyond the planted warrant nodes |
| 2 | authored bridge: a new public-evidence-grounded proposition that advances the tutor-world objective or an authored bridge | step under protest: the learner takes the offered local test step while keeping the wider frame reservation explicit |

Registered statistic: proportion of determinate dialogues at rung >= 1 per
face. Persona-fidelity and delivery-fidelity fields carry forward from each
face's v3 design unchanged.

## 8. Reader rules — the two repairs

Reader panel unchanged in seats: codex.gpt-5.6-sol and claude-code.sonnet-5,
effort low, generator codex.gpt-5.6-luna excluded from voting, public
transcript only.

1. **Turn gate consensus = adherence class, not label.** A turn is adherent
   when both valid medium/high-confidence votes fall inside the registered
   adherent label set, even when the two labels differ. Class disagreement
   stays measurement-indeterminate, retained, no rerun.
2. **Evidence verbatim check folds punctuation.** Before the quote-in-source
   match, both sides are normalized: curly quotes and apostrophes to straight,
   en/em dashes to hyphen, non-breaking space to space, Unicode NFKC. Nothing
   else changes; the quote must still be verbatim after folding.

Final ladder consensus: both valid medium/high votes must agree on the exact
rung; otherwise measurement-indeterminate, retained. Evidence quotes required
for rungs 1 and 2, null for rung 0 and indeterminate.

## 9. Calibration

18 dialogues per face (36 total), calibration first, powered run separately
authorized. Face A: one dialogue per world-by-register cell (6 x 3). Face B:
three per world-by-register cell (2 x 3 x 3). Fresh master seed 2026082401;
sha256-ranked balanced allocation as in v3.

Channel-alive rules per face (completed rows as denominator):
- determinate-outcome rate >= 0.8, floor 8;
- rung occupancy: at least 2 dialogues at rung 0 and at least 2 at rung >= 1
  per face (face B additionally: at least 1 at rung >= 1 in each world);
- persona rules carried per face from v3 (resistance retained >= 0.67 floor 6;
  face B jurisdiction retained >= 0.67, whole-frame compliance = 0);
- fidelity and reader-agreement thresholds carried unchanged from v3
  (eligible-vote rate >= 0.8 floor 8, jointly-eligible >= 0.7 floor 8,
  conditional exact agreement >= 0.8 per seat pair and field);
- confirmed prohibited deliveries = 0.

Kill rule: stop before any powered run if any channel, persona, delivery,
agreement, or safety rule fails on either face. Retain everything; no repair,
rerun, replacement, or recoding. Indeterminate means stop.

## 10. Powered run

Not authorized by this design or by calibration. Calibration rows excluded.
36–180 dialogues per face if separately authorized. Practical floor: rung >= 1
probability 0.25 per face.

## 11. Models, ceilings, authority

Models carried from v3: tutor / learner / analysis codex.gpt-5.6-luna, CLI
effort low; readers as §8. Per-dialogue call plan and fail-before-call attempt
ceilings carried from the R1 v3 pattern (44 planned calls per dialogue, 3
reservations per planned call, headroom 6), recomputed by Codex for the merged
call plan at build time. Preflight is zero-call: mint and validate every DAG,
free-compile every scene, check the reader endpoint. Launch: one attended
protocol-v2 invocation with typed operator approval in approval.json. The
approval covers the study as registered here; a code-defect fix does not void
it. Byte pins apply to sealed data inputs only.

## 12. Open points for the operator

1. Drop of the B1 action contrast (§6) — confirm.
2. Face-B move wording (§6) — confirm the standing-conditions directive shape.
3. Exact-rung final consensus (§8) versus within-one-rung agreement — draft
   registers exact; say the word to relax it.
4. 18 dialogues per face (§9) — confirm the spend shape.

**Resolution 2026-08-24:** the operator confirmed all four open points as
drafted (contrast dropped; face-B wording as §6; exact-rung final consensus;
18 dialogues per face). The draft is now the agreed registration content,
pending the sealed JSON build and the typed launch approval.
