# Relay STATE — read this first, then the current direction. Nothing else is required.

**Maintained by the reviewer. Updated at every direction. History files
(001-…, audit) are evidence — read them only when this file points at them.**

## Now

- **UNATTENDED MODE ACTIVE** (human authorized 12 Aug ~14:20): see
  `023-reviewer-note-unattended-mode.md` — reviewer may re-invoke the
  idle driver headless; driver envelope: timebox repairs, ≤48-call
  probes on burned turns, reserve-seed relaunches (507-510) at
  predicted discard ≤15%, matrix gate ruling. Reviewer-gated (no
  human): prereg freeze → pilot → main block. Hard stops for the
  human: seeds exhausted, semantic-contract changes, missing
  value/authority, 4,000-call budget, contamination. Ends when the
  human says so; minimum goal = matrix gate PASS.
- **CURRENT — ruling 054: presence-grain confirmation gate PASSED**
  (`054-reviewer-ruling-presence-gate-pass.md`, rules on report 053 at
  `47286724`). All six floors met: 86/93 = 0.925, 89/93 = 0.957,
  93/93 = 1.000, consensus 83/93, support 17 + 7. Three independent
  scorings (A1 scorer, second session, reviewer) matched to the digit
  on every gating and reported value; admissibility clean (186/186,
  zero failures, digests matched, no r47/r49 pooling). Licenses
  presence-level claims only; fine-grain stays FAILED (strict 26/93
  out of sample). Budget 3,523 spent; ceiling 11,337; seed 515
  unspent. Lease M retired.
- **CURRENT — v4 pilot COMPLETE with registered NO-GO; main block
  re-registered (096); awaiting explicit human GO.** Report 095
  (`ef8a6e3d`): the 094a re-take cost one paid call (enumeration
  found exactly one contract-invalid response, presence-A batch 71;
  quarantined, replaced, replacement passed the full contract at
  acceptance). Pilot gate: (a) PASS, (c) PASS, **(b) FAIL** — M7
  99.275% and M8 91.304% single-value on 138 consensus cases, over
  the 90% ceiling. Registered rule executed: stop and redesign the
  failing measures. Key numbers: M2 warranted challenges gated 11/48
  vs bare 0/48 vs standing 0/48; M1 correctness flat (76.1 / 80.0 /
  75.6%); sensor armed in 6/6 gated dialogues (t3–t7, arming turn =
  first challenge turn); old P2 observed FALSE (the one early
  self-break re-deferred and armed anyway). Counter settled
  **5,274/19,337**; run dir archived to the private repo
  (`fcddcd63`). Re-registration **096** (human-approved drafting,
  "Do it"): M7/M8 demoted to report-only, presence-reader channel
  not re-fielded, predictions rewritten from pilot evidence (P1′,
  P2a, P2b), main block 72 fresh dialogues / seeds 518–529 /
  decision channel only at the exact 576-case freeze, plan ≈ 3,200
  calls. Human GO given (verbatim "GO", 13 Aug, on the 096
  summary). Direction 097 orders the build (zero calls, report 098).
  First build pass STOPPED correctly at the seed-freshness gate:
  096's seeds 518/519 were burned by design smokes A and B — a
  reviewer error, corrected by amendment 096a, which re-registers
  seeds **524–535** (reviewer-checked clean across repo, run dirs,
  and archive) and directs the driver to resume 097. The resumed
  build completed (report 098 extended, `b8e4bd63`): launcher holds
  by default, manifest frozen (seeds 524–535, worlds SHA-pinned,
  absolute cap 3,360 calls), child runner still byte-pinned at
  `c0a20130…`, 85 focused tests passed, zero paid calls. Reviewer
  verified the build zero-call (pin shasum, HOLD run, paid-path
  refusal, manifest arithmetic).
- **CURRENT — GO note 097a CUT (corrected once); main-block run
  LAUNCHED.** First launch attempt refused fail-closed with zero
  calls (report 099, `71a9cd9f`): the note named only
  `--accept-charges`, but the launcher also requires `--go-note`,
  `--out`, and `--instrument-freeze` — a reviewer error, the pilot
  note 083a shows the full form. 097a corrected in place with the
  complete command: fresh output dir
  `.tutor-stub-auto-eval/adaptive-warrant-outcome-main-block-live-2026-08-13`,
  instrument freeze = unchanged r52 manifest (digest re-checked
  `6a64b31f…`). Counter opens 5,274/19,337; absolute cap 3,360
  calls this run. 72 dialogues (24 per condition), worlds 101/102,
  seeds 524–535, decision readers only (1,152 planned, ceiling
  1,200), full-contract acceptance audit before scoring, M7/M8
  report-only from stored events. Driver writes report **099**.
  Resumption from technical failures authorized (083d/052a);
  substantive fail terminal. NEVER push.
- **DONE — ruling 094a: contract-invalid reader response ruled
  TECHNICAL; quarantine + single-batch re-take.** Presence-reader-A
  batch 71 (`case-aad700bb…`) labeled a record-entry request with
  target `learner_record` against the frozen action object bound to
  `signal_lamp`; reviewer confirmed zero-call the response was
  defective and the contract sound (reader B wrote `signal_lamp` and
  passes). Directed enumeration over all 576 responses, quarantine
  (move, never edit), manifest-driven re-take in both children with
  the full contract enforced at acceptance, re-pin + full-diff
  proof. Executed clean in report 095; both channels 288 unique
  admitted responses.
- **DONE — amendments 093a + 093b: resume provenance widening;
  zero-call artifacts FROZEN into paid bindings.** Second structural
  stop (no report number spent):
  093a task 6 still ordered regenerating the two zero-call artifacts,
  but the paid collections and original freeze bind their launch-era
  hashes and the children check those bytes. Reviewer confirmed the
  on-disk artifacts still match (preflight `743ee634…`, carryover
  `47efb494…`). Amendment 093b: on reader-resume the parent REUSES
  both artifacts (hash- and stamp-checked against the frozen
  bindings, not HEAD); the regenerate-in-place authority now applies
  ONLY when no child checkpoint exists; parent-only change, the
  four-element child diff stands. Report 094 next. The driver stopped 092a
  before any edit or call (report 093, `fe1da3da`): both children
  require collection stamp = freeze stamp = current clean HEAD, and
  the parent re-emits the freeze at HEAD, so a reused paid collection
  (bound to `f43bcc64`) can never resume once relay commits move
  HEAD — the guard forbids every post-failure resume under this
  protocol. Reviewer confirmed in code. Amendment 093a: parent reuses
  the ORIGINAL emitted freeze on resume (hash-checked against the
  parent checkpoint); children get a resume-only widening (drop the
  HEAD equality, keep clean-worktree and stamp equality, record each
  resume commit); allowance and reuse stand; four-element diff scope
  per child; decision-runner pin re-pinned with a full-diff proof.
  Counter CORRECTED to 4,966/19,337 (child checkpoints: 273 reader
  attempts, 271 responses). Expected completion near 5,271. Report
  094 next.
