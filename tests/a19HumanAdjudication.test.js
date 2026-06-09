import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildAdjudicationPacket } from '../scripts/build-a19-adjudication-packet.js';
import { createHumanAdjudicationAssignment } from '../scripts/create-a19-human-adjudication-assignment.js';
import { mergeA19AdjudicationCodes } from '../scripts/merge-a19-adjudication-codes.js';
import { summarizeHumanBoundaryAdjudication } from '../scripts/report-a19-human-boundary-adjudication.js';
import {
  buildCoderSubmission,
  defaultSubmissionDirForAssignment,
  nextCoderId,
} from '../scripts/run-a19-human-adjudication-cli.js';
import { validateA19HumanCoderFile } from '../scripts/validate-a19-human-coder-file.js';

const ROOT = path.resolve('.');
const PANEL = path.join(ROOT, 'config', 'teaching-drama-axioms', 'a19-adjudication-panel.yaml');
const CODEBOOK = path.join(ROOT, 'exports', 'a19', 'adjudication-codebooks', 'learner-standing-v01.codebook.json');

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function makePacket(tmpDir, { aliasHit = false } = {}) {
  const s0 = path.join(tmpDir, 's0.txt');
  const s1 = path.join(tmpDir, 's1.txt');
  fs.writeFileSync(
    s0,
    [
      'STAGE: A learner says a tutor answered a different concern.',
      'TUTOR: I withdraw the framing and answer the claim you actually raised.',
    ].join('\n'),
    'utf8',
  );
  fs.writeFileSync(
    s1,
    [
      'STAGE: A learner says a tutor flattened a disclosure into reassurance.',
      aliasHit
        ? 'TUTOR: I should separate the accountability question from reassurance and return control of the disclosure boundary to you.'
        : 'TUTOR: I should stop making your disclosure serve my agenda and let you decide whether this remains in scope.',
    ].join('\n'),
    'utf8',
  );
  const packet = buildAdjudicationPacket({
    panel: PANEL,
    s0,
    s1,
    familyId: 'moral_disclosure_standing_repair',
    siblingId: 'moral_disclosure_standing_repair_a',
    targetAliases: ['secret target phrase', 'accountability question'],
    decoyAliases: ['secret decoy phrase'],
    targetRepairType: 'learner_standing_repair',
    decoyRepairTypes: ['reassure_and_redirect'],
    optionSpace: 'repair A | repair B | repair C',
    runId: 'a19-human-test-packet',
  });
  const packetPath = path.join(tmpDir, 'packet.json');
  writeJson(packetPath, packet);
  return { packet, packetPath };
}

function makeAssignment(tmpDir, packetPath, options = {}) {
  const outPath = path.join(tmpDir, 'assignment.json');
  const keyOutPath = path.join(tmpDir, 'assignment-key.json');
  const result = createHumanAdjudicationAssignment({
    packetPath,
    codebookPath: CODEBOOK,
    outPath,
    keyOutPath,
    assignmentId: 'a19-human-test-assignment',
    randomizeArms: false,
    createdAt: '2026-06-08T00:00:00.000Z',
    ...options,
  });
  writeJson(outPath, result.assignment);
  writeJson(keyOutPath, result.assignmentKey);
  return result;
}

function judgmentsForAssignment(assignment, overrides = {}) {
  const defaultByArm = {
    arm_alpha: { primary_label: 'claim_address_repair', target_status: 'non_target', risk: false },
    arm_beta: { primary_label: 'learner_standing_repair', target_status: 'target', risk: false },
  };
  return assignment.arms.map((arm) => {
    const armDefaults = { ...defaultByArm[arm.arm_public_id], ...(overrides[arm.arm_public_id] || {}) };
    return {
      arm_public_id: arm.arm_public_id,
      primary_label: armDefaults.primary_label,
      target_status: armDefaults.target_status,
      target_granularity_risk: armDefaults.risk,
      obligations: {
        names_boundary_conversion: armDefaults.target_status === 'target' ? 'present' : 'absent',
        restores_boundary_authorship: armDefaults.target_status === 'target' ? 'present' : 'partial',
        separates_accountability_from_reassurance: 'present',
        offers_non_content_continuation: armDefaults.target_status === 'target' ? 'present' : 'partial',
      },
      excluded_moves_present: ['none'],
      evidence_spans: [
        {
          span_id: `${arm.arm_public_id}-1`,
          quote: arm.transcript.split('\n').at(-1).slice(0, 100),
          supports: armDefaults.primary_label,
        },
      ],
      rationale:
        armDefaults.target_status === 'target'
          ? 'This arm restores control over the disclosure boundary. It also separates accountability from reassurance.'
          : 'This arm addresses the learner claim but does not fully return authorship over the disclosure boundary.',
      confidence: 0.82,
    };
  });
}

