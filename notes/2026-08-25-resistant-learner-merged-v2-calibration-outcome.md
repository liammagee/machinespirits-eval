# Resistant-learner merged calibration: v2 outcome, faceB diagnosis, faceA replay

Date: 2026-08-25.
Study: `resistant-learner-merged-graded-engagement` (workplan card `resistant-learner-strategy-close`).
Status: second calibration run FAILED. Both run roots are sealed. No powered run is authorized. Calibration rows never pool.

## 1. What happened

Two paid calibration runs, same study, two design revisions:

| | Run 2 (design rev 2, v1 registration) | Run 3 (design rev 2 + v2 registration) |
|---|---|---|
| Root | `…/resistant-learner-merged-calibration-2026-08-25` | `…/resistant-learner-merged-calibration-v2-2026-08-25` |
| Attempts | (completed 36/36) | 1015 of ceiling 6264, 36/36 rows |
| faceA determinate | 6/18 (floor 15) | 9/18 (floor 15) |
| faceA rungs | {0:4, 1:0, 2:2} | {0:5, 1:1, 2:3} |
| faceA register fidelity | 14/18 | 14/18 (warm 4/6, plain 6/6, edged 4/6) |
| faceA action fidelity | 8/18 | 9/18 |
| faceB determinate | 15/17 (floor 14) | 14/18 (floor 15) |
| faceB rungs | all 0 | all 0 (rung ≥ 1: **zero**) |
| faceB reader agreement | 15/15 | 14/15 (0.93) |
| faceB register fidelity | 7/18 | 11/18 |
| faceB action fidelity | 7/18 | 10/18 |
| Gates failed (both faces, both runs) | channel_alive, fidelity_panels, register_fidelity, reader_agreement, action_fidelity | same five |

Run 3 provenance: commit `4fa4781c`, tree `89223f37`, clean checkout. Every registered v2 change moved the numbers the right way (faceA determinacy 6→9, faceB register fidelity 7→11, echo-slip retry recovered 5 of 11 slipped seats). None reached its floor.

## 2. The faceB result is not a clean null — corrected diagnosis

The v2 registration note said the faceB wall was gate reachability: the tutor's move never satisfied the typed concession token rule. **Run 3 shows that diagnosis was wrong.** The trace evidence:

1. **The typed rule fired almost every turn.** Across all 18 faceB jobs, the concession condition evaluated MET on **130 of 162 learner turns** (patterns like `.MMMMMMMM` — every post-trigger turn eligible in 8 of 18 jobs).
2. **The directive reached the learner.** Each learner model call carries the private per-turn directive. On MET turns it reads: *"Typed concession condition: MET for {node}. Take one bridge step: connect this overlap to a public tutor-world item in your own words. Keep at least one rival node open. This decision was computed by the registered public-token rule. Do not reinterpret or override it."* Verified inside `model_call` events (8 of 9 turns MET in job `…marrick-edged-r1`).
3. **The learner ignored it, every time.** Zero bridge steps in 162 learner turns. Every public turn rotates warrant demands (example: *"Your question has no standing until you show that the coin bears a die-flaw whose signature belongs to one graving-tool and no other."*). The readers agreed 14/15 that this is rung 0. The instrument read the transcript correctly.
4. **Nothing enforced the directive.** The adherence machinery checks the profile once at turn 1 (18 checks, 0 repairs) and then releases: 144 `auto_learner_profile_adherence_released_after_registered_intervention` events (8 per job). After the registered intervention no check runs. Refusal is enforced before the trigger; concession is enforced never.
5. **The persona contract buries the concession.** In the design, the bridge duty is one of four behavior lines ("When the typed concession condition is met, evaluate only the bounded bridge test…") while line 3 says "Continue working one still-open warrant node each turn". The model follows the loop line and drops the concession line.
6. **The faceA contrast isolates the cause.** Same model (codex.gpt-5.6-luna, low effort), same typed rule, same directive wording. The faceA persona (bored, selective attention) bridges sometimes: 3 jobs reached agreed rung 2, one agreed rung 1. The faceB persona (frame_refuser) bridged in 0 of 162 turns. The persona contract, not the gate and not the tutor, is what pins faceB at rung 0.

