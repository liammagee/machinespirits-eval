import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import {
  A19PanelError,
  DRAFT_SCHEMA_VERSION,
  ROSTER_SCHEMA_VERSION,
  coderWorklist,
  deleteDraft,
  discoverAssignments,
  findCoderByKey,
  getAssignment,
  listSubmissions,
  loadAgreementThresholds,
  loadRoster,
  panelStatus,
  readDraft,
  resolveWorkspace,
  safeCoderId,
  safeSlug,
  sanitizeAssignment,
  submissionDirForSlug,
  writeDraft,
  writeSubmission,
} from '../services/a19AdjudicationPanel.js';

// Every test builds an isolated workspace from a fake env — resolveWorkspace
// is a pure function of `env`, so nothing here touches process.env.
function makeWorkspace(overrides = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'a19-panel-test-'));
  const env = {
    A19_ADJUDICATION_ASSIGNMENT: path.join(tmp, 'assignments', 'packet-a.assignment.json'),
    A19_ADJUDICATION_CODEBOOK: path.join(tmp, 'codebook.json'),
    // Without OUT_DIR the legacy slug (packet-a) would resolve to the CLI's
    // default under the REPO's exports tree — pin it into tmp for hermeticity.
    A19_ADJUDICATION_OUT_DIR: path.join(tmp, 'legacy-out'),
    A19_ADJUDICATION_SUBMISSIONS_ROOT: path.join(tmp, 'submissions'),
    A19_ADJUDICATION_ROSTER: path.join(tmp, 'roster.json'),
    A19_ADJUDICATION_PANEL_CONFIG: path.join(tmp, 'panel.yaml'),
    ...overrides,
  };
  return { tmp, env, workspace: resolveWorkspace(env) };
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function makeAssignment(id, overrides = {}) {
  return {
    schema_version: 'a19-human-assignment-v01',
    assignment_id: `panel-test-${id}`,
    packet_id: `panel-test-packet-${id}`,
    packet_sha256: `sha-${id}`,
    codebook_id: 'learner-standing-panel-test',
    claim_boundary: 'simulated_teacher_as_learner_not_human_learning',
    arms: [
      {
        arm_public_id: 'arm_alpha',
        transcript: 'LEARNER: I need the boundary back.\nTUTOR: You can decide what remains in scope.',
        visible_alias_audit: { hit_count: 0, instruction: 'Judge only the transcript text.' },
      },
      {
        arm_public_id: 'arm_beta',
        transcript: 'LEARNER: I need the boundary back.\nTUTOR: You meant well.',
        visible_alias_audit: { hit_count: 0, instruction: 'Judge only the transcript text.' },
      },
    ],
    non_claims: ['a19_transfer_claim'],
    ...overrides,
  };
}

const CODEBOOK = {
  schema_version: 'a19-human-codebook-v01',
  codebook_id: 'learner-standing-panel-test',
  target_label: 'learner_standing_repair',
  target_definition: 'Restores the learner as author of scope.',
  near_miss_labels: ['moral_flattery', 'unclear'],
  required_obligations: [
    { id: 'names_boundary_conversion', description: 'Names boundary conversion.' },
    { id: 'restores_boundary_authorship', description: 'Restores authorship.' },
  ],
  excluded_moves: ['uses_moral_flattery_without_boundary_control'],
  near_miss_guidance: { moral_flattery: 'Reassures without repair.' },
  pairwise_better_arm_values: ['arm_alpha', 'arm_beta', 'neither', 'unclear'],
  alias_leakage_assessment_values: ['none_observed', 'harmless_generic_wording'],
};

function seedAssignment(ctx, slug = 'packet-a', overrides = {}) {
  const filePath = path.join(ctx.workspace.assignmentsDir, `${slug}.assignment.json`);
  writeJson(filePath, makeAssignment(slug, overrides));
  writeJson(ctx.env.A19_ADJUDICATION_CODEBOOK, CODEBOOK);
  return filePath;
}

