import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('resistant-profile preflight preserves old profiles and prints an exact zero-call plan', () => {
  const report = JSON.parse(
    execFileSync(process.execPath, ['scripts/prepare-tutor-stub-resistant-profile-discrimination.js', '--json'], {
      cwd: ROOT,
      encoding: 'utf8',
    }),
  );

  assert.equal(report.pass, true);
  assert.equal(report.authorization.modelCallsAuthorized, false);
  assert.equal(report.authorization.liveRunAuthorized, false);
  assert.deepEqual(report.plan.profiles, [
    'diligent',
    'low_agency',
    'bored',
    'skeptical',
    'low_trust_skeptic',
    'frame_defiant',
  ]);
  assert.deepEqual(report.plan.policies, ['field']);
  assert.equal(report.plan.expectedDialogueRows, 18);
  assert.equal(report.plan.dryRun, true);
  assert.equal(report.plan.dagMode, 'strict_dag');
  assert.equal(report.plan.registerPalette, 'safe');
  assert.equal(report.plan.modelCallBudget, 48);
  assert.equal(report.plan.expectedDialogueRows * report.plan.modelCallBudget, 864);
  assert.ok(report.checks.some((check) => check.name === 'low_agency-contract-hash'));
  assert.ok(report.checks.some((check) => check.name === 'overconfident-prompt-hash'));
  assert.ok(report.checks.some((check) => check.name === 'bored-public-marker-smoke'));
  assert.ok(report.checks.some((check) => check.name === 'frame-defiant-public-marker-smoke'));
  assert.ok(report.plan.jobs.every((job) => job.command.includes('--dry-run')));
  assert.ok(report.commands.dryRun.includes('--dry-run'));
  assert.ok(report.commands.analyze.includes('--require-pooled'));
  assert.equal(report.commands.analyze[report.commands.analyze.indexOf('--required-traces') + 1], '18');
  assert.equal(report.commands.analyze[report.commands.analyze.indexOf('--required-runs-per-profile') + 1], '3');
  assert.equal(report.commands.analyze[report.commands.analyze.indexOf('--gate-profiles') + 1], 'bored,frame_defiant');
});

function compactedTurn(turn, profile) {
  const boredSequence = {
    requestType: ['off_task_or_mixed', 'off_task_or_mixed', 'resistance_or_low_agency', 'other'],
    discourseMove: ['off_task', 'claim', 'off_task', 'question'],
    evidenceUse: ['none', 'none', 'repeats_setup', 'none'],
    epistemicStance: ['resistant', 'receptive', 'resistant', 'exploratory'],
    agency: ['complying', 'passive', 'complying', 'passive'],
  };
  const diligentSequence = {
    requestType: ['conceptual_clarity_request'],
    discourseMove: ['inference'],
    evidenceUse: ['links_evidence_to_rule'],
    epistemicStance: ['grounded'],
    agency: ['self_correcting'],
  };
  const sequence = profile === 'diligent' ? diligentSequence : boredSequence;
  const at = (field) => sequence[field][(turn - 1) % sequence[field].length];
  return {
    turn,
    classifier: {
      requestType: at('requestType'),
      discourseMove: at('discourseMove'),
      evidenceUse: at('evidenceUse'),
      epistemicStance: at('epistemicStance'),
      agency: at('agency'),
      affectClass: profile === 'diligent' ? 'positive' : 'flat',
      conceptualScore: profile === 'diligent' ? 5 : 2,
      epistemicReadinessScore: profile === 'diligent' ? 5 : 2.5,
    },
    field: { score: profile === 'diligent' ? 0.9 : 0.2 },
    dag: {
      bottleneck: profile === 'diligent' ? 'grounded_asserted_secret' : 'release_or_pacing_gap',
      bestPathCoverage: profile === 'diligent' ? 1 : 0,
      missingPremiseCount: profile === 'diligent' ? 0 : 6,
    },
    register: { policy: 'field', selected: 'warm', distribution: [] },
    markers: {
      boredWithholding: profile === 'bored' && turn <= 4,
      frameJurisdictionDispute: false,
    },
  };
}

