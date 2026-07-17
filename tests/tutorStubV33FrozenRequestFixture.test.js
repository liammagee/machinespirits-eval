import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { buildTutorStubPromptSizeReportForRequest } from '../services/tutorStubPromptSizeReport.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE_PATH = path.join(
  ROOT,
  'tests',
  'fixtures',
  'tutor-stub-first-draft',
  'v33-tallow-answer-seeking-turn-5-request.json',
);
const EXPECTED_REQUEST_SHA256 = 'e1b9a59ab8e9285db122cb21472feb0d91f4b891d0d8e7343399d085f155159e';
const EXPECTED_AUTHORED_ESTIMATED_TOKENS = 4930;

test('portable V33 frozen request retains its exact hash and authored prompt-size baseline', () => {
  const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
  const requestSha256 = createHash('sha256')
    .update(JSON.stringify(fixture.request))
    .digest('hex');
  const report = buildTutorStubPromptSizeReportForRequest({ request: fixture.request });

  assert.equal(fixture.schema, 'machinespirits.tutor-stub.v33-frozen-request-fixture.v1');
  assert.equal(fixture.requestJsonStringifySha256, EXPECTED_REQUEST_SHA256);
  assert.equal(requestSha256, EXPECTED_REQUEST_SHA256);
  assert.equal(fixture.baselineAuthoredEstimatedTokens, EXPECTED_AUTHORED_ESTIMATED_TOKENS);
  assert.equal(report.authoredTotal.estimatedTokens, EXPECTED_AUTHORED_ESTIMATED_TOKENS);
  assert.equal(report.authoredTotal.chars, 19718);
});
