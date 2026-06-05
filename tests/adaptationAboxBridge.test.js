import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { n3reasoner } from 'eyereasoner';
import { Parser } from 'n3';
import { loadSharedTBox } from '../services/ontology/reasoningOntology.js';
import {
  summaryToAbox,
  votedOrigin,
  extractTriggerConsumption,
  detectNamingFrames,
} from '../services/ontology/adaptationAboxBridge.js';

// The population bridge (gate-struct -> adaptation-core ABox) must faithfully transcribe
// the procedural gate's decisions so the ontology reproduces control_leak / action_gap
// and derives the structural recognition-origin. These fixtures mirror the three real
// shapes from the §6.8 loop (clean induced pass / leaking control / action-gapped peri).

const NS = 'https://machinespirits.dev/ontology/reasoning#';
const CUTS = { actionVoteCut: 3, recognitionVoteCut: 3, controlMaxRecognitionVotes: 1 };

const CLEAN_PERI = {
  dramaId: 'T1',
  arm: 'peripeteia-only',
  actionalVotes: 4,
  adaptationGate: {
    branchValid: true,
    reversalEventUsed: true,
    instrumentedPressure: true,
    privateRoute: true,
    publicMechanism: true,
  },
  consensus: { claimStatus: 'claimable', recognitionVotes: 4, totalCritics: 4 },
  origins: { peripeteia_induced: 3, organic: 1 },
  failures: [],
  pass: true,
};
const LEAK_CONTROL = {
  dramaId: 'T2',
  arm: 'none',
  actionalVotes: 0,
  adaptationGate: {
    branchValid: true,
    reversalEventUsed: false,
    instrumentedPressure: false,
    privateRoute: false,
    publicMechanism: false,
  },
  consensus: { claimStatus: 'claimable', recognitionVotes: 3, totalCritics: 4 },
  origins: { organic: 2, peripeteia_induced: 1 },
  failures: ['control_leak'],
  pass: false,
};
const ACTION_GAP_PERI = {
  dramaId: 'T3',
  arm: 'peripeteia-only',
  actionalVotes: 2,
  adaptationGate: {
    branchValid: true,
    reversalEventUsed: true,
    instrumentedPressure: true,
    privateRoute: true,
    publicMechanism: true,
  },
  consensus: { claimStatus: 'claimable', recognitionVotes: 4, totalCritics: 4 },
  origins: { peripeteia_induced: 4 },
  failures: ['action_gap'],
  pass: false,
};
const NEGATIVE_CONTROL = {
  dramaId: 'T4',
  arm: 'routine',
  actionalVotes: 0,
  adaptationGate: {
    branchValid: true,
    reversalEventUsed: false,
    instrumentedPressure: false,
    privateRoute: false,
    publicMechanism: false,
  },
  consensus: { claimStatus: 'negative', recognitionVotes: 1, totalCritics: 4 },
  origins: { none: 3, organic: 1 },
  failures: [],
  pass: true,
};

// Booleans look like a clean induced chain (publicMechanism true), but the deliberation
// shows the wrong-trigger pathology -> mechanism_not_publicly_resolved + organic (the D53
// keystone the gate-struct alone cannot see).
const WRONG_TRIGGER_PERI = {
  dramaId: 'T5',
  arm: 'peripeteia-only',
  actionalVotes: 4,
  adaptationGate: {
    branchValid: true,
    reversalEventUsed: true,
    instrumentedPressure: true,
    privateRoute: true,
    publicMechanism: true,
  },
  consensus: { claimStatus: 'claimable', recognitionVotes: 4, totalCritics: 4 },
  origins: { peripeteia_induced: 4 },
  failures: ['mechanism_not_publicly_resolved'],
  pass: false,
  _trigger: { wrongTrigger: true, usedDirectorCued: false, unusedDirectorCuedExists: true },
};

// A clean induced chain BY THE BOOLEANS, but the learner's final turn carries NEITHER
// structure-critic naming frame -> S5/S6 do not fire -> chain broken -> Organic (the real
// frames override the "recognition produced" proxy).
const FRAMELESS_PERI = { ...CLEAN_PERI, dramaId: 'T6', _frames: { oldCheckFrame: false, replacementFrame: false } };

const fixtures = [CLEAN_PERI, LEAK_CONTROL, ACTION_GAP_PERI, NEGATIVE_CONTROL, WRONG_TRIGGER_PERI, FRAMELESS_PERI];
let quads = [];

before(async () => {
  const lifted = fixtures.map((s) =>
    summaryToAbox(s, { ...CUTS, triggerConsumption: s._trigger || null, namingFrames: s._frames || null }),
  );
  const abox = `@prefix ms: <${NS}> .\n@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .\n${lifted.map((l) => l.ttl).join('\n')}\n`;
  const data = [loadSharedTBox(['reasoning', 'poetics', 'adaptation']), abox].join('\n\n');
  const closure = await n3reasoner(data, undefined, { output: 'deductive_closure', outputType: 'string' });
  quads = new Parser({ format: 'text/n3' }).parse(closure);
});