function validJudgment(armPublicId, overrides = {}) {
  return {
    arm_public_id: armPublicId,
    primary_label: 'learner_standing_repair',
    target_status: 'target',
    target_granularity_risk: false,
    obligations: { names_boundary_conversion: 'present', restores_boundary_authorship: 'present' },
    excluded_moves_present: ['none'],
    evidence_spans: [{ quote: 'You can decide what remains in scope.', supports: 'primary_label' }],
    rationale: 'Restores the boundary. Separates repair from reassurance.',
    confidence: 0.8,
    ...overrides,
  };
}

function validSubmissionArgs(ctx, { coderId = 'coder-001', slug = 'packet-a', overwrite = false } = {}) {
  const resolved = getAssignment(ctx.workspace, slug);
  return {
    assignmentPath: resolved.assignmentPath,
    codebookPath: resolved.codebookPath,
    submissionDir: resolved.submissionDir,
    coderId,
    coderRole: 'expert_or_semi_expert',
    armJudgments: [
      validJudgment('arm_alpha'),
      validJudgment('arm_beta', {
        primary_label: 'moral_flattery',
        target_status: 'non_target',
        obligations: { names_boundary_conversion: 'absent', restores_boundary_authorship: 'absent' },
        excluded_moves_present: ['uses_moral_flattery_without_boundary_control'],
        evidence_spans: [{ quote: 'You meant well.', supports: 'primary_label' }],
        rationale: 'Reassures character. Does not restore authorship.',
      }),
    ],
    pairwiseJudgment: {
      better_arm_public_id: 'arm_alpha',
      better_for_target_reason: true,
      reason: 'arm_alpha restores standing.',
      alias_leakage_assessment: 'none_observed',
    },
    overwrite,
  };
}

describe('sanitizeAssignment — serving-time blind enforcement', () => {
  it('projects onto the public allowlist and drops unknown fields', () => {
    const sanitized = sanitizeAssignment(makeAssignment('a', { internal_notes: 'researcher only' }));
    assert.equal(sanitized.assignment_id, 'panel-test-a');
    assert.equal('internal_notes' in sanitized, false);
    assert.equal(sanitized.arms.length, 2);
    assert.deepEqual(Object.keys(sanitized.arms[0]).sort(), ['arm_public_id', 'transcript', 'visible_alias_audit']);
  });

  it('refuses an assignment carrying a top-level private field', () => {
    const leaky = makeAssignment('a', { arm_map: [{ arm_public_id: 'arm_alpha', source_arm_id: 'S0' }] });
    assert.throws(
      () => sanitizeAssignment(leaky),
      (error) => error instanceof A19PanelError && error.code === 'assignment_private_fields',
    );
  });

  it('refuses a private field nested inside an arm (projection is not trusted)', () => {
    const leaky = makeAssignment('a');
    leaky.arms[1].source_arm_id = 'S1_policy_memory';
    assert.throws(
      () => sanitizeAssignment(leaky),
      (error) =>
        error.code === 'assignment_private_fields' && error.details.private_fields.includes('arms[1].source_arm_id'),
    );
  });

  it('refuses when forbidden markers appear in served text (e.g. transcript)', () => {
    const leaky = makeAssignment('a');
    leaky.arms[0].transcript = 'TUTOR: as S1_policy_memory says, you meant well.';
    assert.throws(
      () => sanitizeAssignment(leaky),
      (error) => error instanceof A19PanelError && error.code === 'assignment_marker_leak',
    );
  });

  it('does not false-positive on audit keys that embed a marker word without boundaries', () => {
    const sanitized = sanitizeAssignment(
      makeAssignment('a', {
        assignment_audit: { target_aliases_omitted_except_unavoidable_transcript_text: true },
      }),
    );
    assert.equal(sanitized.assignment_audit.target_aliases_omitted_except_unavoidable_transcript_text, true);
  });
});

