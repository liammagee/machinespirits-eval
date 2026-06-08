# A19 v0.8 Learner-Standing Screen

Date: 2026-06-08.
Protocol: `a19-drama-axiom-transfer-v0.8`.
Family: `moral_disclosure_standing_repair`.
Repair type: `learner_standing_repair`.

## Boundary

This is a simulated teacher-as-learner screen only. It does not claim human
learning, deployed adaptive tutoring, model-weight learning, a main-harness
effect, a paid-panel result, a sidecar result, or an atlas result.

The v0.8 question was whether a public learner-standing repair could be made
auditable without collapsing into transfer-control. The answer is: partially,
but below the A19 claim threshold. The family produced one local policy-headroom
card, and that card still carries target-granularity risk. The other held-out
siblings were S0 ceilings.

## Attempt-1

The real attempt-1 replay survived the recursive tutor-learning gate.

- Attempt-1 artifacts:
  `exports/a19/real-attempt1-v08/moral-disclosure-standing-repair/`
- Attempt-1 report:
  `notes/adaptive_2_0/a19-attempt1-real-gate-report-learner-standing.md`
- Admitted axiom:
  `exports/a19/axioms/moral-disclosure-standing-repair/axiom.json`

The admitted axiom is bounded to a single teaching-drama memory unit. It is not
a full `revision.json` bundle.

## Held-Out Screen

All S0 runs used `recursive_full_no_policy_memory`. S1 ran only where the S0
screen left observable headroom or where an ambiguous single-arm result needed
paired adjudication to resolve.

| sibling | S0 single-arm result | S1 / paired result | status |
| --- | --- | --- | --- |
| `moral_disclosure_standing_repair_a` | `neither`; extracted as `claim_address_repair`; no target-granularity risk | S1 `target`; extracted as `learner_standing_repair`; target-granularity risk true | local `policy_headroom`, not clean |
| `moral_disclosure_standing_repair_b` | `target`; extracted as `claim_address_repair`; target-granularity risk true | not run | S0 ceiling / granularity risk |
| `moral_disclosure_standing_repair_c` | initial single-arm was ambiguous; paired adjudication mapped S0 and S1 both to `target` / `learner_standing_repair` | paired verdict `ceiling`; target-granularity risk false | clean S0 ceiling |

Key artifacts:

- A S0 headroom:
  `exports/a19/real-s0s1-v08/moral-disclosure-standing-repair/moral-disclosure-standing-repair-a/s0-headroom.free-text.json`
- A paired adjudication:
  `exports/a19/real-s0s1-v08/moral-disclosure-standing-repair/moral-disclosure-standing-repair-a/blind-adjudication.free-text.json`
- B S0 headroom:
  `exports/a19/real-s0s1-v08/moral-disclosure-standing-repair/moral-disclosure-standing-repair-b/s0-headroom.free-text.json`
- C S0 headroom:
  `exports/a19/real-s0s1-v08/moral-disclosure-standing-repair/moral-disclosure-standing-repair-c/s0-headroom.free-text.json`
- C paired adjudication:
  `exports/a19/real-s0s1-v08/moral-disclosure-standing-repair/moral-disclosure-standing-repair-c/blind-adjudication.free-text.json`

## Adjudication Packet

The only local headroom card, sibling A, has been preserved as a blinded
adjudication packet for later independent or human coding.

- Packet:
  `exports/a19/adjudication-packets/moral-disclosure-standing-repair-a.packet.json`
- Coder merge report:
  `exports/a19/adjudication-reports/moral-disclosure-standing-repair-a.coders.json`
- Current merge status: `no_coder_files`.
- Visible alias audit: one public-transcript hit for `accountability question`
  in the S1 arm.

The packet and merge report are infrastructure artifacts only. They do not
create an agreement result.

## Result

v0.8 does not clear the A19 evidence threshold:

- there are not two clean recursive-full held-out policy-headroom cards;
- the one local policy-headroom card carries target-granularity risk;
- one sibling is a noisy S0 ceiling;
- one sibling is a clean S0 ceiling.

The current resolution is
`v0_8_below_claim_threshold_no_sidecar_claim`. No Paper 2.0, atlas, sidecar, or
paid-panel escalation is licensed from this screen.