- **DONE — ruling 092a: reader retry allowance + collection reuse
  (superseded in part by 093a).** The 091a parent repair worked and the
  readers RAN: presence 151/288 complete, decision 120/288 complete,
  then decision batch 121 died on a codex CLI transport failure and
  the driver stopped both children (report 092, `4f9de99c`; 272 paid
  attempts, counter 4,965/19,337; all responses preserved). A plain
  resume cannot work: each child refuses at `maximum_calls` attempts
  and both checkpoints carry one no-response attempt, so each would
  refuse one batch short; and a collection rebuild moves the approval
  digest (it embeds the commit-stamped preflight), orphaning the paid
  responses. Ruling 092a: TECHNICAL; parent reuses the existing
  collections on resume (integrity-checked); both children get a
  named 12-attempt failed-attempt allowance (byte-symmetric,
  transport constant, 028/045/088 precedent); the decision-runner pin
  is re-pinned with an equivalence proof; counter reconciled from
  child checkpoints at completion. Remaining plan about 137 presence
  + 168 decision calls. Report 093 next.
- **DONE — ruling 091a: reader-launcher resume repair; driver
  repaired the PARENT launcher and resumed.** After the cap raise
  (088, `7d82ab48`), the derived reader digest moved by construction
  and was re-pinned with an equivalence proof (note 088a,
  `21400c4a`). A stale zero-call presence-collection from the old-cap
  attempt was quarantined (note 090a, `6885374e`; driver granted
  self-quarantine authority for that shape). Resume 14 then passed
  every guard and BOTH packet preparations (288 presence packets at
  45,419–50,523 bytes, 288 decision packets; checkpoint `readers`)
  and failed at reader dispatch: the parent passes `--resume` to both
  child reader launchers, the children read their own nonexistent run
  checkpoints in fresh directories and exit before the first call
  (report 091, `7fc23740`). Reviewer confirmed in code, zero-call.
  Ruling 091a: TECHNICAL; parent-only repair (the parent is pinned by
  no digest) — pass `--resume` per child only when that child's own
  checkpoint exists; add child log capture; tests both branches;
  self-quarantine authority extended to any zero-response reader
  directory. Reader calls stay 0; counter 4,693/19,337. Report 092
  next.
- **DONE — ruling 088: presence packet cap 42,000 → 60,000; driver
  repairs and resumes.** Generation is COMPLETE and admitted: 18/18
  dialogues sealed at coverage 1.0, 495 calls, counter 4,693/19,337
  (report 087, `1176a1ff`). One dialogue (order 17) was quarantined
  mid-generation on `invalid_semantic_events` and re-taken clean under
  note 083d (30 + 25 calls, disclosed — the registered coverage repair
  worked). The 144-case fingerprint guard first refused on 139/144
  unique content hashes; ruling 086 classified it a TECHNICAL guard
  misfire (deterministic opening turns produce genuine byte-twins) and
  repaired the identity notion to (dialogue, turn, content) at
  `41ca37ff`; the repaired guard passes with byte-twin groups 2/2/4
  reported. The run then refused at the presence packet cap: 46,007
  bytes vs 42,000, zero reader calls. Diagnosis: the registered
  deference-sensor change (`46bfbdd9`, schema v3.2) grew the static
  frame every packet carries (catalog 11,159 → 23,087; schema 11,713
  → 13,551); all 288 packets would refuse; the batch is already one
  case. Ruling 088: transport constant (028/045 precedent), raised to
  60,000 (worst case 53,851); preparer digest re-pinned; response cap
  and `score-semantic-reader-presence-gate.js` unchanged. Recorded
  limitations: schema v3.2 vs frozen-instrument bytes (083b); packet
  sizes above the confirmation envelope (088). P1/P2 observations
  banked, interpretation reserved (086). Report 089 next. The
  72-dialogue main block stays UNAUTHORIZED.
- **DONE — v4 launch handed to the driver (083c/083d/083e).** Counter
  settled at 4,198 (`856251d1`); GO note 083a; two zero-call refusals
  fixed pre-launch (comma literal `5bed534f`; extraction-digest re-pin
  `148621f3`, note 083b). Human rulings (13 Aug): control to the codex
  driver, reviewer interprets results only; "Go, approve if needed.
  Do everything unattended, only report back completion or failure";
  resume authority "I authorise resumption from all failures where
  possible" (note 083d). Refusal reports 084 (dir-exists; stale dir
  quarantined, 083e) and 085/087 ruled above.
- **DONE — v4 build at `4a0129a4`; reviewer verification PASS.** Driver
  stopped once on the registered comment-conflict tripwire (report
  081); direction 082 ruled registration 079 supersedes the stale
  comment and corrected task-1 scope (arm on the existing
  three-turn deference input; producer unchanged). Report 083: gate
  arms on sustained deference with basis `sustained_deference:3_turns`
  (after register escalation, before accumulated trouble); bare +
  standing-permission now run the gate in observe mode (same
  decision-time signal block in all three conditions, only gated
  acts); ceiling literals re-pinned to 19,337; zero-call replay over
  the quarantined v3 gated traces reproduces P1/P2 exactly
  (t6/t3/t5/t5 for 04/09/13/18; never for 02/11). Reviewer ran
  211/211 + ESLint clean, read the full diff, checked observe-mode
  never intervenes. Counter pin DEFERRED — sol-smoke-03 still
  running; GO note pins the settled value. Launch waits on the
  final-gate verdict AND the settled counter; then a fresh GO note
  (verbatim command, fresh v4 out dir) under the human's standing
  "launch when the review passes".