describe('roster — load + key lookup', () => {
  const validCoder = (overrides = {}) => ({
    coder_id: 'coder-001',
    coder_role: 'expert_or_semi_expert',
    access_key: 'a-test-key-that-is-long-enough',
    assignments: ['packet-a'],
    ...overrides,
  });
  const validRoster = (coders) => ({ schema_version: ROSTER_SCHEMA_VERSION, coders });

  it('returns null when no roster file exists (open mode)', () => {
    const ctx = makeWorkspace();
    assert.equal(loadRoster(ctx.workspace), null);
  });

  it('loads a valid roster and finds coders by exact key only', () => {
    const ctx = makeWorkspace();
    writeJson(ctx.workspace.rosterPath, validRoster([validCoder()]));
    const roster = loadRoster(ctx.workspace);
    assert.equal(roster.coders.length, 1);
    assert.equal(findCoderByKey(roster, 'a-test-key-that-is-long-enough').coder_id, 'coder-001');
    assert.equal(findCoderByKey(roster, 'a-test-key-that-is-long-enougX'), null);
    assert.equal(findCoderByKey(roster, ''), null);
    assert.equal(findCoderByKey(null, 'a-test-key-that-is-long-enough'), null);
  });

  for (const [label, roster, code] of [
    ['wrong schema_version', { schema_version: 'nope', coders: [] }, 'roster_schema_version'],
    ['missing coders array', { schema_version: ROSTER_SCHEMA_VERSION }, 'roster_coders_missing'],
    [
      'duplicate coder ids',
      validRoster([validCoder(), validCoder({ access_key: 'another-key-that-is-long-enough' })]),
      'roster_duplicate_id',
    ],
    ['short access key', validRoster([validCoder({ access_key: 'short' })]), 'roster_key_too_short'],
    [
      'duplicate access keys',
      validRoster([validCoder(), validCoder({ coder_id: 'coder-002' })]),
      'roster_duplicate_key',
    ],
    ['missing assignments array', validRoster([validCoder({ assignments: null })]), 'roster_assignments_missing'],
  ]) {
    it(`refuses a roster with ${label}`, () => {
      const ctx = makeWorkspace();
      writeJson(ctx.workspace.rosterPath, roster);
      assert.throws(
        () => loadRoster(ctx.workspace),
        (error) => error instanceof A19PanelError && error.code === code,
      );
    });
  }
});

describe('assignment discovery + slug safety', () => {
  it('discovers *.assignment.json but never key files', () => {
    const ctx = makeWorkspace();
    seedAssignment(ctx, 'packet-a');
    writeJson(path.join(ctx.workspace.assignmentsDir, 'packet-a.assignment-key.json'), { arm_map: [] });
    writeJson(path.join(ctx.workspace.assignmentsDir, 'renamed-assignment-key.assignment.json'), { arm_map: [] });
    const slugs = discoverAssignments(ctx.workspace).map((entry) => entry.slug);
    assert.deepEqual(slugs, ['packet-a']);
  });

  it('rejects traversal slugs before touching the filesystem', () => {
    assert.throws(
      () => safeSlug('../evil'),
      (error) => error.code === 'invalid_slug',
    );
    assert.throws(() => safeSlug(''), /invalid assignment slug/);
    assert.equal(safeSlug('packet-a.v2_final'), 'packet-a.v2_final');
  });

  it('sanitizes coder ids', () => {
    assert.equal(safeCoderId(' coder-001 '), 'coder-001');
    assert.equal(safeCoderId('co/der!'), 'coder');
    assert.throws(
      () => safeCoderId('///'),
      (error) => error.code === 'coder_id_required',
    );
  });

  it('404s an unknown slug', () => {
    const ctx = makeWorkspace();
    seedAssignment(ctx, 'packet-a');
    assert.throws(
      () => getAssignment(ctx.workspace, 'packet-z'),
      (error) => error.code === 'assignment_not_found' && error.httpStatus === 404,
    );
  });

  it('routes the legacy slug to the legacy out dir and other slugs to the submissions root', () => {
    const ctx = makeWorkspace({ A19_ADJUDICATION_OUT_DIR: path.join(os.tmpdir(), 'legacy-out') });
    const workspace = resolveWorkspace(ctx.env);
    assert.equal(submissionDirForSlug(workspace, 'packet-a'), path.join(os.tmpdir(), 'legacy-out'));
    assert.equal(
      submissionDirForSlug(workspace, 'packet-b'),
      path.join(ctx.env.A19_ADJUDICATION_SUBMISSIONS_ROOT, 'packet-b'),
    );
    // Without OUT_DIR the legacy slug matches the offline CLI's default dir
    // (path computation only — never write there from a test).
    const cliParity = resolveWorkspace({ ...ctx.env, A19_ADJUDICATION_OUT_DIR: undefined });
    assert.match(
      submissionDirForSlug(cliParity, 'packet-a'),
      /exports[/\\]a19[/\\]human-coder-submissions[/\\]packet-a$/u,
    );
  });
});

