import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

import {
  auditProgram2StallArchives,
  auditProgram2StallMoment,
  PROGRAM2_STALL_DETECTOR_VERSION,
} from '../services/program2StallAudit.js';

const exec = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUDITOR = path.resolve(__dirname, '..', 'scripts', 'audit-program2-stall-corpus.mjs');
const EXTRACTOR = path.resolve(__dirname, '..', 'scripts', 'program2-extract-live-moments.mjs');

function assignment({ duePremises = ['p_due'] } = {}) {
  return {
    schema: 'machinespirits.tutor-stub.point-of-action-turn.v1',
    detector_version: PROGRAM2_STALL_DETECTOR_VERSION,
    arm: 'committee',
    turn: 7,
    assigned_trigger: 'stagnant_repeat',
    inputs: {
      stagnation: 0.8,
      proposed_action_family: 'stage_next_step',
      previous_action_families: ['stage_next_step', 'stage_next_step', 'stage_next_step', 'stage_next_step'],
      due_premises: duePremises,
    },
  };
}

function compliance({ realized = 'stage_next_step', released = 1, questions = 1 } = {}) {
  return {
    schema: 'machinespirits.tutor-stub.point-of-action-compliance.v1',
    detector_version: PROGRAM2_STALL_DETECTOR_VERSION,
    arm: 'committee',
    turn: 7,
    trigger: 'stagnant_repeat',
    compliant: true,
    realized_action_family: realized,
    released_premise_count: released,
    question_count: questions,
  };
}

function turnRecord(text = 'Here is the due public premise. What does it change?') {
  return {
    turn: 7,
    tutor: text,
    tutorGuardAccounting: { finalDelivery: { audits: { auditOk: true } } },
  };
}

function writeJsonl(filePath, events) {
  fs.writeFileSync(filePath, `${events.map((event) => JSON.stringify(event)).join('\n')}\n`);
}