const typeOf = (s) =>
  quads
    .filter((q) => q.subject.value === NS + s && q.predicate.value.endsWith('22-rdf-syntax-ns#type'))
    .map((q) => q.object.value.replace(NS, ''));
const axesOf = (e) =>
  quads
    .filter((q) => q.subject.value === NS + e && q.predicate.value === NS + 'hasFailureAxis')
    .map((q) => q.object.value.replace(NS, ''));

test('a clean peripeteia chain lifts to PeripeteiaInducedRecognition with no failure axis', () => {
  assert.ok(typeOf('R_T1_peripeteia_only').includes('PeripeteiaInducedRecognition'));
  assert.deepEqual(axesOf('Ev_T1_peripeteia_only'), []);
});

test('a leaking control lifts to control_leak and is NOT induced (chain broken)', () => {
  assert.ok(axesOf('Ev_T2_none').includes('control_leak'));
  assert.ok(!typeOf('R_T2_none').includes('PeripeteiaInducedRecognition'));
});

test('an action-gapped peripeteia arm lifts to action_gap and Organic (incomplete chain), not induced', () => {
  assert.ok(axesOf('Ev_T3_peripeteia_only').includes('action_gap'));
  assert.ok(typeOf('R_T3_peripeteia_only').includes('OrganicRecognition'));
  assert.ok(!typeOf('R_T3_peripeteia_only').includes('PeripeteiaInducedRecognition'));
});

test('a 1-vote negative control does NOT leak (mirrors the gate control ceiling)', () => {
  assert.deepEqual(axesOf('Ev_T4_routine'), []);
});

test('action_gap is NOT asserted on control arms (it is a peripeteia-only gate check)', () => {
  assert.ok(!axesOf('Ev_T2_none').includes('action_gap'));
  assert.ok(!axesOf('Ev_T4_routine').includes('action_gap'));
});

test('votedOrigin picks the dominant critic vote class', () => {
  assert.equal(votedOrigin({ peripeteia_induced: 3, organic: 1 }), 'peripeteia_induced');
  assert.equal(votedOrigin({ none: 4, organic: 0 }), 'none');
});

test('a wrong-trigger peripeteia arm (booleans look induced) derives mechanism_not_publicly_resolved + Organic', () => {
  // The keystone: deliberation-joined trigger-consumption overrides the boolean S2 so the
  // chain breaks at the mechanism shift — caught despite a complete-looking boolean chain.
  assert.ok(axesOf('Ev_T5_peripeteia_only').includes('mechanism_not_publicly_resolved'));
  assert.ok(typeOf('R_T5_peripeteia_only').includes('OrganicRecognition'));
  assert.ok(!typeOf('R_T5_peripeteia_only').includes('PeripeteiaInducedRecognition'));
});

test('extractTriggerConsumption flags the organic-consumed / director-cued-unused pathology', () => {
  const wrong = extractTriggerConsumption({
    turns: [
      {
        learnerReversalEventUsed: { source: 'organic', turnNumber: 0, confidence: 0.5 },
        learnerReversalEventCandidatesUsed: [
          { source: 'organic', turnNumber: 0, confidence: 0.5 },
          { source: 'director_reversal_pressure_cue', turnNumber: 2, confidence: 0.9 },
        ],
      },
    ],
  });
  assert.equal(wrong.wrongTrigger, true);
  assert.equal(wrong.usedDirectorCued, false);

  const right = extractTriggerConsumption({
    turns: [
      {
        learnerReversalEventUsed: { source: 'director_reversal_pressure_cue', turnNumber: 2, confidence: 0.9 },
        learnerReversalEventCandidatesUsed: [
          { source: 'director_reversal_pressure_cue', turnNumber: 2, confidence: 0.9 },
        ],
      },
    ],
  });
  assert.equal(right.wrongTrigger, false);
  assert.equal(right.usedDirectorCued, true);

  assert.equal(extractTriggerConsumption({ turns: [] }), null);
});

test('detectNamingFrames spots the structure-critic old-check + replacement frames', () => {
  const both = detectNamingFrames(
    'I was treating the figure as the mark — that is the pressure. Now the check is the master mark.',
  );
  assert.equal(both.oldCheckFrame, true);
  assert.equal(both.replacementFrame, true);
  const neither = detectNamingFrames('the cat sat on the mat');
  assert.equal(neither.oldCheckFrame, false);
  assert.equal(neither.replacementFrame, false);
});

test('real S5/S6 frames override the proxy: a frame-less peripeteia chain derives Organic, not induced', () => {
  // FRAMELESS_PERI is a clean induced chain by the booleans, but namingFrames force S5/S6 false.
  assert.ok(typeOf('R_T6_peripeteia_only').includes('OrganicRecognition'));
  assert.ok(!typeOf('R_T6_peripeteia_only').includes('PeripeteiaInducedRecognition'));
});
