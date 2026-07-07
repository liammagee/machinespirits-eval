# A21 Hethel Contrastive Autopsy

Generated: 2026-06-16T15:07:50.088Z

## Sources

- Hidden success: `exports/dramatic-derivation/loop/hethel-phase5g-a20-fresh-hidden-r1` -> grounded_anagnorisis, forced 20, asserted 20
- Failed overlay: `exports/dramatic-derivation/loop/hethel-phase5g-a20-fresh-selective-v4-r1` -> disengagement, forced n/a, asserted n/a
- Comparator: `exports/dramatic-derivation/episodes/phase6-hethel-progress-policy-replay-from-t4` -> cap_reached; prefix ok
- Comparator: `exports/dramatic-derivation/episodes/phase6-hethel-safe-now-replay-from-t4` -> aporia; prefix ok
- Comparator: `exports/dramatic-derivation/episodes/phase6-hethel-entitlement-replay-from-t4` -> cap_reached; prefix ok

## Primary Trigger

- Trigger turn: 4
- Prefix through turn: 3
- Primary label: `release_starvation`
- Secondary labels: diagnostic_overuse
- Interpretation: The successful hidden+proofDebt run releases the proof-critical p_point on schedule; the failed overlay keeps asking/holding and delays the release, so D does not fall at the trigger.

## Turn Table

| turn | hidden D | hidden action | failed D | failed action | failed learner summary | note |
|---:|---:|---|---:|---|---|---|
| 1 | 5 | consolidate_subproof:- | 5 | consolidate_subproof:- | Aye, tutor — the bond in the warden's chest names Reyner answerable for the cost, but that is a different page from the one I must keep tod... | no_policy_trigger |
| 2 | 5 | consolidate_subproof:m_record | 5 | ask_diagnostic:m_record; policy=ask_diagnostic/visible_hidden_conflict | The seal and the bond put Reyner answerable for the cost — that much the rules will bear — but the rules themselves say plainly that liabil... | visible_hidden_conflict |
| 3 | 5 | ask_diagnostic:m_record | 5 | ask_diagnostic:m_record; policy=ask_diagnostic/visible_hidden_conflict | The first paper — Reyner's seal and bond — proves two things: that he is builder of record for this span, and that his bond makes him the o... | visible_hidden_conflict |
| 4 | 4 | release_next_evidence:p_point; release=p_point; offset=0 | 5 | ask_diagnostic:m_record; policy=ask_diagnostic/visible_hidden_conflict | The first paper — Reyner's seal and bond — shows two things and no more: that he is mason of record for this span, and that his bond makes ... | PRIMARY DIVERGENCE |
| 5 | 4 | ask_diagnostic:p_point | 5 | ask_diagnostic:m_record; policy=ask_diagnostic/visible_hidden_conflict | The bond names the hand that answers — Reyner, master mason of record, sealed against the span's failing, and that much the warden's chest ... | p_point pushed: page stalling (3 turns since last release) |
| 6 | 4 | repair_dependency:p_point | 4 | release_next_evidence:p_point; release=p_point; policy=release_next_evidence/release_candidate_certified; offset=2 | The crown break fixes the place — the keystone, where the arch is most naked without its prop, and that much the warden's measure has settl... | release_candidate_certified |
| 7 | 4 | ask_diagnostic:m_yard | 4 | ask_diagnostic:p_point; policy=ask_diagnostic/visible_hidden_conflict | The measure shows the place: the keystone joint, the crown, where a green arch hangs most exposed without its prop — that much is fixed and... | visible_hidden_conflict |
| 8 | 4 | consolidate_subproof:m_bond | 4 | ask_diagnostic:m_bond; policy=ask_diagnostic/visible_hidden_conflict | The bond being unexpired is plain fact — the warden's chest holds it, and it settles who must answer in silver if the span failed through i... | visible_hidden_conflict |
| 9 | 3 | release_next_evidence:p_surface; release=p_surface; offset=0 | 4 | ask_diagnostic:m_bond; policy=ask_diagnostic/visible_hidden_conflict | The last paper — the bond — proves two things cleanly and no more: that Reyner stood as master of record for this span, and that his surety... | p_surface pushed: page stalling (lines shortening -24.5) |
| 10 | 3 | ask_diagnostic:p_surface | 4 | ask_diagnostic:p_point; policy=ask_diagnostic/visible_hidden_conflict | Neither the bond nor the crown break proves the cause — the bond answers only in silver, and the crown break names only where the span gave... | p_surface pushed: page stalling (lines shortening -22.5) |
| 11 | 3 | consolidate_subproof:- | 4 | release_next_evidence:p_surface; release=p_surface; policy=release_next_evidence/release_candidate_certified; offset=2 | The mortar has spoken, and it clears the builder — a sound arch, never a bad course, only its props drawn too soon from under green lime. T... | release_candidate_certified |
| 12 | 3 | consolidate_subproof:- | n/a |   | n/a | n/a |

## Comparator Snapshot

| run | verdict | t4 action | t4 D | release deviations | later failure signal |
|---|---|---|---:|---|---|
| phase6-hethel-progress-policy-replay-from-t4 | cap_reached | release_next_evidence:p_point; release=p_point; policy=release_next_evidence/progress_pressure_release | 4 | held=0, early=1 | cap reached before grounding |
| phase6-hethel-safe-now-replay-from-t4 | aporia | release_next_evidence:p_point; release=p_point; policy=release_next_evidence/progress_pressure_release | 4 | held=0, early=0 | aporia |
| phase6-hethel-entitlement-replay-from-t4 | cap_reached | release_next_evidence:p_point; release=p_point; policy=release_next_evidence/progress_pressure_release | 4 | held=0, early=0 | cap reached before grounding |

## Interpretation

The first material divergence is not a new world type. It is a concrete action choice at a proof-critical release point: hidden+proofDebt releases `p_point`; the failed overlay spends the turn on diagnostic/consolidation pressure and delays the release.
This supports A21 as an action-value microbench: compare candidate actions from the same t4 prefix before proposing any runtime policy patch.