describe('Program-2 stall audit', () => {
  it('accepts a guarded due-premise release with exactly one question', () => {
    const result = auditProgram2StallMoment({
      assignment: assignment(),
      compliance: compliance(),
      turnRecord: turnRecord(),
    });

    assert.equal(result.passed, true);
    assert.equal(result.path, 'due_release');
    assert.deepEqual(result.failures, []);
  });

  it('accepts a no-release reanchor to a different public action family', () => {
    const result = auditProgram2StallMoment({
      assignment: assignment({ duePremises: [] }),
      compliance: compliance({ realized: 'reanchor_public_evidence', released: 0 }),
      turnRecord: turnRecord('Try a different public exhibit. What does it show?'),
    });

    assert.equal(result.passed, true);
    assert.equal(result.path, 'public_reanchor');
  });

  it('fails closed on an undue release, repeated action, missing guards, or span mismatch', () => {
    const record = turnRecord('I will repeat it. Why? Why again?');
    record.tutorGuardAccounting.finalDelivery.audits.auditOk = false;
    const result = auditProgram2StallMoment({
      assignment: assignment({ duePremises: [] }),
      compliance: compliance({ realized: 'stage_next_step', released: 1, questions: 2 }),
      turnRecord: record,
    });

    assert.equal(result.passed, false);
    assert.ok(result.failures.includes('component:correct_break_path'));
    assert.ok(result.failures.includes('component:final_delivery_guards_passed'));
    assert.ok(result.failures.includes('component:exactly_one_question'));
  });

  it('selects one sealed trace per planned job and reports missing jobs', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'program2-stall-archive-'));
    try {
      fs.mkdirSync(path.join(tmpDir, 'traces', 'job-1'), { recursive: true });
      fs.writeFileSync(
        path.join(tmpDir, 'launch-plan.json'),
        JSON.stringify({
          plan: { jobs: [{ id: 'job-1', arm: 'committee', profile: 'proof_skipper' }, { id: 'job-2' }] },
        }),
      );
      writeJsonl(path.join(tmpDir, 'traces', 'job-1', 'sealed.jsonl'), [
        { type: 'run_start', metadata: { provenance: { git: { sha: 'abc' } } } },
        { type: 'point_of_action_assignment', turn: 7, pointOfAction: assignment() },
        { type: 'point_of_action_compliance', turn: 7, compliance: compliance() },
        { type: 'turn_complete', turn: 7, turnRecord: turnRecord() },
        { type: 'run_end' },
      ]);

      const result = auditProgram2StallArchives([{ label: 'fixture', root: tmpDir }]);
      assert.equal(result.plannedDialogues, 2);
      assert.equal(result.sealedDialogues, 1);
      assert.equal(result.rawMoments, 1);
      assert.equal(result.auditPassing, 1);
      assert.equal(result.archives[0].missingJobs, 1);
      assert.equal(result.decision, 'NO_GO_CORPUS_FLOOR');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('returns success when a valid audit records a corpus-floor no-go', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'program2-stall-cli-'));
    const out = path.join(tmpDir, 'out');
    try {
      fs.mkdirSync(path.join(tmpDir, 'traces'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'launch-plan.json'), JSON.stringify({ plan: { jobs: [] } }));

      const { stdout } = await exec(process.execPath, [AUDITOR, '--archive-root', `fixture=${tmpDir}`, '--out', out]);
      const result = JSON.parse(stdout);
      assert.equal(result.decision, 'NO_GO_CORPUS_FLOOR');
      assert.equal(fs.existsSync(path.join(out, 'summary.json')), true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('extracts stagnant-repeat rows but keeps SFT eligibility locked behind the strict audit', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'program2-stall-extract-'));
    const root = path.join(tmpDir, 'pilot');
    const out = path.join(tmpDir, 'out');
    try {
      fs.mkdirSync(path.join(root, 'traces', 'job-1'), { recursive: true });
      fs.writeFileSync(
        path.join(root, 'launch-plan.json'),
        JSON.stringify({ plan: { jobs: [{ id: 'job-1', arm: 'committee', profile: 'proof_skipper' }] } }),
      );
      writeJsonl(path.join(root, 'traces', 'job-1', 'sealed.jsonl'), [
        { type: 'run_start', metadata: { provenance: { git: { sha: 'abc' } } } },
        { type: 'model_call', role: 'x_committee_mini', turn: 7, request: { messages: [] } },
        { type: 'program2_committee_moment', turn: 7, moment: { source: 'mini', miniText: 'Try another exhibit?' } },
        { type: 'point_of_action_compliance', turn: 7, compliance: compliance() },
        { type: 'turn_complete', turn: 7, turnRecord: turnRecord() },
        { type: 'run_end' },
      ]);

      await exec(process.execPath, [EXTRACTOR, '--trigger', 'stagnant_repeat', '--pilot-root', root, '--out', out]);
      const rows = fs.readFileSync(path.join(out, 'live-moments.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
      const summary = JSON.parse(fs.readFileSync(path.join(out, 'summary.json'), 'utf8'));
      assert.equal(rows.length, 1);
      assert.equal(rows[0].sftEligible, false);
      assert.equal(rows[0].eligibilityBlockedReason, 'requires_machinespirits.program2.stall-audit.v1');
      assert.equal(summary.trigger, 'stagnant_repeat');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('preserves warrant extraction as the default trigger', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'program2-warrant-extract-'));
    const root = path.join(tmpDir, 'pilot');
    const out = path.join(tmpDir, 'out');
    try {
      fs.mkdirSync(path.join(root, 'traces', 'job-1'), { recursive: true });
      fs.writeFileSync(
        path.join(root, 'launch-plan.json'),
        JSON.stringify({ plan: { jobs: [{ id: 'job-1', arm: 'committee', profile: 'proof_skipper' }] } }),
      );
      writeJsonl(path.join(root, 'traces', 'job-1', 'sealed.jsonl'), [
        { type: 'run_start', metadata: { provenance: { git: { sha: 'abc' } } } },
        { type: 'model_call', role: 'x_committee_mini', turn: 7, request: { messages: [] } },
        { type: 'program2_committee_moment', turn: 7, moment: { source: 'mini', miniText: 'Which record?' } },
        {
          type: 'point_of_action_compliance',
          turn: 7,
          compliance: { ...compliance(), trigger: 'warrant_skip', compliant: true },
        },
        { type: 'turn_complete', turn: 7, turnRecord: turnRecord() },
        { type: 'run_end' },
      ]);

      await exec(process.execPath, [EXTRACTOR, '--pilot-root', root, '--out', out]);
      const row = JSON.parse(fs.readFileSync(path.join(out, 'live-moments.jsonl'), 'utf8').trim());
      const summary = JSON.parse(fs.readFileSync(path.join(out, 'summary.json'), 'utf8'));
      assert.equal(row.sftEligible, true);
      assert.equal('eligibilityBlockedReason' in row, false);
      assert.equal('trigger' in summary, false);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
