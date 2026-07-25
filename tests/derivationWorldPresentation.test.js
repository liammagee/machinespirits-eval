import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { loadWorld } from '../services/dramaticDerivation/world.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORLD_DIR = path.join(ROOT, 'config', 'drama-derivation');
const NEW_PRESENTATION_WORLDS = ['world_029_riverside_clinic', 'world_030_rowan_flat', 'world_031_tideway_makerspace'];

test('loadWorld passes presentation metadata through untouched', () => {
  const world = loadWorld(path.join(WORLD_DIR, 'world-022-foxtrot-jukebox.yaml'));
  assert.equal(world.presentation.family, 'foxtrot');
  assert.equal(world.presentation.temporal_frame, 'speculative');
  assert.ok(world.presentation.ledger_term);
  assert.ok(world.presentation.summary);
});

test('every derivation world carries presentation metadata and variants name their base', () => {
  const files = fs.readdirSync(WORLD_DIR).filter((file) => /^world-.*\.yaml$/u.test(file));
  const ids = new Set();
  const worlds = files.map((file) => loadWorld(path.join(WORLD_DIR, file)));
  for (const world of worlds) ids.add(world.id);
  for (const world of worlds) {
    assert.ok(world.presentation, `${world.id} missing presentation block`);
    assert.ok(world.presentation.temporal_frame, `${world.id} missing temporal_frame`);
    assert.ok(world.presentation.scene_ecology, `${world.id} missing scene_ecology`);
    assert.ok(world.presentation.narrative_diction, `${world.id} missing narrative_diction`);
    assert.ok(world.presentation.ledger_term, `${world.id} missing ledger_term`);
    assert.ok(world.presentation.summary, `${world.id} missing summary`);
    if (world.presentation.variant_of) {
      assert.ok(ids.has(world.presentation.variant_of), `${world.id} variant_of unknown world`);
      assert.ok(world.presentation.family, `${world.id} variant missing family`);
    }
  }
});

test('the new non-period worlds lint clean', () => {
  for (const stem of [
    'world-023-greyfen-lab',
    'world-024-emberwick-forum',
    'world-025-tallow-street',
    'world-026-skyway-bakery',
    'world-027-gazette-recall',
    'world-028-larkspur-fridge',
    'world-029-riverside-clinic',
    'world-030-rowan-flat',
    'world-031-tideway-makerspace',
  ]) {
    const output = execFileSync(
      process.execPath,
      ['scripts/lint-derivation-world.js', '--world', `config/drama-derivation/${stem}.yaml`],
      { cwd: ROOT, encoding: 'utf8' },
    );
    assert.match(output, /LINT PASS/u, `${stem} failed lint`);
  }
});

test('variety audit reports family-normalized distributions', () => {
  const output = execFileSync(process.execPath, ['scripts/audit-world-variety.js'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert.match(output, /presentation families/u);
  assert.match(output, /temporal_frame \(over \d+ families\)/u);
  // Family normalization: hethel's seven files must count once.
  assert.match(output, /hethel\s+7 worlds/u);
  assert.doesNotMatch(output, /backfill candidates/u);
  assert.match(output, /verdict: \d+% of families are period-framed; the roster carries a workable mix of frames\./u);
});

test('new presentation worlds resolve through the tutor-stub public prompt boundary', () => {
  for (const worldId of NEW_PRESENTATION_WORLDS) {
    const output = execFileSync(
      process.execPath,
      [
        'scripts/tutor-stub.js',
        '--dry-run',
        '--no-trace',
        '--world',
        worldId,
        '--dag',
        '--tutor-learner-dag',
        '--dag-mode',
        'defeasible_human_scaffold',
        '--opening-realizer',
        'deterministic',
      ],
      { cwd: ROOT, encoding: 'utf8' },
    );
    const config = JSON.parse(output);
    assert.equal(config.world.id, worldId);
    assert.equal(config.promptArchitecture.planner.owner, 'deterministic_harness');
    assert.equal(config.promptArchitecture.planner.modelCall, false);
    assert.equal(config.promptArchitecture.audit.baseSystem.ok, true);
    assert.equal(config.promptArchitecture.audit.baseSpeakerPrivilege.ok, true);
    assert.doesNotMatch(config.systemPrompt, /trial-book|assay|medieval flavour/iu);
  }
});

test('world picker lists the three new contemporary families', () => {
  const output = execFileSync(process.execPath, ['scripts/tutor-stub.js', '--list-worlds'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  for (const worldId of NEW_PRESENTATION_WORLDS) assert.match(output, new RegExp(worldId, 'u'));
  assert.match(output, /world_029_riverside_clinic.+\[contemporary, plain clinical procedural\]/u);
  assert.match(output, /world_030_rowan_flat.+\[contemporary, domestic plainspoken\]/u);
  assert.match(output, /world_031_tideway_makerspace.+\[contemporary, workshop problem-solving\]/u);
});
