GO

# Frame-refuser satisfiable-condition calibration: technical recovery

Operator: Liam Magee  
Date: 2026-08-29  
Authorization source: Liam Magee's explicit launch directive plus the standing
technical-recovery authority  
Recorded by: Codex

Design file:
`config/tutor-stub-frame-refuser-satisfiable-design.v1.json`

Recovery launch commit:
`20c0846707da3032c334a48e341ea2e333c066e4`

Study:
`frame-refuser-satisfiable`

This note records exactly one replacement launch of the unchanged registered
calibration block: 48 dialogues, 24 per arm, twelve per world per arm, master
seed `2026083001`, and the model/provider routes fixed in the merged design.

Planned role calls: `3072`.  
Machine-readable hard spend ceiling: `9504` model-attempt reservations.

The original launch at commit
`c754ae7f3e59ea2ce731c976ee437ac94ef2fde0` halted before any provider call
because the launch admission check expected the predecessor learner-profile
identifier. Its failed artifacts are preserved in private archive commit
`64fd9821`. Pull request #866 corrected only that mechanical admission pin; it
did not change the study question, design, routes, seed, measurement rules,
data scope, or ceiling.

The replacement must use the shared paid-study contract: a clean detached
checkout of the recovery launch commit, a new create-once destination,
reserve-before-call accounting, and the append-only run ledger. A technical or
substantive halt ends this replacement launch under the registered
dispositions; valid outputs may not be rerun or selected among.

This GO covers the calibration recovery only. It does not authorize the
powered run, the separate narrowing-codebook reader calibration, a second
replacement launch, or any change to the design, routes, seed, measurement
rules, data scope, or ceiling.

Authorized by: Liam Magee, via the explicit task directive and standing
technical-recovery authority above.  
Recorded: 2026-08-29.
