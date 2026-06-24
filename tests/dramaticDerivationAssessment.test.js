import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { loadWorld } from '../services/dramaticDerivation/world.js';
import {
  buildDerivationAssessment,
  profileProofDag,
  renderHumanDagMarkdown,
} from '../services/dramaticDerivation/assessment.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('profileProofDag renders a readable authored DAG from a world spec', () => {
  const world = loadWorld(path.join(ROOT, 'config/drama-derivation/world-000-smoke.yaml'));
  const profile = profileProofDag(world);

  assert.equal(profile.schema, 'machinespirits.derivation.human-readable-dag.v1');
  assert.equal(profile.worldId, 'world_000_smoke');
  assert.equal(profile.metrics.pathCount, 1);
  assert.equal(profile.metrics.uniqueProofPremiseCount, 3);
  assert.equal(profile.metrics.scheduledProofPremiseCount, 3);
  assert.equal(profile.metrics.earliestCompleteTurn, 8);
  assert.equal(profile.metrics.factCount, 8);
  assert.equal(profile.metrics.ruleApplicationCount, 3);
  assert.ok(profile.facts.some((node) => node.kind === 'fact' && node.factText === 'heir(marin)'));
  assert.ok(profile.ruleApplications.some((node) => node.rule === 'R2_succession'));
  assert.ok(profile.edges.some((edge) => edge.kind === 'input' && edge.rule === 'R1_lineage'));
  assert.match(profile.summary, /1 authored proof path/u);
  assert.match(profile.paths[0].premises[0].surface, /Marin/u);

  const markdown = renderHumanDagMarkdown(profile);
  assert.match(markdown, /Authored Proof Paths/u);
  assert.match(markdown, /Rule Applications/u);
  assert.match(markdown, /p3 \(turn 8 via tutor\)/u);
});

test('buildDerivationAssessment keeps proof gate mechanical and assessment advisory', () => {
  const world = loadWorld(path.join(ROOT, 'config/drama-derivation/world-000-smoke.yaml'));
  const assessment = buildDerivationAssessment({
    label: 'fixture',
    world,
    result: {
      worldId: world.id,
      verdict: 'grounded_anagnorisis',
      turnsPlayed: 8,
      firstForcedTurn: 8,
      assertedGroundedTurn: 8,
      trajectory: [{ turn: 8, D: 0 }],
    },
    diagnosis: {
      releaseAdherence: { onCue: 4, deviations: [], missed: [], unscheduled: [] },
    },
  });

  assert.equal(assessment.proofGate.status, 'pass');
  assert.equal(assessment.proofGate.finalD, 0);
  assert.equal(assessment.authority.proofGate, 'mechanical');
  assert.equal(assessment.authority.externalAssessment, 'advisory');
  assert.equal(assessment.dagProfile.metrics.earliestCompleteTurn, 8);
});
