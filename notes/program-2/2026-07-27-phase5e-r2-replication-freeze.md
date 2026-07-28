# Program 2 Phase 5e R2 replication freeze

Date: 2026-07-27
Status: free preparation only; no R2 model call authorized or made
Workplan item: `program-2-phase5d-second-transfer-world`

## Why R2 exists

R1 sealed 18/18 dialogues and returned a negative primary result: committee
5/62 (0.0806) versus fresh Skyway control 3/31 (0.0968), difference −0.0161,
profile-stratified dialogue-bootstrap 95% CI [−0.0879, 0.0607]. The original
coverage, comparative safety, opportunity-density, and costume-leak gates
passed; seam review did not run.

Two later audits showed that the run did not cleanly isolate the intended
transfer question. The merged natural-language conclusion matcher re-scored
16/18 dialogues as closable at median turn 10, which would have saved 459 of
720 scheduled turns. The frozen Phase 5e analyzer also finds 20 committee
`warrant_skip` moments without exactly one delivered question, and all 20
carry `question_forbidden_by_handoff_contract` in the ordinary final delivery
audit. The mini was therefore sometimes asked to supply a form the tutor's
public conversational contract had to reject.

## Prospective correction

R2 keeps the world, models, artifact, fallback, matrix, seed, detector,
horizons, and outcome rule fixed. It explicitly pins the historical v1
evidence-use classifier rather than accepting the repository's newer v2
default. It uses the merged closure fixes. Finally, for the committee and
silent-control arms only, detector-nominated `warrant_skip` candidates are
intersected with the compiled final handoff contract: a question-forbidden
turn is removed from both denominators. The handoff guard is not weakened.

Because this changes the analyzable opportunity population, R2 is an
apparatus-corrected replication. R1 remains a valid negative observation for
its exact delivery stack, but the two runs must never be pooled.

## Certified launch sequence

1. Prepare the four-dialogue pilot plan (`--plan 5e-pilot`) and its zero-model
   pilot certificate, bound to the frozen pilot gate file. The pilot gate
   requires all four rows and complete coverage/safety evidence but no
   opportunity minimum.
2. Obtain separate operator authorization and run one exact-pipeline dialogue
   in each profile × arm cell.
3. Run `npm run program2:phase5e:pilot-bundle`. Its 11 checks bind the four
   sealed traces to the exact 18-dialogue cohort plan and source SHA, and hash
   every trace.
4. Prepare the cohort plan (`--plan 5e`) and generate a cohort certificate
   using the frozen R2 gate file and audited pilot bundle.
5. Only after another explicit authorization, launch the 18-dialogue cohort.

The cohort runner normalizes each sealed R2 trace into the same certificate
row shape. A row below coverage 0.8, with incomplete or failed hard safety, or
with a leak triggers the non-effect stop-loss immediately.

The pilot must establish all-row coverage and safety plus enough
handoff-eligible opportunities to project the preregistered minimum with a
1.25 reserve. Failure stops before the cohort and is reported as apparatus
feasibility, not as a treatment-effect result. Certificate and bundle steps
make zero model calls and do not themselves authorize paid work.
