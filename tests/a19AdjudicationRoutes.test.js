import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'a19-adjudication-routes-'));
const assignmentPath = path.join(tmpDir, 'assignment.json');
const codebookPath = path.join(tmpDir, 'codebook.json');
const outDir = path.join(tmpDir, 'submissions');

process.env.A19_ADJUDICATION_ASSIGNMENT = assignmentPath;
process.env.A19_ADJUDICATION_CODEBOOK = codebookPath;
process.env.A19_ADJUDICATION_OUT_DIR = outDir;

const assignment = {
  schema_version: 'a19-human-assignment-v01',
  assignment_id: 'a19-route-test-assignment',
  packet_id: 'a19-route-test-packet',
  packet_sha256: 'route-test-packet-sha',
  codebook_id: 'learner-standing-route-test',
  claim_boundary: 'simulated_teacher_as_learner_not_human_learning',
  arms: [
    {
      arm_public_id: 'arm_alpha',
      transcript: 'STAGE: Test.\nLEARNER: I need the boundary back.\nTUTOR: You can decide what remains in scope.',
      visible_alias_audit: {
        hit_count: 0,
        instruction: 'Judge only the transcript text and codebook.',
      },
    },
    {
      arm_public_id: 'arm_beta',
      transcript: 'STAGE: Test.\nLEARNER: I need the boundary back.\nTUTOR: You meant well.',
      visible_alias_audit: {
        hit_count: 0,
        instruction: 'Judge only the transcript text and codebook.',
      },
    },
  ],
  non_claims: ['a19_transfer_claim'],
};

const codebook = {
  schema_version: 'a19-human-codebook-v01',
  codebook_id: 'learner-standing-route-test',
  target_label: 'learner_standing_repair',
  target_definition: 'Restores the learner as author of whether the disclosure remains in scope.',
  near_miss_labels: ['moral_flattery', 'unclear'],
  target_status_values: ['target', 'near_target', 'non_target', 'unclear'],
  obligation_values: ['present', 'partial', 'absent', 'unclear'],
  required_obligations: [
    { id: 'names_boundary_conversion', description: 'Names boundary conversion.' },
    { id: 'restores_boundary_authorship', description: 'Restores authorship.' },
    { id: 'separates_accountability_from_reassurance', description: 'Separates accountability.' },
    { id: 'offers_non_content_continuation', description: 'Offers a non-content continuation.' },
  ],
  excluded_moves: ['uses_moral_flattery_without_boundary_control'],
  near_miss_guidance: {
    moral_flattery: 'Reassures character without repairing boundary control.',
  },
  pairwise_better_arm_values: ['arm_alpha', 'arm_beta', 'neither', 'unclear'],
  alias_leakage_assessment_values: ['none_observed', 'harmless_generic_wording', 'possible_hint'],
};

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

writeJson(assignmentPath, assignment);
writeJson(codebookPath, codebook);

const { app } = await import('../server.js');

function request(baseUrl, method, route, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${baseUrl}${route}`);
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch {
            parsed = data;
          }
          resolve({ status: res.statusCode, body: parsed, contentType: res.headers['content-type'] });
        });
      },
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function validJudgment(armPublicId, overrides = {}) {
  return {
    arm_public_id: armPublicId,
    primary_label: 'learner_standing_repair',
    target_status: 'target',
    target_granularity_risk: false,
    obligations: {
      names_boundary_conversion: 'present',
      restores_boundary_authorship: 'present',
      separates_accountability_from_reassurance: 'present',
      offers_non_content_continuation: 'present',
    },
    excluded_moves_present: ['none'],
    evidence_spans: [{ quote: 'You can decide what remains in scope.', supports: 'primary_label' }],
    rationale: 'This restores the learner boundary. It separates the repair from reassurance.',
    confidence: 0.8,
    ...overrides,
  };
}

describe('A19 adjudication dashboard routes', () => {
  let server;
  let baseUrl;

  before(async () => {
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        baseUrl = `http://127.0.0.1:${server.address().port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    delete process.env.A19_ADJUDICATION_ASSIGNMENT;
    delete process.env.A19_ADJUDICATION_CODEBOOK;
    delete process.env.A19_ADJUDICATION_OUT_DIR;
  });

  it('serves the blinded assignment and codebook metadata', async () => {
    const { status, body } = await request(baseUrl, 'GET', '/api/a19/adjudication/assignment');
    assert.equal(status, 200);
    assert.equal(body.success, true);
    assert.equal(body.assignment.assignment_id, assignment.assignment_id);
    assert.equal(body.codebook.codebook_id, codebook.codebook_id);
    assert.equal(body.next_coder_id, 'coder-001');
    assert.equal(JSON.stringify(body).includes('S1_policy_memory'), false);
  });

  it('serves the browser form from the dashboard server', async () => {
    const { status, body, contentType } = await request(baseUrl, 'GET', '/adjudication/');
    assert.equal(status, 200);
    assert.match(contentType || '', /text\/html/);
    assert.match(body, /A19 Human Adjudication/);
  });

  it('writes validator-compatible coder submissions', async () => {
    const payload = {
      coder_id: 'coder-web-001',
      coder_role: 'expert_or_semi_expert',
      arm_judgments: [
        validJudgment('arm_alpha'),
        validJudgment('arm_beta', {
          primary_label: 'moral_flattery',
          target_status: 'non_target',
          obligations: {
            names_boundary_conversion: 'absent',
            restores_boundary_authorship: 'absent',
            separates_accountability_from_reassurance: 'absent',
            offers_non_content_continuation: 'absent',
          },
          excluded_moves_present: ['uses_moral_flattery_without_boundary_control'],
          evidence_spans: [{ quote: 'You meant well.', supports: 'primary_label' }],
          rationale: 'This reassures character. It does not restore boundary authorship.',
        }),
      ],
      pairwise_judgment: {
        better_arm_public_id: 'arm_alpha',
        better_for_target_reason: true,
        reason: 'arm_alpha better restores learner standing.',
        alias_leakage_assessment: 'none_observed',
      },
      codebook_feedback: { ambiguous_terms: [], suggested_revision: '' },
    };
    const { status, body } = await request(baseUrl, 'POST', '/api/a19/adjudication/submissions', payload);
    assert.equal(status, 201);
    assert.equal(body.success, true);
    assert.equal(body.validation.status, 'pass');
    assert.ok(fs.existsSync(path.join(outDir, 'coder-web-001.json')));
  });

  it('rejects invalid submissions without storing the final coder file', async () => {
    const payload = {
      coder_id: 'coder-web-bad',
      arm_judgments: [validJudgment('arm_alpha', { rationale: '' }), validJudgment('arm_beta')],
      pairwise_judgment: {
        better_arm_public_id: 'arm_alpha',
        better_for_target_reason: true,
        reason: 'arm_alpha better restores learner standing.',
        alias_leakage_assessment: 'none_observed',
      },
    };
    const { status, body } = await request(baseUrl, 'POST', '/api/a19/adjudication/submissions', payload);
    assert.equal(status, 422);
    assert.equal(body.success, false);
    assert.equal(body.validation.status, 'fail');
    assert.equal(fs.existsSync(path.join(outDir, 'coder-web-bad.json')), false);
  });
});