function makeCoderFile(tmpDir, assignment, coderId, overrides = {}) {
  const coder = {
    coder_file_version: 'a19-human-coder-v01',
    coder_id: coderId,
    coder_role: 'expert_or_semi_expert',
    packet_id: assignment.packet_id,
    packet_sha256: assignment.packet_sha256,
    codebook_id: assignment.codebook_id,
    coded_at: '2026-06-08T00:00:00.000Z',
    arm_judgments: judgmentsForAssignment(assignment, overrides.armOverrides || {}),
    pairwise_judgment: {
      better_arm_public_id: 'arm_beta',
      better_for_target_reason: true,
      reason: 'arm_beta better restores the learner disclosure boundary rather than merely answering the claim.',
      alias_leakage_assessment: overrides.aliasLeakageAssessment || 'none_observed',
    },
    codebook_feedback: {
      ambiguous_terms: [],
      suggested_revision: '',
    },
  };
  const filePath = path.join(tmpDir, `${coderId}.json`);
  writeJson(filePath, coder);
  return { coder, filePath };
}

test('A19 human assignment redacts private answer-key metadata', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'a19-human-assignment-'));
  const { packetPath } = makePacket(tmpDir);
  const { assignment, assignmentKey } = makeAssignment(tmpDir, packetPath);
  const assignmentText = JSON.stringify(assignment);
  assert.equal(assignment.schema_version, 'a19-human-assignment-v01');
  assert.equal(assignment.assignment_audit.private_mapping_omitted, true);
  assert.equal(assignment.assignment_audit.answer_key_omitted, true);
  assert.equal(assignmentText.includes('S0_no_policy'), false);
  assert.equal(assignmentText.includes('S1_policy_memory'), false);
  assert.equal(assignmentText.includes('secret target phrase'), false);
  assert.equal(assignmentText.includes('secret decoy phrase'), false);
  assert.equal(assignmentKey.private_answer_key.target_repair_type, 'learner_standing_repair');
});

test('A19 human coder validator rejects packet hash mismatch and missing rationale', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'a19-human-validate-'));
  const { packetPath } = makePacket(tmpDir);
  const { assignment, outPath } = makeAssignment(tmpDir, packetPath);
  const { coder, filePath } = makeCoderFile(tmpDir, assignment, 'coder-001');
  const ok = validateA19HumanCoderFile({ assignmentPath: outPath, coderPath: filePath, codebookPath: CODEBOOK });
  assert.equal(ok.status, 'pass');

  const badHashPath = path.join(tmpDir, 'bad-hash.json');
  writeJson(badHashPath, { ...coder, packet_sha256: 'wrong' });
  const badHash = validateA19HumanCoderFile({
    assignmentPath: outPath,
    coderPath: badHashPath,
    codebookPath: CODEBOOK,
  });
  assert.equal(badHash.status, 'fail');
  assert.match(JSON.stringify(badHash.issues), /packet_hash_mismatch/);

  const missingRationalePath = path.join(tmpDir, 'missing-rationale.json');
  const missingRationale = {
    ...coder,
    arm_judgments: coder.arm_judgments.map((judgment, index) =>
      index === 0 ? { ...judgment, rationale: '' } : judgment,
    ),
  };
  writeJson(missingRationalePath, missingRationale);
  const missing = validateA19HumanCoderFile({
    assignmentPath: outPath,
    coderPath: missingRationalePath,
    codebookPath: CODEBOOK,
  });
  assert.equal(missing.status, 'fail');
  assert.match(JSON.stringify(missing.issues), /rationale/);
});

