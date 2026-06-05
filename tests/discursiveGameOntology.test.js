import assert from 'node:assert/strict';
import test from 'node:test';
import { checkAboxConsistency } from '../services/ontology/reasoningOntology.js';

const ABOX_PREFIXES = [
  '@prefix ms: <https://machinespirits.dev/ontology/reasoning#> .',
  '@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .',
].join('\n');

function assertClosureTriple(closureText, subject, predicate, object) {
  assert.ok(
    closureText.includes(`ms:${subject} ${predicate} ms:${object}.`),
    `expected closure triple: ms:${subject} ${predicate} ms:${object}.`,
  );
}

test('discursive-game ontology derives accountable dyadic revision from scorekeeping facts', async () => {
  const abox = `${ABOX_PREFIXES}
ms:signal1 rdf:type ms:BreakdownSignal ;
  ms:hasEvidenceText "The lower decimal still feels like another label." .

ms:hypothesis1 rdf:type ms:EvidenceBoundHypothesis ;
  ms:licensedByEvidence ms:signal1 ;
  ms:supportedByQuote "The lower decimal still feels like another label." .

ms:policy1 rdf:type ms:SelectedPolicyAction ;
  ms:selectsTactic ms:scope_test ;
  ms:selectedBecauseOf ms:hypothesis1 .

ms:tutorMove1 rdf:type ms:TutorPublicMove, ms:RepairMove ;
  ms:respondsTo ms:signal1 ;
  ms:licensedByEvidence ms:signal1 ;
  ms:enactsPolicy ms:policy1 ;
  ms:addressesBreakdown ms:signal1 ;
  ms:elicitsUptake ms:uptake1 .

ms:uptake1 rdf:type ms:LearnerContest ;
  ms:offersReasonFor ms:commitment1 .

ms:application1 rdf:type ms:LearnerActionalApplication ;
  ms:offersReasonFor ms:commitment1 .

ms:selfReframe1 rdf:type ms:LearnerSelfReframe ;
  ms:namesOldWarrant "I was using the spacing as the check." ;
  ms:namesWarrantLimit "The spacing does not explain why the decimal counts as mass." ;
  ms:namesNewWarrant "The number-only gate checks number type rather than word label." ;
  ms:appliesNewWarrant "6 goes under atomic number and 12.01 goes under atomic mass." .

ms:revision1 rdf:type ms:TutorRevision ;
  ms:accountableTo ms:uptake1 ;
  ms:changesRoleView ms:ThinkingPartner ;
  ms:revisesCommitment ms:commitment1 .

ms:episode1 ms:hasLearnerSignal ms:signal1 ;
  ms:hasTutorHypothesis ms:hypothesis1 ;
  ms:hasTutorAction ms:tutorMove1 ;
  ms:observesUptake ms:uptake1 ;
  ms:hasLearnerActionalApplication ms:application1 ;
  ms:hasLearnerSelfReframe ms:selfReframe1 ;
  ms:hasTutorRevision ms:revision1 .`;

  const result = await checkAboxConsistency(abox, {
    modules: ['reasoning', 'poetics', 'discursive', 'consistency'],
    includeClosure: true,
  });

  assert.equal(result.consistent, true);
  assertClosureTriple(result.closureText, 'episode1', 'a', 'AccountableScorekeepingEpisode');
  assertClosureTriple(result.closureText, 'episode1', 'a', 'DyadicRevision');
  assertClosureTriple(result.closureText, 'selfReframe1', 'a', 'CompleteLearnerSelfReframe');
  assertClosureTriple(result.closureText, 'tutorMove1', 'a', 'ResponsiveMove');
  assertClosureTriple(result.closureText, 'tutorMove1', 'a', 'AccountableRepair');
  assertClosureTriple(result.closureText, 'tutorMove1', 'ms:participatesInGame', 'ObjectCheckGame');
  assertClosureTriple(result.closureText, 'revision1', 'a', 'AccountableTutorRevision');
});

test('discursive-game ontology with actional uptake but no self-reframe does not derive dyadic revision', async () => {
  const abox = `${ABOX_PREFIXES}
ms:signal3 rdf:type ms:BreakdownSignal ;
  ms:hasEvidenceText "The arrowheads are not enough for the check." .

ms:hypothesis3 rdf:type ms:EvidenceBoundHypothesis ;
  ms:licensedByEvidence ms:signal3 ;
  ms:supportedByQuote "The arrowheads are not enough for the check." .

ms:tutorMove3 rdf:type ms:TutorPublicMove ;
  ms:respondsTo ms:signal3 ;
  ms:licensedByEvidence ms:signal3 ;
  ms:elicitsUptake ms:application3 .

ms:application3 rdf:type ms:LearnerActionalApplication ;
  ms:offersReasonFor ms:commitment3 .

ms:revision3 rdf:type ms:TutorRevision ;
  ms:accountableTo ms:application3 ;
  ms:changesRoleView ms:ThinkingPartner .

ms:episode3 ms:hasLearnerSignal ms:signal3 ;
  ms:hasTutorHypothesis ms:hypothesis3 ;
  ms:hasTutorAction ms:tutorMove3 ;
  ms:observesUptake ms:application3 ;
  ms:hasLearnerActionalApplication ms:application3 ;
  ms:hasTutorRevision ms:revision3 .`;

  const result = await checkAboxConsistency(abox, {
    modules: ['reasoning', 'poetics', 'discursive', 'consistency'],
    includeClosure: true,
  });

  assert.equal(result.consistent, true);
  assertClosureTriple(result.closureText, 'episode3', 'a', 'AccountableScorekeepingEpisode');
  assert.doesNotMatch(result.closureText, /ms:episode3 a ms:DyadicRevision\./);
});

test('discursive repair without uptake stays marked as no-credit repair', async () => {
  const abox = `${ABOX_PREFIXES}
ms:tutorMove2 rdf:type ms:RepairMove ;
  ms:lacksUptake true .`;

  const result = await checkAboxConsistency(abox, {
    modules: ['reasoning', 'poetics', 'discursive', 'consistency'],
    includeClosure: true,
  });

  assert.equal(result.consistent, true);
  assertClosureTriple(result.closureText, 'tutorMove2', 'a', 'RepairWithoutUptake');
  assert.doesNotMatch(result.closureText, /ms:tutorMove2 a ms:AccountableRepair\./);
});