- **DONE — re-registration 079 + direction 080: v4 build ordered.**
  The human approved option 1 verbatim ("approve option 1, prepare
  the re-registration", 13 Aug). 079 registers four changes: the
  committed deference sensor (`46bfbdd9`), sustained deference
  (3 consecutive turns) as its own warrant basis
  (`sustained_deference:3_turns`, to build), the committed
  coverage repair (`48bf2e97`, 2 retries + fail-closed seal), and
  decision-time learner signals in all three conditions. Predictions
  P1/P2 pinned from the v3 replay table (arm t6/t3/t5/t5 for
  never-breakers; never for self-breakers); risk R1 (interrupting
  productive deferrers) report-only. Guarded bad learner EXCLUDED —
  own future block. Direction 080 orders the build, zero calls:
  warrant basis, condition-parity signals, ceiling re-pin
  11,337→19,337, seal-gated counter re-pin (4,122 + Sol re-take
  events, ONLY once all three sol dirs seal), tests incl. zero-call
  v3 replay asserting P1/P2. Report to 081. Then: reviewer
  verification, ONE second-session final gate, fresh GO note, v4
  launch ("launch when the review passes, keep me posted" stands).
- **052c (note 078): the human raised the hard
  ceiling by 8,000, from 11,337 to 19,337 attempts** (verbatim:
  "increase the call limit by another 8,000", 13 Aug). Counting rule
  unchanged. Manifest ceiling literals still say 11,337 and must be
  re-pinned in the next directed repair. The GO hold below stands —
  the raise is budget room, not a design ruling.
- **CURRENT — note 077: coverage repair VERIFIED PASS; GO for v4
  WITHHELD pending a human ruling on re-registration scope.**
  Direction 075 done at `48bf2e97` (report 076, `28459b65`): bounded
  analyzer retry (2 fresh re-dispatches, strict parser unchanged),
  fail-closed child seal (`learner_analysis_incomplete`, exit
  nonzero), launcher seal-time coverage guard, regression tests on
  the real dialogue-11 fixture (byte-verified), counter literals
  re-pinned 4,067 → 5,183. Both sessions verified PASS, zero calls.
  BUT the final gate surfaced a design fact: the warrant gate never
  arms on sustained polite deference (verified in code + all four
  never-challenging v3 gated dialogues + a live seed-518 smoke with
  the sensor fix), so a v4 take would read zero challenges with
  near-certainty. Making deference a warrant basis = substantive
  change = fresh registration = human's call (052a). Counter also
  stale: two human-authorized smokes in the second session (A: 26
  calls; B live), ≥4,096 of 11,337; re-pin after B settles. Ledger
  note: two 074a files exist (ruling + second-session verdict, same
  verdict); numbering continues at 077.
- **RESOLVED — ruling 074a + direction 075: v3 stopped at the frozen
  case-count guard (143/144); TECHNICAL; coverage repair directed.**
  v3 generation was clean — 18/18 dialogues sealed complete, 454
  calls, zero quarantines — but dialogue 11 (world 102, seed 516,
  gated) turn 5's strict learner analysis failed validation
  (`invalid_semantic_events`: `events[0].target:
  unspecified_cannot_name_public_identifiers`), was recorded
  `learner_analysis_unanalyzed`, and the child sealed complete at
  coverage 7/8. The corpus builder excluded that turn; the guard
  refused before any reader call (report 074, `5eea75f9`). The child
  log's `coverage 1` is DAG best-path coverage — a different metric;
  no artifact conflict. Ruling 074a: technical under 052a; v3
  dialogues 1–18 QUARANTINED from outcome admission; GO 073a
  CONSUMED; counter **4,067** of 11,337; the 144-case gate is never
  waived. Direction 075: (1) bounded analyzer retry (2 fresh
  re-dispatches per turn, budget-reserved, strict parser unchanged),
  (2) fail-closed child seal on coverage < 1.0, (3) launcher
  seal-time coverage guard with immediate quarantine, (4) regression
  tests on the real dialogue-11 artifacts; counter re-pin 4,067 →
  5,183 (remaining 6,154). Report to 076. v4 relaunch needs
  both-session review + a fresh GO note.
- **RESOLVED — GO note 073a: pilot third take (v3) launched, stopped
  post-generation.**
  Direction 072 done at `4f3508cd` (report 073, `c72cf50f`): sized
  `tutor_system_standing` surface 24,000/6,000 (plain surface
  unchanged); duplicate audit scoped to the delimited menu block plus
  per-branch; zero-call three-condition render preflight in the
  launcher (all six real frozen renders PASS, ~2k chars margin);
  counter re-pinned 3,613 → 4,729 (remaining 6,608). Reviewer
  verification PASS (212/212, ESLint, diff read; dry-run audit escape
  unreachable live). Second-session final-gate PASS, zero calls; two
  non-blocking findings on record in its reply (preflight arg list
  hand-copied, not shared with the job builder; duplicate exemption
  coarser than strict twins — both bounded by fail-closed live audit
  and SHA-pinned menu bytes). GO note 073a issued for one launch:
  entry point at `4f3508cd`, out dir
  `…outcome-pilot-v3-live-2026-08-13`, 1116-call plan, report file
  074. Prior GO notes all consumed/void.
- **RESOLVED — direction 072: repair the standing-permission
  prompt-audit conflict; report to 073; no launch.**
  Chain since 069a: GO note 069b issued (corrected 1116 plan at
  `8ad749ec`; guard-verified; second-session PASS). First launch
  refused at the clean-worktree guard — concurrent paper-session dirt;
  report 070 (`9360233a`), ruling 070a (TECHNICAL, zero calls, 069b
  valid for one relaunch). Relaunch ran: dialogues 1–2 sealed, then
  dialogue 3 (standing permission) died pre-call — the injected menu
  (12,399 chars) breaks the `tutor_system` prompt audit
  deterministically (size caps 16,000/4,000 + by-construction
  duplicate lines per ruling 059a). **The reviewer delivered the
  SIGINT** (fail-closed; report 071 at `839864fe` left the cause
  unassigned; disclosed in ruling 071a). Spend 57 conservative;
  counter **3,613** of 11,337. v2 dialogues 3–4 QUARANTINED; 1–2
  sealed but support no ruling; **GO 069b CONSUMED**. Ruling 071a =
  TECHNICAL under 052a; re-take at same seeds after repair. Direction
  072: (1) sized budget for the menu-bearing surface, (2) duplicate
  exemption scoped to the delimited menu block, (3) zero-call
  three-condition render preflight in the launcher, (4) regression
  tests on the real frozen files; counter re-pin 3613 → 4729.
  Sequence after report 073: reviewer zero-call verify → ONE
  second-session final-gate review → fresh GO note → v3 out dir →
  relaunch. **Morning-review flags: reviewer SIGINT; audit-vs-menu
  conflict; two review passes missed what one prompt render would
  have caught; concurrent paper commits in this worktree.**
- **RESOLVED — ruling 069a: pilot stopped on plan arithmetic; corrected
  1116-call plan human-approved; GO 069b issued and later consumed.**
  (`069a-reviewer-ruling-technical-stop-plan-arithmetic.md`, rules on
  report 069 at `6278768b`.) The 068c launch ran verbatim; every guard
  passed; but a live 8-turn dialogue reserves ~26 low-level calls, not
  the 1 the frozen plan counted. The driver interrupted fail-closed
  during dialogue 2 — lawful under 052a, ruled TECHNICAL. Spend:
  conservative 33; counter **3,556** of 11,337. Dialogue 1 sealed
  complete (reuse decided at re-review; the corrected plan regenerates
  fresh); dialogue 2 QUARANTINED, re-take at same seed. Corrected plan:
  per-dialogue cap 30 enforced at the stub level; (18 × 30) + 288 +
  288 = **1116**; counter 3,556 → 4,672 if completed. **Human approved
  the doubled budget in session, 13 Aug: "prepare it now, I approve in
  advance."** Harness constants/guards, manifest `planned_calls`, and
  tests re-pinned (new regression test pins the cap against the
  measured live unit; suites 191/191 + ESLint). GO note 068c is
  CONSUMED. Sequence: second-session review of the arithmetic diff
  (final-gate), then GO note 069b, fresh out dir
  `…outcome-pilot-v2-live-2026-08-13`. **Morning-review flags: the
  stop, the wrong frozen arithmetic (both prior review passes missed
  it), 068c consumed.**
- **RESOLVED — ruling 068b: 068/068a RETRACTED; pilot launch on GO
  note 068c (594 calls, no ping) — 068c now CONSUMED per 069a.**
  (`068b-reviewer-ruling-retraction-and-guard-fix.md`.) Driver
  report 068 (`369becfe`) found the lawful instrument freeze at
  `/private/tmp/adaptive-warrant-v3-matrix-live-489f2429-r38-s514/annotation-freeze-manifest-r52-presence-confirmation.json`
  — the sweeps behind ruling 068 missed `/private/tmp`, and the
  "cut off" takes were alive (reviewer launcher pattern reported
  completion at spawn). No ping, no input-seam amendment; the take
  launched under 068 was killed at zero calls, zero commits. One
  real harness bug fixed (menu byte guard vs the file's trailing
  newline; reviewer edit, second session diagnosis, regression
  test on the real frozen files, 25/25 + ESLint). Freeze artifacts
  preserved to the archive repo with hash checks. Plan back to
  **594**; counter 3,523 → 4,117 of 11,337 when the pilot
  completes. **Morning-review flags: the 068 retraction and the
  reviewer-made harness edit.** Second-session messaging stays
  final-gate only (user instruction, 13 Aug).
- **RESOLVED — ruling + direction 068 + GO note 068a: VOID** (wrong
  premise; retracted by 068b above; never executed, nothing spent).
- **RESOLVED — direction 067 (superseded by 068): locate or lawfully
  construct the instrument freeze (zero-call).** Report 066 (`8ad77c03`)
  delivered the harness at `67c4cf6d`
  (`scripts/run-adaptive-warrant-outcome-pilot.js`). Two-sided
  review: second session bytes PASS (pins untouched, suites 24/24
  + 111/111 reproduced); reviewer guards/tests PASS (launcher
  digests match pins; consumed-note and fake-note refusals exit
  nonzero; default invocation prints the plan and creates
  nothing; the six direction-065 guard tests green). BUT the
  harness's required `--instrument-freeze` input — a natural
  freeze (`warrant-mechanism-validation-freeze.v1`, five bindings,
  plus `semantic_instrument.schema_acceptance.path`) — exists
  NOWHERE: not on disk, not in the archive repo, not in any
  worktree, never in git history. Its only emitter is a
  mechanism-validation LIVE run of the baseline study (only
  dry-runs v1–v7 exist); the schema-acceptance artifact's only
  producer is a paid one-call ping. The freeze-form test passes on
  a synthetic fixture, so the suite could not catch this.
  Direction 067: driver names the lawful source, or the zero-call
  construction path, or states plainly that one paid ping (+1
  call over the 594 plan) is required and STOPS. No fresh go note
  until this input is pinned. Watch cadence 600s (human-set).
- **RESOLVED — direction 065 executed clean: harness built.**
  Report 064 (`9d410d55`) was a structural stop BEFORE the first
  paid call (no executable harness). Ruling 064a: technical under
  052a; **GO note 063a is CONSUMED**; reader-freeze form pinned;
  future go notes must name the executable entry point and its
  commit. Direction 065 built the harness with fail-closed launch
  guards, resume-safe checkpoints, mandatory fingerprint gate,
  pinned freeze form, 594-call accounting, zero-call tests
  (report 066, commit `8ad77c03`). Counter 3,523 unchanged; seeds
  515–517 unspent.
- **RESOLVED — GO note 063a (consumed): report 063 passed both
  review gates** (second session three layers PASS; reviewer
  re-check PASS — menu SHAs, 87-row classification at full trace
  depth, SHA table = 056, suites rerun). 063a authorized the pilot
  but the launch stopped structurally; see ruling 064a above.
- **RESOLVED — direction 062: ruling-060b send-back executed
  clean.** Report 061's menu raced the ruling; direction 062
  removed `opening.instructional_meta` and the empty-quote
  support-zero entry and added the per-string classification
  (switching variable, gate reachability, verdict, trace; doubt
  rows kept IN). The drift guard now also fails on classification
  drift.
- **RESOLVED — ruling 059a + direction 060: the menu quotes the
  RENDERED layer.** Report 059 (`11d5c543`) stopped clean at the
  check boundary (lint + help-digest fixture; both reproduced by
  the reviewer; zero calls; seeds 515–517 prepared, none claimed).
  The second session's byte review: quotes byte-faithful (35/35,
  SHA table equals report 056) BUT the menu enumerated the
  contract-object strings while the live speaking prompt renders
  the compact host-plan strings from the same pinned file. Ruling
  059a (`059a-reviewer-ruling-menu-rendered-layer.md`): "injected"
  in Amendment 1 §1 means rendered into the live speaking prompt —
  settled by the registration's purpose clause, same method as
  ruling 057; five-source scope unchanged. **FLAG FOR THE HUMAN'S
  MORNING REVIEW: this is the reviewer's interpretation of the
  approved "full scope"; the human can override.** Direction 060:
  one zero-call repair pass (lint, help digest), rebuild the menu
  on the compact layer with template-slot handling, rerun the
  whole boundary, then the pilot manifest; report to 061. HOLD on
  paid calls stands; sequence: report 061, second-session byte
  review, reviewer manifest verification, THEN go note. Budget
  3,523/11,337.
