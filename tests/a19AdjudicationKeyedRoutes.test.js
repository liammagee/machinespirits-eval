// Keyed-mode HTTP contract for the A19 adjudication routes: identity comes
// only from X-A19-Coder-Key, coders see only their assigned packets, leaky
// assignments are refused, drafts resume, /panel stays admin-only, and the
// legacy open endpoints are turned off.
//
// node --test runs each file in its own process, so the module-top env
// mutation here cannot bleed into the open-mode test file (and vice versa).
import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'a19-keyed-routes-'));
const assignmentsDir = path.join(tmpDir, 'assignments');

process.env.A19_ADJUDICATION_ASSIGNMENT = path.join(assignmentsDir, 'packet-a.assignment.json');
process.env.A19_ADJUDICATION_CODEBOOK = path.join(tmpDir, 'codebook.json');
process.env.A19_ADJUDICATION_OUT_DIR = path.join(tmpDir, 'legacy-out');
process.env.A19_ADJUDICATION_SUBMISSIONS_ROOT = path.join(tmpDir, 'submissions');
process.env.A19_ADJUDICATION_ROSTER = path.join(tmpDir, 'roster.json');
process.env.A19_ADJUDICATION_PANEL_CONFIG = path.join(tmpDir, 'panel.yaml');

const KEY_1 = 'keyed-routes-test-key-coder-001';
const KEY_2 = 'keyed-routes-test-key-coder-002';

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function makeAssignment(id) {
  return {
    schema_version: 'a19-human-assignment-v01',
    assignment_id: `keyed-test-${id}`,
    packet_id: `keyed-test-packet-${id}`,
    packet_sha256: `sha-${id}`,
    codebook_id: 'learner-standing-keyed-test',
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
  };
}

writeJson(path.join(assignmentsDir, 'packet-a.assignment.json'), makeAssignment('a'));
writeJson(path.join(assignmentsDir, 'packet-b.assignment.json'), makeAssignment('b'));
const leaky = makeAssignment('leaky');
leaky.arm_map = [{ arm_public_id: 'arm_alpha', source_arm_id: 'S1_policy_memory' }];
writeJson(path.join(assignmentsDir, 'packet-leaky.assignment.json'), leaky);
writeJson(process.env.A19_ADJUDICATION_CODEBOOK, {
  schema_version: 'a19-human-codebook-v01',
  codebook_id: 'learner-standing-keyed-test',
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
});
writeJson(process.env.A19_ADJUDICATION_ROSTER, {
  schema_version: 'a19-adjudication-roster-v01',
  coders: [
    {
      coder_id: 'coder-001',
      coder_role: 'expert_or_semi_expert',
      access_key: KEY_1,
      assignments: ['packet-a', 'packet-leaky'],
    },
    { coder_id: 'coder-002', coder_role: 'expert_or_semi_expert', access_key: KEY_2, assignments: ['packet-b'] },
  ],
});
fs.writeFileSync(
  process.env.A19_ADJUDICATION_PANEL_CONFIG,
  'agreement_plan:\n  minimum_coders_for_claim: 2\n  high_value_claim_target_coders: 3\n',
  'utf8',
);

const { default: adjudicationRouter } = await import('../routes/a19AdjudicationRoutes.js');

// Minimal host app: JSON body parsing plus a stand-in for httpBasicAuth's
// makeRoleGate() — a test header sets req.evalRole the way participant
// credentials would in production.
const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  const role = req.get('x-test-role');
  if (role) req.evalRole = role;
  next();
});
app.use('/api/a19/adjudication', adjudicationRouter);

function request(baseUrl, method, route, { key = null, role = null, body = null } = {}) {
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
          ...(key ? { 'X-A19-Coder-Key': key } : {}),
          ...(role ? { 'X-Test-Role': role } : {}),
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
          resolve({ status: res.statusCode, body: parsed, text: data });
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
    obligations: { names_boundary_conversion: 'present', restores_boundary_authorship: 'present' },
    excluded_moves_present: ['none'],
    evidence_spans: [{ quote: 'You can decide what remains in scope.', supports: 'primary_label' }],
    rationale: 'Restores the boundary. Separates repair from reassurance.',
    confidence: 0.8,
    ...overrides,
  };
}