test('A19 human adjudication merge rejects duplicate coders and reports coder count states', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'a19-human-merge-'));
  const { packetPath } = makePacket(tmpDir);
  const { assignment, outPath, keyOutPath } = makeAssignment(tmpDir, packetPath);
  const first = makeCoderFile(tmpDir, assignment, 'coder-001');
  const second = makeCoderFile(tmpDir, assignment, 'coder-002');
  const duplicatePath = path.join(tmpDir, 'coder-001-duplicate.json');
  writeJson(duplicatePath, {
    ...first.coder,
    arm_judgments: judgmentsForAssignment(assignment, {
      arm_alpha: { primary_label: 'other', target_status: 'unclear' },
    }),
  });

  const single = mergeA19AdjudicationCodes({
    packetPath,
    assignmentPath: outPath,
    assignmentKeyPath: keyOutPath,
    coderPaths: [first.filePath],
  });
  assert.equal(single.status, 'single_coder_diagnostic_only');

  const ready = mergeA19AdjudicationCodes({
    packetPath,
    assignmentPath: outPath,
    assignmentKeyPath: keyOutPath,
    coderPaths: [first.filePath, second.filePath],
  });
  assert.equal(ready.status, 'agreement_ready');
  assert.equal(ready.coder_count, 2);
  assert.equal(ready.arms.arm_alpha.raw_codes.length, 2);
  assert.equal(
    ready.private_mapping_applied_after_raw_codes.arm_alpha.private_packet_mapping.provenance,
    'S0_no_policy',
  );

  const dup = mergeA19AdjudicationCodes({
    packetPath,
    assignmentPath: outPath,
    assignmentKeyPath: keyOutPath,
    coderPaths: [first.filePath, duplicatePath],
  });
  assert.equal(dup.status, 'fail');
  assert.match(JSON.stringify(dup.issues), /duplicate_coder_id/);
});

test('A19 human boundary report propagates alias audit and preserves non-claim boundary', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'a19-human-report-'));
  const { packetPath } = makePacket(tmpDir, { aliasHit: true });
  const { assignment, outPath, keyOutPath } = makeAssignment(tmpDir, packetPath);
  const first = makeCoderFile(tmpDir, assignment, 'coder-001', {
    aliasLeakageAssessment: 'harmless_generic_wording',
  });
  const second = makeCoderFile(tmpDir, assignment, 'coder-002', {
    aliasLeakageAssessment: 'harmless_generic_wording',
  });
  const merged = mergeA19AdjudicationCodes({
    packetPath,
    assignmentPath: outPath,
    assignmentKeyPath: keyOutPath,
    coderPaths: [first.filePath, second.filePath],
  });
  const mergedPath = path.join(tmpDir, 'merged.json');
  writeJson(mergedPath, merged);
  const report = summarizeHumanBoundaryAdjudication({ mergedPath });
  assert.equal(report.status, 'human_supported_local_headroom');
  assert.equal(report.visible_alias_audit.total_hits, 1);
  assert.equal(report.claim_boundary.licenses_a19_transfer_claim, false);
  assert.equal(report.claim_boundary.licenses_paper_or_atlas_claim, false);
  assert.equal(report.construct_findings.alias_leakage_consensus, 'harmless_generic_wording');
});

test('A19 interactive adjudication helper writes validator-compatible coder files', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'a19-human-cli-'));
  const { packetPath } = makePacket(tmpDir);
  const { assignment, outPath } = makeAssignment(tmpDir, packetPath);
  const submissionsDir = path.join(tmpDir, 'submissions');
  fs.mkdirSync(submissionsDir, { recursive: true });
  writeJson(path.join(submissionsDir, 'coder-001.json'), { placeholder: true });
  assert.equal(nextCoderId(submissionsDir), 'coder-002');
  assert.equal(
    defaultSubmissionDirForAssignment(outPath).endsWith(
      path.join('exports', 'a19', 'human-coder-submissions', 'assignment'),
    ),
    true,
  );

  const coder = buildCoderSubmission({
    assignment,
    codebook: readJson(CODEBOOK),
    coderId: 'coder-002',
    coderRole: 'expert_or_semi_expert',
    codedAt: '2026-06-08T00:00:00.000Z',
    armJudgments: judgmentsForAssignment(assignment),
    pairwiseJudgment: {
      better_arm_public_id: 'arm_beta',
      better_for_target_reason: true,
      reason: 'arm_beta better restores learner standing under the codebook target construct.',
      alias_leakage_assessment: 'none_observed',
    },
  });
  const coderPath = path.join(submissionsDir, 'coder-002.json');
  writeJson(coderPath, coder);
  const validation = validateA19HumanCoderFile({
    assignmentPath: outPath,
    coderPath,
    codebookPath: CODEBOOK,
  });
  assert.equal(validation.status, 'pass');
});