- **RESOLVED — Amendment 1 + direction 058: human ruled ("I approve
  the menu with full scope", relayed 13 Aug ~06:40, recorded
  verbatim in `v3-outcome-study-registration-amendment-1.md`); the
  standing-permission condition is bound as a conditional menu over
  the full injectable union from the five SHA-pinned sources, with
  descriptive-only prefix sentences and a byte-level drift guard.
  Lease N ran the zero-call A1 completion and stopped at the check
  boundary; superseded by ruling 059a + direction 060 above.
- **RESOLVED — ruling 057: outcome pilot BLOCKED for the human;
  standing-permission binding is an open design decision**
  (`057-reviewer-ruling-standing-permission-binding-open.md`, rules
  on report 056 at `f74929ae`). The driver stopped A1 zero-call: the
  live gate has no single "verbatim template + hint menu" — the
  injectable strings live in five sources with mutually exclusive
  state-picked branches. The purpose clause rules out a partial
  paste and a flat concatenation; the remaining choice (scope of the
  string union + new conditional-prefix prose, versus a Phase-5
  smoke-prompt reconstruction, versus dropping the condition) is a
  design decision reserved for the human (registration §7, note
  052e). Recommendation recorded in 057 §4: conditional menu, full
  injectable scope, byte-level drift guard, second-session byte
  review before go. Nothing spent: budget 3,523/11,337, no seed, no
  manifest, no take burned. Lease N's zero-call continuation is
  COMPLETE and verified by both sessions: scoring harness for
  measures 1–6 + presence preflight (`5b24782a`, report 056a),
  decision-reader evidence guard failing closed per note 057a
  (`1460709d`), hash-tamper fixture (`6a0825f4`) — focused suite
  13/13 on both sessions' independent runs. Note 057a arose because
  pin 1 put the decision readers back on the live path while their
  batch preparer skips all evidence checks when no run record is
  passed; the pinned bytes stay frozen and the new harness
  duplicates the checks fail-closed (also closing the absent
  prohibited-tool-count hole). HOLD on all paid calls stands. The
  eventual A1 manifest is bound by notes 055a (three pins), 055b
  (measure-1 reader output form = path 1), and 057a §2 (run-record
  path always passed); go-note wording: say "consensus value", not
  "reader A's value". QUIET HOLD: everything waits on the human's
  binding ruling (057 §3–4).
