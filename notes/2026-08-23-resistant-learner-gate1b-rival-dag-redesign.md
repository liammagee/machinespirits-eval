# Gate 1b resistant-learner rival-DAG redesign — DRAFT

No paid call or launch is authorized by this note. It is the operator-review surface for the v2 B1 and R1 calibration designs and the protocol-v2 launcher.

## Registered changes

| Change | Registered element touched | v2 decision |
|---|---|---|
| Replace manner-only resistant personas with rival learner DAGs | Question, design | B1 boredom is selective attention to a different catalog-world objective; R1 refusal is competition between the tutor answer frame and the learner's warrant-first frame. Rival DAGs are deterministically minted from validated world files through `loadWorld`, `buildLearnerDagSnapshot`, and `buildLearnerDag`; ad hoc rival content is forbidden. The computed rival-DAG state is recorded with each automated learner turn for audit. |
| Type the concession condition | Design | The learner may engage only when `normalized_public_token_overlap_v1` establishes that a public tutor move bears on a previously solicited open rival node and contains a registered evidence/test operation marker. The computed per-turn directive says MET or NOT MET; the learner model does not decide its own eligibility. The tutor receives no private DAG. |
| Add echo and bridge guards | Measurement rules | Repeating planted rival text, tutor text, or an unsupported tutor-only bridge scores zero. B1 pickup must advance the tutor world or a public authored bridge. R1 rung 1 must newly state what the learner frame demands; rung 2 must evaluate a bounded bridge test while reserving the wider objection. |
| Add two-sided calibration floors | Measurement rules | A channel must show measurable movement and retained resistance. B1 retains selective-attention resistance; R1 retains the jurisdictional dispute and bars whole-frame compliance. Reader eligibility and joint-agreement floors use completed rows, so retained typed rows cannot make a fixed 16-of-18 threshold arithmetically impossible. |
| Align reader prompt and checker | Measurement rules | The two seats remain `codex.gpt-5.6-sol` and `claude-code.sonnet-5`, low effort, with both eligible votes required. In v2, `evidence_quotes` must be null for `no` or `indeterminate`; every other determinate value needs an exact public quote. Luna remains excluded from voting. |
| Repair B1 tutor delivery | Design, measurement rules | The v2 compiler hardens the discriminating arm to exactly one whether-A-or-B question and the reference arm to declarative no-question delivery. Plain forbids collaborative invitations and edge. A zero-call matrix compiles 72 cases: every six worlds × two actions × three registers × bare/due-clue scene. |
| Replace GO-note parsing with protocol v2 | Ceiling and operational design | One attended launcher performs the same zero-call preflight in live and `--dry-run`, locally probes each CLI route, performs one stub-transport smoke per role, checks create-once destination and call arithmetic, then records typed approval in `approval.json`. Commit/tree/dirt and design digests are recorded, not enforced. There is no GO-note parser, digest authorization match, or re-signature after a code fix. |

## Spend and proposed ceiling

The seven archived create-once roots were inspected without modification. Reserved-attempt events agree with every available seal: first root 12; corrected root 36; two-reader root 84; R2 440; R3 436; R4 822; R5 822. Total spent is **2,652 attempts** (`12 + 36 + 84 + 440 + 436 + 822 + 822`). No row or dialogue from any root is reused or pooled.

The proposed fresh Gate 1b ceiling is **4,806 model attempts** for 36 fresh calibration dialogues and 1,530 planned role calls. The redesign adds no paid role: rival-DAG minting, the delivery compile matrix, CLI metadata probes, and stub-transport smokes are all zero-call. This ceiling remains a fail-before-call safeguard, not a target. Calibration rows never enter a powered run, and neither Gate 2 nor a powered run is authorized.

## Review packet

- B1: `config/tutor-stub-resistant-learner-b1-design.v2.json` — SHA-256 `1690a60c8174d05ad0435a994bb683fbe1d84a5c9d2a25b26c7e004101d34442`
- R1: `config/tutor-stub-resistant-learner-r1-design.v2.json` — SHA-256 `a8c744ea1a570b862a06a71d5d8418db16789c1ff6c1ac4fa8c3d03c69639cd5`
- Reader registration: `config/tutor-stub-resistant-learner-semantic-registration.v2.json` — SHA-256 `422e0f1496db955ae2bdcd9ba4e859f7aad0655687ca957bc70ba66fcfa6df9f`
- Launcher: `scripts/run-tutor-stub-resistant-learner-calibration-v2.js`
- Protocol: `notes/2026-08-23-launch-protocol-v2.md`

After merge, the operator may approve one launch in the attended terminal. The launcher prints both design digests, full routes, job and call plan, ceiling, and destination before accepting the exact typed phrase and writing `approval.json`.
