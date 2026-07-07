# Strategy-ledger gates (zero-paid)

World: `config/drama-derivation/world-000-smoke.yaml` — mock roles / mock LLM client only.

| gate | ok | detail |
|---|---|---|
| L0-pending | PASS | confusion persists -> block stays open |
| L0-cleared | PASS | confusion clears on settled reasoning (confusion has passed) |
| L0-superseded | PASS | a resistance episode displaces a confusion block |
| L0-failed | PASS | budget exhaustion fails the block (exit condition did not clear within 3 turns) |
| L0-teachback | PASS | teach_back clears only on an own-words account |
| L0b-rows | PASS | engine sealed 3 block(s): confusion:cleared, resistance:failed, resistance:run_end |
| L0b-cleared | PASS | a block cleared through the live exit-condition check |
| L0b-terminal | PASS | an uncleared episode reached its budget or the run end |
| L0b-events | PASS | 5 block events on the record |
| L0b-counters | PASS | opportunity counters ran live with scene-exit resets (tutor proof-neutral count 2) |
| L1-commits | PASS | 4/4 scene openings committed |
| L1-palette | PASS | every committed register stays inside the offered palette |
| L1-register-applied | PASS | 4 scene register switch(es) applied by the engine |
| L1-register-held | PASS | committed register held for the scene and reverted at its close |
| L2-audits | PASS | 3/4 commitments audited (final scene's lapse expected) |
| L2-verdicts | PASS | audit verdicts stay inside the contract |
| L3-mock-cast | PASS | inline cast: ledger on/off proof fingerprints byte-identical |
| L3-llm-cast | PASS | llmRoles cast: ledger on/off proof fingerprints byte-identical |
| L4-intents | PASS | 4/4 scene openings carry a learner intent |
| L4-carries | PASS | 3 act carry-forward row(s) recorded |
| L4-symmetry | PASS | tutor and learner ledger rows share the identical field set |
| L4-intent-audits | PASS | 2/4 learner intents audited (act-bounded + final-scene lapses expected) |
| L5-history | PASS | 4 history entries for 4 scenes |
| L5-stance-committed | PASS | 4/4 commitments carry a stance |
| L5-fidelity-gate | PASS | fidelity labels: not_instantiated, not_applicable (mock lines carry no cues — non-faithful expected) |
| L5-review-loop | PASS | 3 review event(s); 3 history entr(ies) answered |
| L5-stance-audited | PASS | 3 stance clause(s) adjudicated |
| L5-intent-recorded | PASS | 4 commitment(s) carry a release intent |
| L5-intent-audited | PASS | 3 release-intent clause(s) adjudicated |
| L5-guards-untouched | PASS | release-authority cast: intent on/off proof fingerprints byte-identical |
| L7-stocktakes | PASS | 3 stock-take(s) across 4 scene openings |
| L7-no-commitments | PASS | commitment machinery fully suppressed under plan mode |
| L7-reorientation | PASS | 1 correction(s) demanded; every one answered with a reorientation |
| L7-fingerprint | PASS | plan mode on/off proof fingerprints byte-identical |

**34/34 checks passed.**

Scope: wiring gates only — no empirical claim. Proof control and the
release calendar are asserted untouched (L3); everything else is conduct.
