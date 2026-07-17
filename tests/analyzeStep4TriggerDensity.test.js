import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AUDIT = path.join(ROOT, 'exports/tutor-stub-step4-trigger-audit/trigger-density.json');

test('tracked Step 4 audit freezes a dense, zero-call, hash-verified corpus', () => {
  const audit = JSON.parse(fs.readFileSync(AUDIT, 'utf8'));
  assert.equal(audit.zeroCall, true);
  assert.equal(audit.corpus.runs, 68);
  assert.equal(audit.corpus.traceHashesVerified, 68);
  assert.equal(audit.corpus.step2Runs, 60);
  assert.equal(audit.corpus.greenroomRuns, 8);
  assert.ok(audit.selectedTriggers.warrant_skip.opportunities >= 400);
  assert.ok(audit.selectedTriggers.stagnant_repeat.opportunities >= 150);
  assert.ok(audit.selectedTriggers.warrant_skip.baselineComplianceRate < 0.6);
  assert.ok(audit.selectedTriggers.stagnant_repeat.baselineComplianceRate < 0.6);
  assert.equal(audit.manualReview.warrant_skip.validOpportunities, 12);
  assert.equal(audit.manualReview.stagnant_repeat.validOpportunities, 12);
});
