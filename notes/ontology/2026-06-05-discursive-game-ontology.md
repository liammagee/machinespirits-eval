# Discursive-Game Ontology Bridge

Date: 2026-06-05

This note records the ontology bridge added in `config/ontology/discursive-game-core.ttl` and `config/ontology/discursive-game-rules.n3`.

## Claim Boundary

The bridge is a construct-boundary vocabulary, not a new empirical claim. It does not show that the current tutor is genuinely adaptive, deployed, or human-validated. It defines what a transcript must make inspectable before we can call an episode accountably adaptive.

The target construct is:

```text
accountable discursive adaptation =
  learner signal
  -> evidence-bound tutor hypothesis
  -> finite tactic / policy selection
  -> public tutor move
  -> learner uptake or contest
  -> subsequent tutor revision accountable to that uptake or contest
```

## Layering

### Poetic Strategy

Aristotelian poetics supplies the high-level dramatic grammar: peripeteia, anagnorisis, catharsis, unity of action, and the ending shape of a scene. This layer asks what kind of dramatic episode the dialogue is becoming.

New ontology class: `ms:DramaticStrategy`

Representative strategies:

- `ms:ConvertComplianceToOwnership`
- `ms:RepairMisrecognitionStrategy`
- `ms:ExposeHiddenDependence`
- `ms:ShiftAuthorityToReasonGiving`

### Discursive Tactic

Late Wittgenstein supplies the local grammar of public language use. A tutor utterance is not only a sentence with content; it is a move in a language game.

New ontology classes:

- `ms:DiscursiveGame`
- `ms:DiscursiveTactic`
- `ms:PublicMove`
- `ms:TutorPublicMove`
- `ms:LearnerPublicMove`

Representative games:

- `ms:GivingAndAskingForReasons`
- `ms:MisrecognitionRepairGame`
- `ms:ObjectCheckGame`
- `ms:RevoiceGame`

Existing policy-action individuals such as `ms:request_elaboration`, `ms:invite_objection`, `ms:scope_test`, and `ms:repair_misrecognition` are now also typed as `ms:DiscursiveTactic`.

### Scorekeeping

Brandom supplies the normative machinery: commitments, entitlements, challenges, reason requests, reason offers, uptake, and contest.

New ontology classes:

- `ms:ScorekeepingEvent`
- `ms:Commitment`
- `ms:Entitlement`
- `ms:NormativeDelta`
- `ms:LearnerSignal`
- `ms:LearnerUptake`
- `ms:LearnerContest`

This layer prevents "adaptation" from collapsing into tone shift, longer explanation, or private tutor self-reflection.

### Pedagogical Control

The implementation-facing layer binds the above to the controller idea already present in the next-steps work:

- `ms:EvidenceBoundHypothesis`
- `ms:PolicyCommitment`
- `ms:SelectedPolicyAction`
- `ms:TutorRevision`
- `ms:AccountableTutorRevision`
- `ms:AccountableScorekeepingEpisode`
- `ms:DyadicRevision`

## Derived Gates

The rules are monotonic and positive-only:

- A move becomes `ms:ResponsiveMove` only when it responds to a learner signal and is licensed by that same evidence.
- A repair becomes `ms:AccountableRepair` only when it addresses a breakdown and elicits learner uptake or contest.
- A repair with `ms:lacksUptake true` becomes `ms:RepairWithoutUptake`, not recognition credit.
- An episode becomes `ms:AccountableScorekeepingEpisode` when it has the full signal -> hypothesis -> public action -> uptake chain.
- An episode becomes `ms:DyadicRevision` only when a later tutor revision is accountable to the observed learner uptake or contest and changes a role view.

## Why This Helps

The prior mechanisms often produced local responsiveness without accountable scorekeeping. The bridge makes the missing middle explicit: a tutor may repair, but the repair does not count as discursive adaptation unless learner uptake or contest becomes public evidence for later tutor revision.

This should support cheap offline replay before new generation: existing transcripts can be annotated for learner signal, hypothesis, tactic, public action, uptake/contest, and revision. That screen can identify where one-pass rewriting might improve public accountability without claiming online adaptation.

## Feasible Offline Revision Design

A Codex-CLI replay pass over existing transcripts is feasible if it is treated as counterfactual revision, not as a new tutor run.

Recommended artifact contract:

```text
input:
  original public transcript
  allowed held-out inner state / deliberation
  director card and key metadata
  discursive-game ontology summary

output:
  revised public transcript copy
  move ledger: signal, evidence quote, hypothesis, tactic, public action, uptake/contest, revision
  hidden-state use ledger: which private facts influenced revision
  non-leakage check: no hidden-only fact appears as public tutor knowledge unless public evidence licenses it
```

This is cheaper than whole-dialogue regeneration because one model rewrites a bounded artifact once. It also avoids re-running the learner, tutor ego, tutor superego, director, and critics as separate actors.

Limits:

- It is post-hoc and cannot prove online adaptation.
- It can test whether the transcript can be made scorekeeping-accountable.
- It can compare original vs revised text under blind scoring if the revised copy is packaged as a new artifact arm.
- It must preserve a pointer to the original transcript and keep the original immutable.