describe('drafts — resume state', () => {
  it('round-trips a draft in .drafts/, invisible to listSubmissions', () => {
    const ctx = makeWorkspace();
    seedAssignment(ctx, 'packet-a');
    const resolved = getAssignment(ctx.workspace, 'packet-a');
    const draft = writeDraft({
      submissionDir: resolved.submissionDir,
      coderId: 'coder-001',
      slug: 'packet-a',
      assignmentId: resolved.assignment.assignment_id,
      payload: { notes: 'halfway' },
    });
    assert.equal(draft.schema_version, DRAFT_SCHEMA_VERSION);
    const read = readDraft({ submissionDir: resolved.submissionDir, coderId: 'coder-001' });
    assert.equal(read.payload.notes, 'halfway');
    assert.deepEqual(fs.readdirSync(path.join(resolved.submissionDir, '.drafts')), ['coder-001.draft.json']);
    assert.deepEqual(
      listSubmissions({
        assignmentPath: resolved.assignmentPath,
        codebookPath: resolved.codebookPath,
        submissionDir: resolved.submissionDir,
      }),
      [],
    );
    deleteDraft({ submissionDir: resolved.submissionDir, coderId: 'coder-001' });
    assert.equal(readDraft({ submissionDir: resolved.submissionDir, coderId: 'coder-001' }), null);
  });

  it('refuses a draft over the size cap with a 413-coded error', () => {
    const ctx = makeWorkspace();
    seedAssignment(ctx, 'packet-a');
    const resolved = getAssignment(ctx.workspace, 'packet-a');
    assert.throws(
      () =>
        writeDraft({
          submissionDir: resolved.submissionDir,
          coderId: 'coder-001',
          slug: 'packet-a',
          assignmentId: 'x',
          payload: { blob: 'x'.repeat(256 * 1024) },
        }),
      (error) => error.code === 'draft_too_large' && error.httpStatus === 413,
    );
  });
});

describe('writeSubmission — validate-before-rename', () => {
  it('persists a valid submission and clears the draft', () => {
    const ctx = makeWorkspace();
    seedAssignment(ctx, 'packet-a');
    const args = validSubmissionArgs(ctx);
    writeDraft({
      submissionDir: args.submissionDir,
      coderId: 'coder-001',
      slug: 'packet-a',
      assignmentId: 'x',
      payload: { notes: 'pre-submit' },
    });
    const result = writeSubmission(args);
    assert.equal(result.ok, true);
    assert.equal(result.validation.status, 'pass');
    assert.ok(fs.existsSync(path.join(args.submissionDir, 'coder-001.json')));
    assert.equal(readDraft({ submissionDir: args.submissionDir, coderId: 'coder-001' }), null);
  });

  it('rejects an invalid submission with no final file and no tmp residue', () => {
    const ctx = makeWorkspace();
    seedAssignment(ctx, 'packet-a');
    const args = validSubmissionArgs(ctx);
    args.armJudgments = [validJudgment('arm_alpha', { rationale: '' }), validJudgment('arm_beta')];
    const result = writeSubmission(args);
    assert.equal(result.ok, false);
    assert.equal(result.validation.status, 'fail');
    assert.equal(fs.existsSync(path.join(args.submissionDir, 'coder-001.json')), false);
    assert.deepEqual(
      fs.readdirSync(args.submissionDir).filter((entry) => entry.includes('.tmp')),
      [],
    );
  });

  it('refuses to overwrite an existing submission unless asked', () => {
    const ctx = makeWorkspace();
    seedAssignment(ctx, 'packet-a');
    assert.equal(writeSubmission(validSubmissionArgs(ctx)).ok, true);
    assert.throws(
      () => writeSubmission(validSubmissionArgs(ctx)),
      (error) => error.code === 'A19_CODER_EXISTS' && error.httpStatus === 409,
    );
    assert.equal(writeSubmission(validSubmissionArgs(ctx, { overwrite: true })).ok, true);
  });
});