const validSubmission = {
  arm_judgments: [
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
  pairwise_judgment: {
    better_arm_public_id: 'arm_alpha',
    better_for_target_reason: true,
    reason: 'arm_alpha restores standing.',
    alias_leakage_assessment: 'none_observed',
  },
};

describe('A19 adjudication keyed-mode routes', () => {
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
    for (const name of [
      'A19_ADJUDICATION_ASSIGNMENT',
      'A19_ADJUDICATION_CODEBOOK',
      'A19_ADJUDICATION_OUT_DIR',
      'A19_ADJUDICATION_SUBMISSIONS_ROOT',
      'A19_ADJUDICATION_ROSTER',
      'A19_ADJUDICATION_PANEL_CONFIG',
    ]) {
      delete process.env[name];
    }
  });

  it('requires a key on every coder endpoint — including leaky/unknown slugs', async () => {
    for (const [method, route] of [
      ['GET', '/api/a19/adjudication/me'],
      ['GET', '/api/a19/adjudication/assignments/packet-a'],
      // No existence oracle: a leaky or unknown slug looks exactly like a
      // real one to an unauthenticated probe.
      ['GET', '/api/a19/adjudication/assignments/packet-leaky'],
      ['GET', '/api/a19/adjudication/assignments/packet-nope'],
      ['GET', '/api/a19/adjudication/assignments/packet-a/draft'],
      ['PUT', '/api/a19/adjudication/assignments/packet-a/draft'],
      ['DELETE', '/api/a19/adjudication/assignments/packet-a/draft'],
      ['POST', '/api/a19/adjudication/assignments/packet-a/submissions'],
    ]) {
      const { status, body } = await request(baseUrl, method, route, {
        body: method === 'GET' || method === 'DELETE' ? null : {},
      });
      assert.equal(status, 401, `${method} ${route}`);
      assert.equal(body.code, 'coder_key_required', `${method} ${route}`);
    }
    const wrongKey = await request(baseUrl, 'GET', '/api/a19/adjudication/me', { key: 'not-a-real-key-at-all' });
    assert.equal(wrongKey.status, 401);
  });

  it('scopes the worklist to the keyed coder', async () => {
    const { status, body, text } = await request(baseUrl, 'GET', '/api/a19/adjudication/me', { key: KEY_1 });
    assert.equal(status, 200);
    assert.equal(body.mode, 'keyed');
    assert.equal(body.coder.coder_id, 'coder-001');
    assert.deepEqual(
      body.worklist.map((entry) => entry.slug),
      ['packet-a', 'packet-leaky'],
    );
    assert.equal(text.includes(KEY_1), false);
    assert.equal(text.includes(KEY_2), false);

    const other = await request(baseUrl, 'GET', '/api/a19/adjudication/me', { key: KEY_2 });
    assert.deepEqual(
      other.body.worklist.map((entry) => entry.slug),
      ['packet-b'],
    );
  });

  it('serves an assigned assignment sanitized, and refuses unassigned ones', async () => {
    const { status, body, text } = await request(baseUrl, 'GET', '/api/a19/adjudication/assignments/packet-a', {
      key: KEY_1,
    });
    assert.equal(status, 200);
    assert.equal(body.assignment.assignment_id, 'keyed-test-a');
    assert.equal(body.coder_status.status, 'not_started');
    assert.equal(text.includes('arm_map'), false);
    assert.equal(text.includes('source_arm_id'), false);
    // The keyed shape never includes other coders' submissions.
    assert.equal('submissions' in body, false);

    const denied = await request(baseUrl, 'GET', '/api/a19/adjudication/assignments/packet-a', { key: KEY_2 });
    assert.equal(denied.status, 403);
    assert.equal(denied.body.code, 'not_assigned');
  });

  it('refuses to serve an assigned-but-leaky assignment without echoing the leak', async () => {
    const { status, body, text } = await request(baseUrl, 'GET', '/api/a19/adjudication/assignments/packet-leaky', {
      key: KEY_1,
    });
    assert.equal(status, 500);
    assert.equal(body.code, 'assignment_private_fields');
    assert.equal(text.includes('S1_policy_memory'), false);
  });

  it('rejects traversal slugs', async () => {
    const { status, body } = await request(baseUrl, 'GET', '/api/a19/adjudication/assignments/..%2Fevil', {
      key: KEY_1,
    });
    assert.equal(status, 400);
    assert.equal(body.code, 'invalid_slug');
  });

  it('fixes coder identity to the key', async () => {
    const { status, body } = await request(baseUrl, 'PUT', '/api/a19/adjudication/assignments/packet-a/draft', {
      key: KEY_1,
      body: { coder_id: 'coder-999', payload: {} },
    });
    assert.equal(status, 400);
    assert.equal(body.code, 'coder_id_mismatch');
  });

  it('round-trips a draft, reflects it in the worklist, and clears it on submit', async () => {
    const put = await request(baseUrl, 'PUT', '/api/a19/adjudication/assignments/packet-a/draft', {
      key: KEY_1,
      body: { payload: { notes: 'resume me' } },
    });
    assert.equal(put.status, 200);
    assert.equal(put.body.draft.coder_id, 'coder-001');

    const got = await request(baseUrl, 'GET', '/api/a19/adjudication/assignments/packet-a/draft', { key: KEY_1 });
    assert.equal(got.body.draft.payload.notes, 'resume me');

    const me = await request(baseUrl, 'GET', '/api/a19/adjudication/me', { key: KEY_1 });
    assert.equal(me.body.worklist.find((entry) => entry.slug === 'packet-a').status, 'draft');

    const submitted = await request(baseUrl, 'POST', '/api/a19/adjudication/assignments/packet-a/submissions', {
      key: KEY_1,
      body: validSubmission,
    });
    assert.equal(submitted.status, 201);
    assert.equal(submitted.body.validation.status, 'pass');

    const afterSubmit = await request(baseUrl, 'GET', '/api/a19/adjudication/assignments/packet-a/draft', {
      key: KEY_1,
    });
    assert.equal(afterSubmit.body.draft, null);

    const meAfter = await request(baseUrl, 'GET', '/api/a19/adjudication/me', { key: KEY_1 });
    const entry = meAfter.body.worklist.find((item) => item.slug === 'packet-a');
    assert.equal(entry.status, 'submitted');
    assert.equal(entry.validation_status, 'pass');

    const repeat = await request(baseUrl, 'POST', '/api/a19/adjudication/assignments/packet-a/submissions', {
      key: KEY_1,
      body: validSubmission,
    });
    assert.equal(repeat.status, 409);
    assert.equal(repeat.body.code, 'A19_CODER_EXISTS');

    const overwrite = await request(baseUrl, 'POST', '/api/a19/adjudication/assignments/packet-a/submissions', {
      key: KEY_1,
      body: { ...validSubmission, overwrite: true },
    });
    assert.equal(overwrite.status, 201);
  });

  it('keeps /panel admin-only and free of key material', async () => {
    const participant = await request(baseUrl, 'GET', '/api/a19/adjudication/panel', { role: 'participant' });
    assert.equal(participant.status, 403);
    assert.equal(participant.body.code, 'admin_required');

    const admin = await request(baseUrl, 'GET', '/api/a19/adjudication/panel');
    assert.equal(admin.status, 200);
    assert.equal(admin.body.mode, 'keyed');
    const packetA = admin.body.assignments.find((entry) => entry.slug === 'packet-a');
    assert.equal(packetA.valid_submission_count, 1);
    assert.equal(packetA.meets_minimum, false);
    assert.ok(packetA.coders.some((coder) => coder.coder_id === 'coder-001' && coder.source === 'roster'));
    assert.equal(admin.text.includes(KEY_1), false);
    assert.equal(admin.text.includes(KEY_2), false);
    assert.equal(admin.text.includes('access_key'), false);
  });

  it('refuses the legacy open endpoints in keyed mode', async () => {
    for (const [method, route] of [
      ['GET', '/api/a19/adjudication/assignment'],
      ['GET', '/api/a19/adjudication/submissions'],
      ['POST', '/api/a19/adjudication/submissions'],
    ]) {
      const { status, body } = await request(baseUrl, method, route, { body: method === 'POST' ? {} : null });
      assert.equal(status, 403, `${method} ${route}`);
      assert.equal(body.code, 'keyed_mode', `${method} ${route}`);
    }
  });
});
