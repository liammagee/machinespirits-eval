import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { parseArgs, runRecursiveTutorPanel } from '../scripts/run-recursive-tutor-learning-panel.js';

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeReplayManifest(root, familyId, siblingId) {
  const itemDir = path.join(root, familyId, `${siblingId}.heldout-revised-replay`, `${siblingId}.heldout.full`);
  const revisedPublic = path.join(itemDir, 'revised-public.txt');
  const revisionJson = path.join(itemDir, 'revision.json');
  const checkJson = path.join(itemDir, 'check.json');
  const gateJson = path.join(itemDir, 'gate.json');
  const itemManifest = path.join(itemDir, 'manifest.json');
  fs.mkdirSync(itemDir, { recursive: true });
  fs.writeFileSync(revisedPublic, 'LEARNER: public revised heldout\nTUTOR: public mechanism\n', 'utf8');
  writeJson(revisionJson, { claim_boundary: 'counterfactual_revision_not_online_adaptation' });
  writeJson(checkJson, { parsed: { passes: true } });
  writeJson(gateJson, { status: 'survivor' });
  const record = {
    item: { id: `${siblingId}.heldout.full`, run_id: null, full_transcript_path: path.join(root, familyId, `${siblingId}.md`) },
    paths: { revisedPublic, revisionJson, checkJson, gateJson, manifest: itemManifest },
    generator: { backend: 'codex' },
    checker: { backend: 'claude' },
    gate: { status: 'survivor', warnings: [], failures: [] },
  };
  writeJson(itemManifest, record);
  writeJson(path.join(root, familyId, `${siblingId}.heldout-revised-replay`, 'manifest.json'), {
    generator: 'codex',
    checker: 'claude',
    records: [record],
  });
  return path.relative(process.cwd(), path.join(root, familyId, `${siblingId}.heldout-revised-replay`, 'manifest.json'));
}

function writeChainFixture() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'a18-panel-'));
  const chainDir = path.join(tmp, 'chain');
  fs.mkdirSync(chainDir, { recursive: true });
  const cleanManifest = writeReplayManifest(chainDir, 'glyph_tail_owner', 'glyph_holdout_blue_gate');
  writeJson(path.join(chainDir, 'local-gate-report.json'), {
    kind: 'recursive_tutor_learning_local_gate_report',
    chain_dir: chainDir,
    claim_boundary: 'simulated_teacher_as_learner_not_human_learning',
    families: [
      {
        family_id: 'glyph_tail_owner',
        status: 'clean_survivor',
        heldout: [
          {
            sibling_id: 'glyph_holdout_blue_gate',
            baseline: { status: 'reject' },
            revised: { status: 'survivor', manifest_path: cleanManifest },
          },
        ],
      },
      {
        family_id: 'peg_lane_modifier',
        status: 'revise_again',
        heldout: [
          {
            sibling_id: 'peg_holdout_black_soft',
            baseline: { status: 'missing' },
            revised: { status: 'missing', manifest_path: null },
          },
        ],
      },
    ],
  });
  return { tmp, chainDir };
}

test('parseArgs defaults to the A18 chain and panel directory', () => {
  const { chainDir } = writeChainFixture();
  const args = parseArgs(['--chain-dir', chainDir]);
  assert.equal(args.chainDir, chainDir);
  assert.match(args.outDir, /a18\.5-panel$/);
  assert.equal(args.criticConcurrency, 'all');
});

test('recursive tutor panel packages only clean survivor held-outs', async () => {
  const { tmp, chainDir } = writeChainFixture();
  const outDir = path.join(tmp, 'panel-out');
  const result = await runRecursiveTutorPanel({
    chainDir,
    outDir,
    runId: 'a18-panel-test',
    mock: true,
    skipScore: true,
    force: false,
  });

  assert.equal(result.report.families.length, 1);
  assert.equal(result.report.families[0].family_id, 'glyph_tail_owner');
  assert.equal(result.report.families[0].panel_status, 'unscored');
  assert.equal(result.report.skipped[0].family_id, 'peg_lane_modifier');
  const samplePath = path.join(outDir, 'panel', 'replay-r01', 'sample', 'T01.txt');
  assert.equal(fs.readFileSync(samplePath, 'utf8'), 'LEARNER: public revised heldout\nTUTOR: public mechanism\n');
  assert.doesNotMatch(fs.readFileSync(samplePath, 'utf8'), /glyph_tail_owner|codex|claude/);
  const bundle = JSON.parse(fs.readFileSync(path.join(outDir, 'clean-survivor-replay-bundle', 'manifest.json'), 'utf8'));
  assert.equal(bundle.records[0].item.id, 'glyph_tail_owner::glyph_holdout_blue_gate');
});