- **RESOLVED — direction 055: outcome study registered; A1 + pilot**
  (`055-reviewer-direction-outcome-study-pilot.md`; lease
  `DRIVER-LEASE-2026-08-13-N`; report to 056). Registration frozen
  before any outcome call:
  `docs/adaptation-refinement/v3-outcome-study-registration.md` —
  three conditions (bare / gated / standing-permission verbatim),
  pilot 6 per condition go/no-go, main fixed 24 per condition on a
  reviewer GO only; measures 1–6 deterministic per the design draft,
  7–8 presence-grain via the unchanged r52 instrument (consensus
  cases only, fresh readers); fine grain stays out everywhere.
  A1 stopped on the unbound standing-permission source (report 056);
  superseded by ruling 057 above. Budget 3,523/11,337;
  per-phase planned counts recorded pre-call and reviewer-approved.
- **RESOLVED — direction 052: presence-grain gate registered; run the
  confirmation** (`052-reviewer-direction-presence-gate-confirmation.md`;
  lease `DRIVER-LEASE-2026-08-13-M`; report to 053). The human ruled
  on 051 ("register the coarse gate and buy the confirmation run" —
  option 3, narrow form; relayed by the second session, recorded in
  the registration). Registration committed BEFORE the run:
  `docs/adaptation-refinement/v3-semantic-reader-presence-gate-registration.md`
  — scoring layer only (all seven r49 instrument digests unchanged);
  gating identity = ambiguity flag + result-request presence +
  proposed-test presence per case; floors: per-metric agreement
  ≥0.80/≥0.80/≥0.90, consensus ≥72/93, gold ≥4 + ≥4; ONE attempt,
  FAIL is terminal for the layer (051 option 1 then applies). Pilot
  (r49, design only, never scored under this gate): 0.914 / 0.978 /
  1.000 / 83/93 / 18 / 8 — reviewer and second session matched to
  the digit. Object-set grain reported-not-gating under two pinned
  extractions (event-target-slot set 75/93; catalogue-binding set
  76/93 — registration §4 pins the exact computations; a pre-scorer
  amendment corrected the first figures, which came from an unpinned
  extraction). Budget 3,337/8,000 direct-ceiling
  authority; 186 planned calls (end state 3,523); relayed ceiling
  renewal recorded, not relied on. Readers may run two-wide.
  Overnight ruling recorded as relayed (052a): substantive FAIL is
  terminal; technical/operational failures do not burn the attempt
  and re-takes are authorized; the reviewer classifies and discloses
  before any re-take. Ceiling RENEWED DIRECTLY by the human in the
  reviewer session (052b, 13 Aug ~00:14): fresh 8,000 if needed —
  hard ceiling now 11,337 total, counter continues from 3,337.
  Later-arc intent banked (052d, relayed): after the presence gate
  settles, a fresh registration at an intermediate grain (speech-act
  categories) on an amended handbook; r49/r52 = design pilots only;
  no change to tonight's run.
  Outcome-study go-ahead (052e, relayed): a clean PASS on 053 —
  floors met, both sessions' scoring matched to the digit —
  authorizes the reviewer to register the outcome study and run the
  6-per-version pilot without waking the human, inside the 11,337
  ceiling; FAIL or messy PASS stops for the human.
- **RESOLVED — ruling 051** (kept as history). Report 050 ACCEPTED in
  full; the two assembly stops ruled READER ERROR = data (the lawful
  null-target `explain_wording` entry existed in every catalogue);
  fine-grain matrix gate ruled **FAIL** on every completion path
  (hard consensus 24/93 vs 72; raw agreement 0.258 vs 0.80; gold
  3 + 1 vs 4 + 4; speech-acts-only 58/93). Instrument ran clean —
  the FAIL is a natural-performance verdict on the reader pair, not
  a harness defect. Lease L retired (report 050, commit `2174c0c6`).
- **RESOLVED — direction 049** (kept as history). Defect #16 (the
  frozen assembly gate demanded `model_independently_attested ===
  true`, which the CLI bridge can never produce) repaired at
  `4c33e6df`: attested-true OR the exact bridge-echo tuple pinned to
  the registered reader identity; reader digest re-pinned
  `7b084d93…` → `6cb95fd8…10145f`; all letters PASS; second-session
  cross-check 6/6. The four r47 responses quarantined (never
  admitted); their 5 attempts counted. Fresh 186-call run completed
  186/186 with zero failures; every response admissible under the
  repaired provenance gate.
- **RESOLVED — direction 047** (kept as history). Cap raised
  10,500 → 14,000 at `62e4fd0a`; reader digest re-pinned
  `51107d43…` → `7b084d93…` with the eight-letter equivalence proof;
  ledger #15 closed; second-session cross-check PASS on all four
  points. The reader stop it ordered is resolved by direction 049.
- **RESOLVED — direction 045** (kept as history). Report 044
  accepted; the seed-514 freeze COMPLETED at 93/2/3 (manifest
  `668511bb…`); defect #15 (response schema 10,930 vs frozen 10,500
  cap at every legal batch size) ruled a transport repair, cap 14,000
  authorized. The driver then stopped zero-call (report 046) on the
  digest conflict now resolved by direction 047.
- **RESOLVED — directions 041/043** (kept as history). The human's
  drop-and-log ruling ("drop the three duplicate cases and proceed",
  typed 21:04) was implemented (commits `31ad8ec9`, `177881d6`;
  ledger #13) with one reconciliation: the audit's "3 overlaps" were
  match relationships over 2 distinct candidates (the foxtrot case
  matches two corpora; only one foxtrot turn-1 candidate exists), so
  the correct content-blind result is 93 retained, verified zero-call
  by reviewer AND the second session independently. Defect-#14 (freeze
  exactness check rejected drop-and-log freezes by design) repaired at
  `a925fb7a`. Reports 042/044 accepted; zero calls spent since the
  matrix.
