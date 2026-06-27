import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import { loadWorld } from '../services/dramaticDerivation/world.js';
import { buildSubjectState, reverse } from '../services/dramaticDerivation/beliefDesire.js';
import {
  compileLearnerDesire,
  compileTutorDesire,
  renderMotivationLines,
  learnerBindingAtTurn,
  learnerVoiceForWorld,
} from '../services/dramaticDerivation/characterDesire.js';

const world = (stem) => loadWorld(fileURLToPath(new URL(`../config/drama-derivation/${stem}.yaml`, import.meta.url)));
const marrick = world('world-005-marrick');
const lantern = world('world-002-lantern');
const aiSyllabus = world('world-016-ai-syllabus-af1');
const nocturne = world('world-001-nocturne'); // no motivation block — the fallback case

test('world carries the authored motivation block (validateWorld passes it through)', () => {
  assert.ok(marrick.motivation, 'world.motivation should be present');
  assert.equal(marrick.motivation.learner.first_order.opens_on, 'verrell');
});

test('compileLearnerDesire: the learner first-order desire opens MIRROR-bound, with second-order recognition', () => {
  const cd = compileLearnerDesire(marrick);
  const first = cd.nodes.find((n) => n.id === 'des:L:first');
  assert.equal(first.statement.order, 0);
  assert.equal(first.statement.content.rel, 'grounded_L');
  // opens on the town's verdict (the mirror), not the truth — the de re filler (§9)
  assert.equal(first.slot.binding, 'verrell');

  const rec = cd.nodes.find((n) => n.id === 'des:L:recognition');
  assert.equal(rec.statement.order, 1);
  assert.equal(rec.statement.content.kind, 'recognition');
  assert.equal(rec.recogniserFigure, 'warden');
  assert.equal(rec.statement.content.authority.mode, 'rational_legal'); // the assay's authority (Weber)

  // dispositions captured from the prose
  assert.deepEqual(cd.dynamics, { mirrorPull: 'high', overreach: 'high', arc: 'softens' });
});

test('buildSubjectState consumes the compiled motivation — the seeded learner desire opens mirror-bound', () => {
  const cd = compileLearnerDesire(marrick);
  const s = buildSubjectState(marrick, { learnerHeld: [], learnerDesireNodes: cd.nodes });
  const first = s.L.desire.nodes.find((n) => n.id === 'des:L:first');
  assert.equal(first.slot.binding, 'verrell');
  assert.equal(s.L.desire.nodes.length, 2);
  // and without the injection, it falls back to the generic proof-pattern seed (open slot)
  const generic = buildSubjectState(marrick, { learnerHeld: [] });
  assert.equal(generic.L.desire.nodes.find((n) => n.id === 'des:L:first').slot.binding, null);
});

test('renderMotivationLines: the prompt rendering round-trips the learner_voice with nothing left over', () => {
  const text = renderMotivationLines(marrick, 'learner').join(' ').toLowerCase();
  assert.match(text, /verrell/); // first-order opens on the mirror (the town's verdict)
  assert.match(text, /warden/); // the recogniser
  assert.match(text, /find you right/); // the standing sought (second-order)
  assert.match(text, /before the evidence forces it/); // overreach disposition
  assert.match(text, /learning to let the evidence/); // arc: softens
});

const pathFactsByTurn = (w, t) =>
  w.releaseSchedule
    .filter((r) => r.turn <= t && w.proofPaths[0].premises.includes(r.premise))
    .map((r) => w.premiseById.get(r.premise).fact);

test('learnerBindingAtTurn: high mirror_pull clings to the mirror, then migrates when the secret grounds', () => {
  const at18 = learnerBindingAtTurn(marrick, pathFactsByTurn(marrick, 18));
  assert.equal(at18.binding, 'verrell'); // still bound to the town's verdict (the mirror)
  assert.equal(at18.migrated, false);
  assert.equal(at18.overreachTempted, true); // apt to assert the FALSE object early
  const at22 = learnerBindingAtTurn(marrick, pathFactsByTurn(marrick, 22));
  assert.equal(at22.binding, 'edony'); // the evidence forces the truth
  assert.equal(at22.migrated, true);
  assert.equal(at22.overreachTempted, false);
});