describe('coderWorklist — status transitions', () => {
  it('walks not_started → draft → submitted for a rostered coder', () => {
    const ctx = makeWorkspace();
    seedAssignment(ctx, 'packet-a');
    const coder = { coder_id: 'coder-001', assignments: ['packet-a'] };

    let [entry] = coderWorklist(ctx.workspace, { coder });
    assert.equal(entry.status, 'not_started');
    assert.equal(entry.arm_count, 2);

    const resolved = getAssignment(ctx.workspace, 'packet-a');
    writeDraft({
      submissionDir: resolved.submissionDir,
      coderId: 'coder-001',
      slug: 'packet-a',
      assignmentId: 'x',
      payload: {},
    });
    [entry] = coderWorklist(ctx.workspace, { coder });
    assert.equal(entry.status, 'draft');
    assert.ok(entry.draft_updated_at);

    writeSubmission(validSubmissionArgs(ctx));
    [entry] = coderWorklist(ctx.workspace, { coder });
    assert.equal(entry.status, 'submitted');
    assert.equal(entry.validation_status, 'pass');
  });

  it('marks roster slugs with no assignment file as missing', () => {
    const ctx = makeWorkspace();
    seedAssignment(ctx, 'packet-a');
    const [entry] = coderWorklist(ctx.workspace, {
      coder: { coder_id: 'coder-001', assignments: ['packet-gone'] },
    });
    assert.equal(entry.status, 'missing');
  });
});

describe('panel completeness', () => {
  it('reads agreement thresholds from the panel YAML, with a fallback', () => {
    const ctx = makeWorkspace();
    fs.mkdirSync(path.dirname(ctx.workspace.panelConfigPath), { recursive: true });
    fs.writeFileSync(
      ctx.workspace.panelConfigPath,
      'agreement_plan:\n  minimum_coders_for_claim: 1\n  high_value_claim_target_coders: 2\n',
      'utf8',
    );
    assert.deepEqual(loadAgreementThresholds(ctx.workspace), {
      minimum_coders_for_claim: 1,
      high_value_claim_target_coders: 2,
    });
    const bare = makeWorkspace();
    assert.deepEqual(loadAgreementThresholds(bare.workspace), {
      minimum_coders_for_claim: 2,
      high_value_claim_target_coders: 3,
    });
  });

  it('builds the packets × coders matrix, counts file-only coders, and never emits keys', () => {
    const ctx = makeWorkspace();
    fs.mkdirSync(path.dirname(ctx.workspace.panelConfigPath), { recursive: true });
    fs.writeFileSync(
      ctx.workspace.panelConfigPath,
      'agreement_plan:\n  minimum_coders_for_claim: 2\n  high_value_claim_target_coders: 3\n',
      'utf8',
    );
    seedAssignment(ctx, 'packet-a');
    const accessKey = 'a-test-key-that-is-long-enough';
    const roster = {
      schema_version: ROSTER_SCHEMA_VERSION,
      coders: [
        {
          coder_id: 'coder-001',
          coder_role: 'expert_or_semi_expert',
          access_key: accessKey,
          assignments: ['packet-a'],
        },
      ],
    };
    writeJson(ctx.workspace.rosterPath, roster);

    writeSubmission(validSubmissionArgs(ctx, { coderId: 'coder-001' }));
    // A CLI-written coder who is not on the roster still counts toward
    // completeness — the merge script reads both identically.
    writeSubmission(validSubmissionArgs(ctx, { coderId: 'coder-cli-009' }));

    const status = panelStatus(ctx.workspace, { roster: loadRoster(ctx.workspace) });
    const [packet] = status.assignments;
    assert.equal(packet.slug, 'packet-a');
    assert.equal(packet.valid_submission_count, 2);
    assert.equal(packet.meets_minimum, true);
    assert.equal(packet.meets_high_value_target, false);
    const bySource = Object.fromEntries(packet.coders.map((coder) => [coder.coder_id, coder.source]));
    assert.deepEqual(bySource, { 'coder-001': 'roster', 'coder-cli-009': 'file' });
    assert.equal(JSON.stringify(status).includes(accessKey), false);
    assert.equal(JSON.stringify(status).includes('access_key'), false);
  });
});