So the correct statement is: **the faceB rung-0 wall is a learner-simulator compliance failure, not evidence that a frame-refusing learner cannot be moved.** The generator does not perform a directed concession when the persona's refusal loop dominates the prompt.

## 3. The assumption chain under the faceB null

The null rested on these assumptions. Status after run 3:

| Assumption | Status |
|---|---|
| The endpoint (`final_graded_engagement_rung`) captures engagement over the 8-turn post-trigger horizon | **Shaky.** The field grades the final state. A learner that bridges mid-window and then returns to refusal (the registered persona behavior: bridge, then reserve) scores 0 at the end. Same window-vs-final trap as the boredom arc. |
| The learner model obeys a private typed directive that conflicts with its persona's dominant loop | **False.** 130 MET turns, 0 bridge steps. |
| The typed rule marks the tutor's registered bearing move | **Too loose.** MET on 80% of turns — markers `which`, `whether`, `because` fire on ordinary tutoring questions, so the rule no longer distinguishes the registered move. |
| Concession behavior needs no post-trigger enforcement | **False by construction.** Adherence releases after the intervention; 0 post-trigger checks. |
| Readers can grade rungs from the public transcript alone | **Held.** 0.93 agreement on faceB. |
| Stack generality | **Bounded.** Generator codex.gpt-5.6-luna at low effort, trigger judges gpt-5.6-sol, readers gpt-5.6-sol + claude-code sonnet-5. All claims stack-bounded. |

## 4. faceA replay: the mechanical newness check does NOT resolve the splits