test('compileLearnerDesire travels: lantern opens brandt-bound (court); ai-syllabus generativeAI-bound, no second-order', () => {
  const lan = compileLearnerDesire(lantern);
  assert.equal(lan.nodes.find((n) => n.id === 'des:L:first').slot.binding, 'brandt');
  assert.equal(lan.nodes.find((n) => n.id === 'des:L:recognition').recogniserFigure, 'court');
  const ai = compileLearnerDesire(aiSyllabus);
  assert.equal(ai.nodes.find((n) => n.id === 'des:L:first').slot.binding, 'generativeAI');
  assert.equal(ai.nodes.length, 1); // no second-order recognition authored for the AF1 learner
  assert.equal(ai.dynamics.mirrorPull, 'medium');
});

test('learnerVoiceForWorld: renders the motivation when present, falls back to the prose voice otherwise', () => {
  assert.match(learnerVoiceForWorld(marrick), /verrell/); // rendered from the block
  assert.equal(learnerVoiceForWorld(nocturne), nocturne.learnerVoice); // no block → prose voice unchanged
});

test('compileTutorDesire: the tutor first-order is TRUTH-bound (never the mirror) and seeks no recognition (§5)', () => {
  const td = compileTutorDesire(marrick);
  const first = td.nodes.find((n) => n.id === 'des:T:first');
  assert.equal(first.statement.content.rel, 'grounded_L'); // Des_T(grounded_L(S)) — wants the LEARNER to ground it
  assert.equal(first.statement.bearer, 'T');
  assert.equal(first.slot.binding, 'edony'); // bound to the truth from t=0 — the tutor is never mirror-fooled
  assert.equal(first.inheritsQuestion, true);
  // the asymmetry: no second-order recognition node, and the dynamics record it
  assert.equal(td.nodes.find((n) => n.id === 'des:T:recognition'), undefined);
  assert.equal(td.nodes.length, 1);
  assert.deepEqual(td.dynamics, { withhold: 'lawful', boundToTruth: true, seeksRecognition: false });
});

test('renderMotivationLines(tutor): the inherited-but-outward end, the no-recognition asymmetry, the lawful withholding', () => {
  const text = renderMotivationLines(marrick, 'tutor').join(' ').toLowerCase();
  assert.match(text, /already hold the answer/); // first-order: inherit, turned outward (wants the learner to reach it)
  assert.match(text, /seek nothing for yourself/); // second-order null — the §5 asymmetry
  assert.match(text, /hold back each step/); // disposition: withhold lawful (the floor)
  // the tutor's lines keep the answer abstract — the secret token never appears
  assert.doesNotMatch(text, /edony/);
});

test('world-017: a recognition-seeking tutor yields a MUTUAL reversal on authored data (not a synthetic push)', () => {
  const saintcloud = world('world-017-saintcloud');
  const tc = compileTutorDesire(saintcloud);
  assert.equal(tc.dynamics.seeksRecognition, true); // unlike marrick, this tutor wants a verdict
  const tutorRec = tc.nodes.filter((n) => n.statement?.content?.kind === 'recognition');
  assert.equal(tutorRec.length, 1);

  // assemble the subject as the surface does — learner desire + the tutor's 2nd-order
  // recognition injected — at a licensed turn (the full proof path held)
  const fullPath = saintcloud.proofPaths[0].premises.map((id) => saintcloud.premiseById.get(id).fact);
  const learnerNodes = compileLearnerDesire(saintcloud).nodes;
  const s = buildSubjectState(saintcloud, {
    learnerHeld: fullPath,
    learnerDesireNodes: learnerNodes,
    tutorDesireNodes: tutorRec,
  });
  assert.equal(s.L.belief.secretGrounded, true); // licensed (anagnorisis)
  const out = reverse(s, { surpassed: 'T' });
  assert.equal(out.kind, 'mutual'); // the new learner (former tutor) inherits a recognition desire
  assert.equal(out.recognition.newLearnerSeeks.recogniser, 'council');

  // the injection is LOAD-BEARING: without it the same world inverts (proves part B is needed)
  const sNoInject = buildSubjectState(saintcloud, { learnerHeld: fullPath, learnerDesireNodes: learnerNodes });
  assert.equal(reverse(sNoInject, { surpassed: 'T' }).kind, 'inverted');
});