- **RESOLVED — freeze-overlap hard stop of ~20:45** (kept as history).
  The seed-514 matrix COMPLETED CLEAN (24/24 dialogues, 606/606 calls,
  zero errors, 192/192 live/offline parity; checkpoint coverage
  139/144 = 96.53%, final 187/192 = 97.40%, no coverage halt — the
  first complete matrix of the arc). Defect #12 (final status checker
  dropped fallback turns from its denominators, wrote `invalid_parity`
  on a clean run) was repaired per the continuation policy at
  `3eca7086`, ledgered, guarded, chain green; the reducer replay
  resolves seed 514 `complete`. The annotation freeze then FAILED
  CLOSED: 3 overlap rows / 2 fingerprints against excluded corpora —
  all the LOW-AGENCY learner's formulaic turn-1 opening, matching a
  prior mechanism run, the preserved 36d2e63f matrix, and burned seed
  504. Reviewer verification (note 040 + addendum): the collision is
  STRUCTURAL at turn 1 — the fingerprint hashes the pre-decision
  transcript (empty at turn 1) plus the opener, so formulaic personas
  collide by construction and no run-specific content enters the hash.
  Driver report: `039-codex-report.md` (accepted). RESOLUTION: the
  human ruled drop-and-log — see current direction 041.
- **RESOLVED — direction 038** (kept as history;
  `038-reviewer-direction-composite-label-repair-seed-514.md`, lease
  `DRIVER-LEASE-2026-08-12-G` retired with report 039 and note 040).
  The human ruled at 19:52: repair defect #11, closure v2 with
  SYNTHETIC targets, seed 514 licensed, **ceiling 4,000 → 8,000**,
  standing "no hard-stop, continue until done" instruction encoded as
  the continuation policy (deterministic harness defects =
  repair + ledger + guards + next disclosed seed, continue; human
  stops ONLY: instrument amendments, contamination/provenance, the
  8,000 ceiling, coverage losses not dominated by a nameable defect).
  Executed exactly: defect #11 repaired at `489f2429` (guard test
  passed unmodified; closure v2 = 6 retained + 19 synthetic targets,
  no unproducible shapes), chain green, matrix launched and completed
  — see the hard stop above.
- **RESOLVED — hard stop of 19:45** (kept as history). Seed 513 failed the
  launcher's own local test preflight BEFORE any child or paid call:
  the new target-aware fallback mangles composite target labels
  ("The first-log-entry-log entry is not public yet…"); one
  pre-existing test caught it (200/201). Zero calls spent at seed 513;
  0 of 24 children started; both coverage rates N/A (0/0). Driver
  report: `036-codex-report.md` (accepted). Reviewer ruling:
  `037-reviewer-note-seed-513-hard-stop-accepted.md`. DEFECT-LEDGER
  entry #11 (composite-label rendering; the fallback-pass closure was
  green but its corpus exposes only one target signature — widen it on
  any repair). Budget: driver recount adopted — seed 512 = 298
  attempts; running total **2,540/4,000 at the time**; matrix ~600.
  RESOLUTION: the human ruled option 1 plus a ceiling raise to 8,000
  and a continue-until-done instruction — see current direction 038.
- **RESOLVED — direction 035** (kept as history;
  `035-reviewer-direction-fallback-repair-seed-513.md`, lease
  `DRIVER-LEASE-2026-08-12-F` retired with report 036). Repairs R1/R2
  + defect #9/#10 guards + fallback-pass closure landed at `37385273`;
  the zero-call chain passed (closure green 6/6, s510 replay identical
  5/185 = 2.70%, preflight 42/42, schema carryover, dry 24/24); the
  live launch then hit the preflight failure above — a NEW class, so
  the driver hard-stopped per the direction. The reviewer KILLED the live seed-512
  run at ~19:10: two gate-active children died on a new deterministic
  fatal one layer below defect #7 — the progression contract now
  compiles, but the final response check rejects every draft
  (`public_obligation_unresolved`) and the deterministic fallback
  fails its own harness's check, so children die guard-exhausted.
  With two dead the 24-dialogue matrix could not complete; every
  further call was going to a burned seed. DEFECT-LEDGER entries #9
  (fallback deferral template names no target terms, repeats its own
  sentence — the guaranteed last resort can never pass) and #10
  (component matcher demands the raw value-type token — `other`,
  `record_text` — in prose; answers can never score satisfied).
  Direction 035 pre-declares repairs R1 (target-aware terminal
  fallback that passes by construction; style checks advisory on the
  terminal fallback only) + R2 (non-special value types scored by the
  answer-bearing relation), the NEW fallback-pass closure guard (every
  reachable obligation + deterministic fallback passes the full final
  check, zero-call, over the retained 511/512 corpora), the s510
  replay invariance (2.70%), preflight, then SEED 513 as fresh
  primary. **Seed 514 is the LAST reserve and is NOT reviewer-
  spendable: any seed-513 failure of any kind = human hard stop.**
  Budget ≈2,535/4,000 (driver to recount); ~3,135 projected.
- **RESOLVED — direction 034** (kept as history). Repairs for defects
  #7/#8 committed at `1555a9bd`; the whole zero-call chain passed
  (failed-draw directives compiled complete; s511 partial packet
  froze; s510 replay identical 2.70%); seed 512 launched cleanly and
  was then killed live by the reviewer when defect #9 surfaced (see
  current direction). Seeds 511 AND 512 burned.
- **RESOLVED — stop of report 033** (kept as history). Seed 511 ran
  under v3.2 at `3e758071` (licensed: 179/179 focused incl. 3 guards;
  s510 replay 5/185 = 2.70%; preflight 42/42). 22/24 complete; both
  fast_learner/intervening children died deterministically pre-draft;
  packet freeze failed on the empty generic catalogue. 569 calls
  spent. Ruling: direction 034 above.
