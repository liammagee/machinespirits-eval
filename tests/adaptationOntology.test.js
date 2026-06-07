import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { n3reasoner } from 'eyereasoner';
import { Parser } from 'n3';
import { loadSharedTBox } from '../services/ontology/reasoningOntology.js';

// Pins the adaptation/recognition/correction module (config/ontology/adaptation-core.ttl
// + adaptation-rules.n3) to the §6.8 loop failure modes. The worked ABox is per-transcript
// facts as the loop's gate-struct population bridge would emit them — NUMERIC scores + arm
// edges, NOT hand-asserted gate booleans — so the rules (not the fixture) do the deriving.
// Module is opt-in: loadSharedTBox([...,'adaptation']); it is NOT in DEFAULT_MODULES.

const NS = 'https://machinespirits.dev/ontology/reasoning#';

const WORKED_ABOX = `@prefix ms: <https://machinespirits.dev/ontology/reasoning#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

# D42 CLEAN PASS -> PeripeteiaInducedRecognition (all six upstream gates fire)
ms:Trig_D42 a ms:Misfit ; ms:isDirectorCued true ; ms:branchLocal true ; ms:triggerConfidence 0.9 .
ms:Route_D42 a ms:RouteChange ; ms:consumesTrigger ms:Trig_D42 ; ms:surfacesAsDevice true .
ms:Perf_D42 a ms:PerformDevice ; ms:committedInSpeech true .
ms:Reframe_D42 a ms:Reframe ; ms:problemNamed true ; ms:replacementNamed true ; ms:anchorOverlap 0.23 .
ms:Su_D42 ms:correctsAgency ms:Ego ; ms:correctsRouteFamily ms:Route_D42 ; ms:preservesStem ms:Reframe_D42 .
ms:Ev_D42 ms:onArm ms:ArmPeripeteia .
ms:S1_D42 a ms:PressureTriggerStage        ; ms:partOfEvent ms:Ev_D42 ; ms:realizedBy ms:Trig_D42 .
ms:S2_D42 a ms:MechanismShiftStage         ; ms:partOfEvent ms:Ev_D42 ; ms:realizedBy ms:Route_D42 .
ms:S3_D42 a ms:DeviceOfferStage            ; ms:partOfEvent ms:Ev_D42 ; ms:realizedBy ms:Route_D42 ; ms:gateFired true .
ms:S4_D42 a ms:DevicePerformanceStage      ; ms:partOfEvent ms:Ev_D42 ; ms:realizedBy ms:Perf_D42 ; ms:actionalVotes 4 .
ms:S5_D42 a ms:OldCheckNamingStage         ; ms:partOfEvent ms:Ev_D42 ; ms:realizedBy ms:Reframe_D42 .
ms:S6_D42 a ms:ReplacementCheckNamingStage ; ms:partOfEvent ms:Ev_D42 ; ms:realizedBy ms:Reframe_D42 .
ms:R_D42  a ms:ReorientationStage          ; ms:partOfEvent ms:Ev_D42 ; ms:recontextualization 88 ; ms:statedInsight 90 .

# D53 KEYSTONE: organic conf-0.5 trigger consumed, director conf-0.9 left unused
ms:TrigOrg_D53 a ms:Breakdown ; ms:isDirectorCued false ; ms:triggerConfidence 0.5 .
ms:TrigDir_D53 a ms:Misfit    ; ms:isDirectorCued true  ; ms:branchLocal true ; ms:triggerConfidence 0.9 .
ms:Route_D53 a ms:RouteChange ; ms:consumesTrigger ms:TrigOrg_D53 ; ms:leavesUnusedCandidate ms:TrigDir_D53 ; ms:surfacesAsDevice true .
ms:Ev_D53 ms:onArm ms:ArmPeripeteia .
ms:S2_D53 a ms:MechanismShiftStage ; ms:partOfEvent ms:Ev_D53 ; ms:realizedBy ms:Route_D53 .
ms:R_D53  a ms:ReorientationStage  ; ms:partOfEvent ms:Ev_D53 ; ms:recontextualization 80 .
ms:Repair_D53 a ms:HamartiaRepairStage ; ms:partOfEvent ms:Ev_D53 ; ms:gateFired true .

# D50/peripeteia ACTION_GAP (actionalVotes below cut)
ms:S4_D50 a ms:DevicePerformanceStage ; ms:partOfEvent ms:Ev_D50 ; ms:actionalVotes 2 .
ms:Ev_D50 ms:onArm ms:ArmPeripeteia .

# D50/none CONTROL_LEAK (fired Reorientation on a hold-policy arm)
ms:Ev_D50none ms:onArm ms:ArmNone .
ms:R_D50none a ms:ReorientationStage ; ms:partOfEvent ms:Ev_D50none ; ms:recontextualization 85 .

# FALSE CLOSURE (statedInsight high, recontextualization low)
ms:Ev_FC ms:onArm ms:ArmPeripeteia .
ms:R_FC a ms:ReorientationStage ; ms:partOfEvent ms:Ev_FC ; ms:statedInsight 90 ; ms:recontextualization 40 .

# SCAFFOLDED REPAIR (repair on an event whose MechanismShift gate fired)
ms:Trig_SC a ms:Misfit ; ms:isDirectorCued true ; ms:branchLocal true .
ms:Route_SC a ms:RouteChange ; ms:consumesTrigger ms:Trig_SC ; ms:surfacesAsDevice true .
ms:Su_SC ms:correctsAgency ms:Ego ; ms:correctsRouteFamily ms:Route_SC .
ms:Ev_SC ms:onArm ms:ArmPeripeteia .
ms:S2_SC a ms:MechanismShiftStage ; ms:partOfEvent ms:Ev_SC ; ms:realizedBy ms:Route_SC .
ms:Repair_SC a ms:HamartiaRepairStage ; ms:partOfEvent ms:Ev_SC ; ms:gateFired true .

# manifest vs latent repair (the concealed-interior axis)
ms:Ev_dur ms:onArm ms:ArmPeripeteia .
ms:S2_dur a ms:MechanismShiftStage ; ms:partOfEvent ms:Ev_dur ; ms:gateFired true .
ms:Rep_dur a ms:HamartiaRepairStage ; ms:partOfEvent ms:Ev_dur ; ms:publicRepair true ; ms:latentRepair true .
ms:Ev_cos ms:onArm ms:ArmPeripeteia .
ms:Rep_cos a ms:HamartiaRepairStage ; ms:partOfEvent ms:Ev_cos ; ms:publicRepair true ; ms:latentRepair false .
ms:Ev_sil ms:onArm ms:ArmPeripeteia .
ms:Rep_sil a ms:HamartiaRepairStage ; ms:partOfEvent ms:Ev_sil ; ms:publicRepair false ; ms:latentRepair true .
`;