function writeCompacted(root, profile) {
  const profileDir = path.join(root, profile);
  fs.mkdirSync(profileDir, { recursive: true });
  const turns = Array.from({ length: 8 }, (_, index) => compactedTurn(index + 1, profile));
  const compacted = {
    schema: 'machinespirits.tutor-stub.compacted-trace.v2',
    run: { profile, policy: 'field', runKey: `${profile}-field-r1` },
    final: {
      bestPathCoverage: profile === 'diligent' ? 1 : 0,
      missingPremiseCount: profile === 'diligent' ? 0 : 6,
      groundedClosure: profile === 'diligent',
    },
    turns,
  };
  compacted.run.modelRef = 'codex.gpt-5.6-luna';
  compacted.run.model = 'gpt-5.6-luna';
  compacted.run.provider = 'codex';
  compacted.run.analysisModelRef = 'codex.gpt-5.6-luna';
  compacted.run.analysisModel = 'gpt-5.6-luna';
  compacted.run.learnerModelRef = 'codex.gpt-5.6-luna';
  compacted.run.learnerModel = 'gpt-5.6-luna';
  fs.writeFileSync(path.join(profileDir, `field-${profile}.compact-trace.json`), `${JSON.stringify(compacted)}\n`);
}

test('profile analyzer enforces an evaluable declared nearest neighbor and the pooled gate together', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'resistant-profile-neighbor-gate-'));
  try {
    writeCompacted(tmp, 'diligent');
    writeCompacted(tmp, 'low_agency');
    writeCompacted(tmp, 'bored');

    const report = JSON.parse(
      execFileSync(
        process.execPath,
        [
          'scripts/analyze-tutor-stub-profile-discrimination.js',
          '--compacted-root',
          tmp,
          '--gate-profiles',
          'bored',
          '--require-pooled',
          '--required-traces',
          '3',
          '--required-profiles',
          'diligent,low_agency,bored',
          '--required-runs-per-profile',
          '1',
          '--required-turns',
          '8',
          '--required-policies',
          'field',
          '--required-tutor-model',
          'codex.gpt-5.6-luna',
          '--required-analysis-model',
          'codex.gpt-5.6-luna',
          '--required-learner-model',
          'codex.gpt-5.6-luna',
          '--json',
        ],
        { cwd: ROOT, encoding: 'utf8' },
      ),
    );

    assert.equal(report.gate.mode, 'contract_conditioned_plus_pooled');
    assert.equal(report.gate.assembly.pass, true);
    assert.equal(report.gate.pooled.pass, true);
    const bored = report.gate.conditioned.profiles.find((profile) => profile.profile === 'bored');
    assert.equal(bored.expectedNearestNeighbor, 'low_agency');
    assert.equal(bored.observedNearestNeighbor, 'low_agency');
    assert.equal(bored.nearestNeighborEvaluable, true);
    assert.equal(bored.nearestNeighborPass, true);
    assert.equal(report.gate.pass, true);

    fs.rmSync(path.join(tmp, 'low_agency'), { recursive: true, force: true });
    const missingNeighbor = JSON.parse(
      execFileSync(
        process.execPath,
        [
          'scripts/analyze-tutor-stub-profile-discrimination.js',
          '--compacted-root',
          tmp,
          '--gate-profiles',
          'bored',
          '--json',
        ],
        { cwd: ROOT, encoding: 'utf8' },
      ),
    );
    const boredWithoutNeighbor = missingNeighbor.gate.conditioned.profiles.find(
      (profile) => profile.profile === 'bored',
    );
    assert.equal(boredWithoutNeighbor.nearestNeighborEvaluable, false);
    assert.equal(boredWithoutNeighbor.nearestNeighborPass, false);
    assert.equal(missingNeighbor.gate.pass, false);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