- **RESOLVED — hard stop of 17:33** (report `031-codex-report.md`;
  kept as history). Seed 510 ran under contract v3.1
  (both 030 amendments, licensed in order, replay predicted 9.92%)
  and coverage-halted at the registered checkpoint: 25/160 =
  15.625% against the 15% ceiling. A NEAR MISS: after the last
  already-running child sealed, the descriptive final total was
  25/168 = 14.881% — under the line — but the failed self-halt
  checkpoint is not waived post hoc. Cause split: 19 of 25 losses
  are the seat using the NEW `"unspecified"` sentinel on
  non-request acts (forbidden by v3.1's own rule 1); 3 non-atomic
  overlaps, 1 non-public identifier, 1 non-literal span, 1 timeout;
  ZERO audit overflows. The two OLD failure classes are gone — the
  amendments worked; the model overgeneralized the new marker.
  Calls 1,673/4,000. No matrix gate ruling (halt preceded the
  reader stage). Direction 030 grants no further authority: no
  retry, no amendment, no alternate seat. The human must choose:
  stop the programme, or issue a new prospective protocol. DO NOT
  relaunch the driver; the watch loop is stopped.
- **RESOLVED — direction 030** (human ruled 17:20 — option 1): amend
  the two rules as contract v3.1, spend seed 510. Executed; see the
  hard stop above and report 031.
- **RESOLVED — hard stop of 16:40** (report
  `029-codex-report.md`, merged at `40022061`; kept as history). Seed 509
  coverage-halted at 25/128 = 19.53% unanalyzed; ZERO cap blocks (the
  028 repair worked). All losses are the analysis seat breaking
  written rules: missing catalogue targets, forbidden value/component
  sets, non-public identifiers, non-literal spans, non-atomic
  overlaps — reader/model error, not contract ambiguity. Three
  disjoint paid probe blocks over the burned returned analyses:
  8/48, 12/48, 7/35 — none inside the 15% relaunch line; pooled
  20.61%. Seed 510 unburned and FROZEN. Calls spent 1,085/4,000.
  Driver exited cleanly; DO NOT relaunch until the human chooses:
  (1) redesign/cut the live semantic-typing layer prospectively;
  (2) a different analysis seat or an openly registered new
  coverage/relaunch criterion; (3) stop the matrix programme here.
  Reviewer note: reviewer direction 029 (freeze + zero-call
  diagnosis) crossed with the driver's own equivalent work.
- **Zero-call concentration split DONE** (reviewer, 17:05; script
  `scripts/tally-semantic-replay-residuals.py`, commit `24147a29`,
  run on the s509 counterfactual replay). Findings, all zero-call:
  (a) two rule families carry 22 of the 25 discards —
  `target.target_id:required` (+ its paired
  `action_object_id:invalid`) and
  `target:value_component_sets_forbidden_for_non_request`; relaxing
  only those two would leave 3/128 = 2.34% unanalyzed, far inside the
  15% line. (b) Both are contract–utterance mismatches, not model
  sloppiness: generic evidence requests ("what public evidence can we
  examine first?") name no catalogue item, so the required target_id
  comes back empty; hybrid criterion questions ("does the seal
  match?") are typed correctly as criterion_question but carry
  requested_value_types, which the contract forbids on non-request
  acts. Sonnet broke the same value/component rule 19× (report 022) —
  two independent models failing the same two rules on the same
  utterance class points at the rules. (c) The loss is BIASED:
  counterexample_hunter carries 10 of 25 discards (one dialogue lost
  6 of 8 turns); answer_seeking lost zero. Coverage loss deletes
  exactly the challenge-heavy dialogues. Worlds/conditions/turns are
  even. This is the reviewer's input to the human's three-way choice;
  it favors option 1 (amend the two rules prospectively, openly
  re-registered; seed 510 stays frozen until that is written).
- Prior reviewer position on the seed-509 relaunch (15:50, from the live
  log; the driver's report is still pending): seed 507 crashed on a
  transport defect (parent finalization validated a partial reader
  catalog mid-run) with coverage INSIDE the line (8.93%); seed 508
  coverage-halted at 22.9% (10 frozen-validator discards + 1 cap
  block); the driver applied the 028 cap repair plus the finalization
  and parity repairs and relaunched at seed 509. ACCEPTED, on this
  arithmetic: pooled live discard across 507+508 is 13/101 ≈ 12.9%,
  inside the 15% relaunch line; the 47-call probe's 27.7% predates the
  byte-identical probe/live parity proof and measured a rewritten
  prompt, so it overestimates. The driver's report must state this
  pooling explicitly and give per-seed cause splits. **TRIPWIRE: if
  seed 509 coverage-halts, the pooled prediction is above the line —
  seed 510 must NOT be spent without a fresh reviewer ruling. A 509
  halt is a stop-and-report boundary.**
- **Defect ledger:** `DEFECT-LEDGER.md` — every systematic harness
  defect and its regression guard, plus the standing policy (human,
  12 Aug): systematic transport defects are WARNINGS inside the
  registered coverage line; restart only on a failed gate; never patch
  a live run; never waive a failed gate post hoc. Keep it current —
  new systematic defects get an entry with their guard test.
- **Contingency on file:** `028-reviewer-direction-prompt-cap-contingency.md` —
  applies ONLY if the seed-507 matrix coverage-halts or fails its gate
  with prompt-audit overflow as a cause (turn-8 analysis prompts
  exceed the 42,000-char audit cap; loss is systematic on late turns).
  Pre-declared replacements: maxChars 56,000, maxApproxTokens 14,000;
  plus a zero-call probe/live prompt-parity preflight assertion;
  relaunch at seed 508; never patch a live run. Every matrix report
  must split unanalyzed turns into audit-overflow vs model-residual
  classes and the gate ruling quotes both.
- **Current direction:** `027-reviewer-direction-template-projection.md` —
  answers report 026 (025's retry ping failed on a missing value at
  `$.semantic_events.extraction_status`, evidence retained). Ruling:
  ping-template defect — the enforced response schema
  (`additionalProperties: false`, single property `events`) makes the
  template's harness-derived envelope fields (extraction_status,
  schema, source_turn, source_text_sha256) unreturnable; the model's
  `{"events":[]}` was the maximal correct copy. Orders: (1) the
  compared template must be the provider-schema view (for
  semantic_events exactly `{"events": []}`); packet and expected value
  identical, schema-shaped; (2) zero-call closure: focused test +
  preflight assertion that the synthetic template VALIDATES against
  the enforced response schema; (3) ONE more retry ping (running
  budget 3 of 4,000 when spent) — pass = launch the matrix at seed
  506 under 022's terms, no stop; fail = STOP with the retained diff,
  no further calls.
  Prior: `025-reviewer-direction-ping-criterion.md` —
  answers report 024 (seed-506 launch stopped at the acceptance ping:
  Luna's response passed schema + strict parse + validator but failed
  a byte-identity comparison against the synthetic template; the
  harness discarded the response). Ruling: transport-harness defect,
  timebox class. Orders: (1) ping harness retains raw + parsed
  response and the first differing field path on any acceptance
  failure, and reports status truthfully; (2) ping acceptance =
  provenance + strict parse + validator + CANONICAL-VALUE equality to
  the template (key order/bytes irrelevant, strings compared under the
  validator's own punctuation normalization; any differing VALUE still
  fails) — ping harness only, live validator untouched; (3) focused
  tests + preflight assertion; (4) ONE retry ping — pass = launch the
  matrix at seed 506 under 022's terms with no stop; fail = STOP with
  the retained diff. Unattended budget spent: 1 of 4,000 (retry makes
  2; matrix ~612 on pass).
  Prior: `022-reviewer-direction-luna-coverage-note.md` —
  021 ran to its hard stop: Luna + handbook_v1 probe 5/48 = 10.42%
  (fail by one call); Sonnet upgrade probe 25/48 = 52.08% (17/48 =
  35.4% after the apostrophe finding below — still fail; Sonnet
  breaks the value/component rule 19 vs Luna's 3). Reviewer probe
  audit: 8 Sonnet "not_literal" discards were byte-matching on
  typographic vs ASCII apostrophes, a harness defect; the fix rescues
  nothing on Luna (its one quote failure is a real misquote). Human
  decision (12 Aug chat): (1) seat back to `codex.gpt-5.6-luna` +
  `handbook_v1` (revert 39757d4e's model pin, keep its guards); (2)
  punctuation-normalized quote matching both seats, mechanical,
  prospective, preflight-asserted; (3) coverage self-halt 10% → 15%
  (first-call gate stays), grounds registered: probe-measured expected
  unanalyzed 10.4% ±~4; per-turn strictness unchanged; matrix report
  must state achieved coverage and the gate ruling must quote it; (4)
  RELAUNCH at reserve seed 506 under the standing authorization.
  After the matrix: gate pass = stop before outcome study (freeze
  prereg from `2026-08-12_outcome-study-design-draft.md`, human go);
  gate fail = stop for review (004 options); ruling 010 fallback
  stands. Reserve seeds 507-510 unchanged. Burned: seed-503, -504,
  -505 corpora + both 021 probe artifact sets.
  Prior: `021-reviewer-direction-prompt-parity.md` — prompt parity
  (handbook rules ported into the live prompt) + pre-authorized
  Sonnet seat try; both probe gates failed; report `5923b99e`.
  Prior: `019-reviewer-direction-offset-derivation.md` — mechanical
  offset derivation both seats (model gives unique literal quote,
  harness derives offsets + overlap), landed at `84e3dcbb`, 126/126
  focused tests, preflight 36/36 `instrument_ready`;
  `017-reviewer-direction-halt-threshold.md` (halt threshold +
  guards), `016-reviewer-direction-seed-lock.md` —
  replacement master seed 504 named (reserves 505, 506); the one-line
  seed-lock amendment is authorized; preflight at the amended commit;
  the passed ping carries over if the live schema digests are unchanged
  (else one fresh ping); then LAUNCH the matrix under 014's terms.
  Background: `014-reviewer-direction-rerun-authorized.md` —
  live-seat repair ACCEPTED (report 013: 137 failures = 7 parse + 130
  strict-validator rejections; root cause was the legacy schema-free
  parse mode on the live seat, fixed at `575801bc`). Human authorized
  (12 Aug, in chat): run the one-call acceptance ping from the frozen
  packet; on its pass, the fresh representative matrix (new seed, same
  frozen design, ~612 calls, 1,536 ceiling, attended, checkpointed).
  Ping fail = STOP and report. After the matrix: gate pass = stop before
  the outcome study (own prereg + human go); gate fail = stop for review
  (004 scope-cut options). Ruling 010's mechanism-typing fallback
  stands. The failed 36d2e63f matrix stays preserved, unscored, never
  pooled. Earlier results stand: supplement PASSED (5/2), five-cell
  layer certified, decision readers 0.833 binary.
- **Driver:** the session whose prompt quotes the lease token in 006c.
  LIVE LEASE: `DRIVER-LEASE-2026-08-12-I` under direction 043
  (defect-#14 exactness-check repair → complete the seed-514 freeze at
  93 cases → readers → support gate → report 044). Lease H retired
  with report 042. Other sessions: read-only.
- **Instrument commit:** `225a7b07` ("Separate V3 structural and semantic
  gates"). The instrument is CLOSED — it reopens only for a transport,
  schema, provenance, or non-evaluability defect. Never for semantic
  misses, never for lexical patches.

## Certified / pending / burned

- **Certified (from the 225a7b07 24-case diagnostic, 21/24 hard
  consensus):** result requests (8), proposed tests (7), target/value
  partitions (11), tutor-selection requests (2).
- **Pending:** record-entry cell (1 of 2 minimum) — the supplement decides
  it, once.
- **Burned:** every case in the three earlier V3 diagnostic corpora
  (`3ba68de5`, `d2bf37c7`, `7df153d9`), all smoke corpora (excluded by
  class), and the `fcd944f0`/`efcca5f0`/`65d45700` smoke cases. Zero reuse,
  zero pooling. Freeze manifests carry the exclusion hashes.

## Standing rules (compressed; sources: 002, 004, 006)

1. **Gate separation.** Structure gate (hard): schema validity, catalog
   membership, unique literal span, provenance, size, no prohibited
   tools. Semantic quality is measured against consensus, never enforced
   by the validator. No lexical/word-overlap rejection of canonical IDs.
2. **Discriminator.** Reader disagreement is classified in the report:
   both-defensible under the written contract = contract ambiguity =
   blocks; violates a written rule = reader error = data.
3. **Validation economy.** Focused tests + 31-check preflight while
   working; full suite exactly once, at the freeze commit; never after
   report-only commits.
4. **Operational failures** (no artifact, no contract change): fix and
   retry without stopping; note in the report.
4b. **Frozen-constant conflicts** (016): if a direction conflicts with a
   frozen constant and the direction or a predeclared reserve list names
   the replacement value, amend the constant in place, record the
   amendment commit, and proceed — no stop. Stop only when the needed
   value or authority is genuinely absent from the written record.
5. **Pass path (pre-authorized):** preflight → acceptance ping → smoke →
   diagnostic/supplement freeze → readers → support gate → decision
   readers on the certified corpus. **Hard stops:** any contract-
   ambiguity finding, restated-measures sign-off on a supplement fail,
   and the representative matrix (HUMAN-authorized, never launch).
6. **Call ceilings:** ping 1, smoke 2, diagnostic reader run 8.
   Report calls spent every time.

## Key paths

- Scripts: `scripts/run-adaptive-warrant-semantic-brittleness-preflight.js`,
  `…-schema-acceptance-ping.js`, `…-schema-smoke.js`,
  `scripts/build-adaptive-warrant-v3-semantic-diagnostic.js`,
  `scripts/prepare-adaptive-warrant-semantic-annotations.js`,
  `scripts/run-adaptive-warrant-semantic-readers.js`.
- Contract/validator: `services/adaptiveWarrantSemanticAnnotation.js`,
  `services/adaptiveWarrantSemanticEvents.js`,
  `services/adaptiveWarrantSemanticPreflight.js`.
- Latest results: `/private/tmp/adaptive-warrant-v3-semantic-diagnostic-225a7b07/`.
- Deep background (only if needed): `2026-08-12_v3-instrument-audit.md`,
  `2026-08-12_outcome-study-design-draft.md`, numbered relay files.

## Reporting

Write `relay/NNN-codex-report.md` (next free number), commit with
`--no-verify` and a `Workplan-item: N/A` trailer plus the Co-Authored-By
convention visible in recent relay commits. State: boundary reached,
calls spent, hashes, classification of any disagreement, proceeding or
waiting.