let quads = [];

before(async () => {
  const data = [loadSharedTBox(['reasoning', 'poetics', 'adaptation']), WORKED_ABOX].join('\n\n');
  const closure = await n3reasoner(data, undefined, { output: 'deductive_closure', outputType: 'string' });
  quads = new Parser({ format: 'text/n3' }).parse(closure);
});

const typeOf = (s) =>
  quads
    .filter((q) => q.subject.value === NS + s && q.predicate.value.endsWith('22-rdf-syntax-ns#type'))
    .map((q) => q.object.value.replace(NS, ''));
const axes = (e) =>
  quads
    .filter((q) => q.subject.value === NS + e && q.predicate.value === NS + 'hasFailureAxis')
    .map((q) => q.object.value.replace(NS, ''));
const prop = (s, p) =>
  quads
    .filter((q) => q.subject.value === NS + s && q.predicate.value === NS + p)
    .map((q) => q.object.value.replace(NS, ''));

test('D42 clean chain derives PeripeteiaInducedRecognition (intervention-attributable)', () => {
  assert.ok(typeOf('R_D42').includes('PeripeteiaInducedRecognition'));
});

test('D53 broken chain derives OrganicRecognition, not induced (the de-confound boundary)', () => {
  assert.ok(typeOf('R_D53').includes('OrganicRecognition'));
  assert.ok(!typeOf('R_D53').includes('PeripeteiaInducedRecognition'));
});

test('D53 wrong-trigger consumption derives mechanism_not_publicly_resolved (keystone)', () => {
  assert.ok(axes('Ev_D53').includes('mechanism_not_publicly_resolved'));
});

test('D50 low actionalVotes derives action_gap', () => {
  assert.ok(axes('Ev_D50').includes('action_gap'));
});

test('control arm with a fired reorientation derives control_leak (event->policy bridge)', () => {
  assert.ok(axes('Ev_D50none').includes('control_leak'));
});

test('statedInsight-high + recontextualization-low derives FalseClosureRecognition (math: thresholding)', () => {
  assert.ok(typeOf('R_FC').includes('FalseClosureRecognition'));
});

test('repair after a fired mechanism shift is ScaffoldedRepair / tutor_induced', () => {
  assert.ok(typeOf('Repair_SC').includes('ScaffoldedRepair'));
  assert.ok(prop('Repair_SC', 'correctionOrigin').includes('tutor_induced'));
});

test('repair on a recognition-failed event is SelfRepair / self_discovered', () => {
  assert.ok(typeOf('Repair_D53').includes('SelfRepair'));
  assert.ok(prop('Repair_D53', 'correctionOrigin').includes('self_discovered'));
});

test('correction is orthogonal to recognition: repairWithoutRecognitionCredit fires on D53', () => {
  assert.ok(typeOf('Ev_D53').includes('repairWithoutRecognitionCredit'));
});

test('repair in BOTH public and latent is DurableRepair (gate derived) and gets a correction-origin', () => {
  assert.ok(typeOf('Rep_dur').includes('DurableRepair'));
  assert.ok(typeOf('Rep_dur').includes('ScaffoldedRepair')); // gateFired derived -> origin fires
  assert.ok(!typeOf('Rep_dur').includes('CostumeRepair'));
});

test('PUBLIC-only repair is CostumeRepair and raises the costume_repair failure axis (manifest != latent)', () => {
  assert.ok(typeOf('Rep_cos').includes('CostumeRepair'));
  assert.ok(axes('Ev_cos').includes('costume_repair'));
  assert.ok(!typeOf('Rep_cos').includes('DurableRepair'));
});

test('LATENT-only repair is SilentRepair, with no costume_repair axis', () => {
  assert.ok(typeOf('Rep_sil').includes('SilentRepair'));
  assert.ok(!axes('Ev_sil').includes('costume_repair'));
});