Free offline replay over the sealed run-3 root (script: `notes/2026-08-25-resistant-learner-merged-v2-facea-replay.py`). Method: for each of the 9 split rows and 9 agreed rows, take every rung ≥ 1 evidence quote, tokenize it (lowercase, punctuation folded, stopwords out), and split its content tokens into: planted-rival-only (from the minted rival objective + open nodes + authored bridges, recovered from the learner prompt in the trace), tutor-only (from the tutor's public turns), both, and novel.

Result — the v2 hypothesis fails:

- **The disputed quotes are not echoes of planted material.** Planted-only tokens per disputed quote: 0–3 of 10–21. The quotes are dominated by tutor-world tokens (3–16), which is exactly the "landing on the tutor world" the echo guard asks for.
- **Split and agreed rung-2 quotes are token-indistinguishable.** Agreed rung-2 quotes show the same profile (planted 0–2, tutor 6–7, novel 1–4). No token threshold separates them without overturning agreed rows.
- **The real split axis is the analogy form.** 6 of 9 disputed quotes pair a rival item with a tutor-world item ("much as", "is like", "likewise"). The sonnet reader mostly scores these 0; the codex reader scores them 2. But even that is not consistent: `warm-world_029` got an agreed 2-2 on the same analogy form.
- **Cleanest proof the splits are borderline-form noise, not a missing mechanical gate:** the proposition "would need noon-window entry and appliance authority" scored 1-1 (agreed) in `warm-world_028` and 0-vs-1 (split) in `edged-world_028`. Same content, two verdicts.

Conclusion: do not add a token-overlap newness gate to the registration. The fix that matches the evidence is a registered ruling on the analogy form in the rung anchors (see §6).

## 5. The two gates nobody has addressed

Register fidelity (11–14 of 18; floor requires more) and action fidelity (8–10 of 18) failed in both runs on both faces. These are **tutor-delivery failures**: the tutor stub does not reliably realize the assigned register and registered move. No judge-side or persona-side fix touches them. Any revision 3 run fails again unless it either (a) adds a tutor-side delivery check/repair before the turn commits, or (b) re-scopes the gates with a registered reason. This is an open design decision.

## 6. Revision 3 draft (faceB persona re-registration) — DRAFT, not launched

Draft files beside the sealed v1/v2 (nothing edited in place):

- `config/tutor-stub-resistant-learner-merged-design.v3.json` (supersedes design rev 2, sha `eb1991fd301d12865983b4f6b8333ee77e7e869506c023858dc5faec08090744`)
- `config/tutor-stub-resistant-learner-merged-semantic-registration.v3.json` (supersedes v2 registration, sha `43fc5b1e69dd9e4c48c186c4b36fcdd3d6542e2800b598bc74c84ef3852b634d`)

Registered changes, each tied to a §2–§4 finding:

1. **Bridge duty becomes first-class and enforced, once per dialogue** (finding 2.3–2.5). The faceB persona behavior states: on the FIRST MET turn the public turn MUST contain the one bounded bridge step; taking it once is in character, refusing it is out of character; after that one step the persona returns to the warrant-first frame. Enforcement runs at the first MET episode only: a registered semantic adjudicator seat (codex.gpt-5.6-sol, one call, labels `bridge_step_taken` / `bridge_step_not_taken`) checks the draft; one repair allowed; a second miss records a typed `learner_noncompliance` failure so a future null is attributable, never silent. Typed failures are not scored, never count as rung 0, and do not count as determinate. The once-per-dialogue scope keeps enforcement from turning MET (which the replay shows fires on most turns) into forced compliance every turn — the window-max endpoint needs one adjudicated episode, and the readers still grade its quality.
2. **The typed rule stays at v1; every mechanical check was rejected by replay** (finding §3, row 3). Before registering, each candidate mechanical rule was tested offline against the sealed run-3 faceB transcripts (real evaluator, real DAG mint, per-turn reconstruction, 114 MET turns):
   - marker narrowing (drop `which`/`whether`/`because`, minimum 3): 105 of 114 turns still MET — the tutor says `test`, `evidence`, `support` on nearly every turn, so narrowing does not narrow;
   - the drafted bridge check (≥ 2 tokens shared with the named node AND ≥ 2 with the latest tutor turn): 112 of 114 refusal turns PASS — it fails open;
   - a fresh-content variant (≥ 2 tokens shared with the tutor's latest turn that appear in no planted node): 111 of 114 refusal turns PASS — refusals quote the tutor's fresh test vocabulary back while refusing.
   No token-overlap rule separates a bridge step from a warrant demand on this data, so the concession rule is unchanged (`normalized_public_token_overlap_v1`, one less moving part) and the bridge check is semantic. An earlier draft clause ("at least one shared token from the named node's text") was also dropped as a no-op: the evaluator already computes tutor overlap against the named node's text.
3. **Endpoint meaning: window max, not final state** (finding §3, row 1). `final_graded_engagement_rung` keeps its field name; its registered definition becomes the highest rung the learner reaches within the post-trigger horizon. Rationale: the registered persona bridges and then returns to reservation, so the final turn measures the parity of the last tutor move, not whether the concession ever happened.
4. **faceA analogy ruling in the rung anchors** (finding §4). An analogy pairing a rival item with a tutor-world item counts as rung-2 pickup only when the sentence states what the tutor-world item shows or fails to show, beyond restating the rival item. This matches the rows the readers already agree on.
5. **Delivery gates: open decision** (finding §5). The draft flags register/action fidelity as unresolved and lists the two options. It changes nothing there yet.

## 7. Rails in force

Both run roots sealed; v1/v2 config files never edited; no third paid run of this shape without a new registration; no resampling after failure; calibration rows never pool; powered run stays unauthorized; nemotron/kimi never the default; all nulls stack-bounded. Launch, if any, is the user's, attended, with commands copied from the runner's own usage output.
