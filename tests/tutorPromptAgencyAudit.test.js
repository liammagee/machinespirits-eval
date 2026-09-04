import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  DEFAULT_LEDGER,
  REPO_ROOT,
  buildTutorPromptAgencyAudit,
  renderTutorPromptAgencyAuditMarkdown,
} from '../scripts/audit-tutor-prompt-agency.js';

test('prompt agency audit covers every active prompt on all eight dimensions', () => {
  const audit = buildTutorPromptAgencyAudit();

  assert.equal(audit.valid, true, audit.errors.join('\n'));
  assert.equal(audit.inventory.active_count, 27);
  assert.equal(audit.summary.prompt_count, 27);
  assert.equal(audit.summary.dimension_cell_count, 216);
  assert.equal(audit.summary.problematic, 0);
  assert.equal(audit.summary.gray, 2);
  for (const prompt of audit.prompts) {
    assert.deepEqual(
      Object.keys(prompt.scores),
      audit.dimensions.map(({ id }) => id),
    );
  }
});

test('recognition and placebo remain category-matched on learner agency', () => {
  const audit = buildTutorPromptAgencyAudit();

  for (const comparison of audit.comparisons) {
    const agency = comparison.dimensions.find(({ dimension }) => dimension === 'D5');
    assert.deepEqual(agency, { dimension: 'D5', left: 'protective', right: 'protective', parity: true });
  }

  const superego = audit.comparisons.find(({ id }) => id === 'superego-recognition-placebo');
  assert.deepEqual(
    superego.dimensions.find(({ dimension }) => dimension === 'D7'),
    { dimension: 'D7', left: 'protective', right: 'no_evidence', parity: false },
  );
});

test('report states the evidence boundary and reproducible prompt-mirror discrepancies', () => {
  const audit = buildTutorPromptAgencyAudit();
  const markdown = renderTutorPromptAgencyAuditMarkdown(audit);

  assert.match(markdown, /not evidence about tutor behaviour or learner outcomes/i);
  assert.match(markdown, /No prompt changes are proposed by this audit/);
  // tutor-ego-placebo.md was in this list until 2026-08-09, when the
  // course-479 freeze synced the bundled copy from authoritative prompts/
  // (version 1.1) — that drift is repaired, not newly ignored.
  assert.deepEqual(
    audit.inventory.mirror_drift.map(({ file }) => file),
    ['tutor-ego-recognition-nomem.md'],
  );
});

// CLAUDE.md (2026-08-21): a tutor prompt is a file that is edited in place, so
// an edit to one is written down here and the audit still passes. The evidence
// snippet check is what fails when the audit has really gone stale.
test('audit records a prompt edit instead of refusing over its digest', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-prompt-agency-audit-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  fs.mkdirSync(path.join(root, 'config'), { recursive: true });
  fs.mkdirSync(path.join(root, 'tutor-core', 'config'), { recursive: true });
  fs.cpSync(path.join(REPO_ROOT, 'prompts'), path.join(root, 'prompts'), { recursive: true });
  fs.cpSync(path.join(REPO_ROOT, 'tutor-core', 'prompts'), path.join(root, 'tutor-core', 'prompts'), {
    recursive: true,
  });
  fs.copyFileSync(path.join(REPO_ROOT, 'config', 'tutor-agents.yaml'), path.join(root, 'config', 'tutor-agents.yaml'));
  fs.copyFileSync(
    path.join(REPO_ROOT, 'tutor-core', 'config', 'tutor-agents.yaml'),
    path.join(root, 'tutor-core', 'config', 'tutor-agents.yaml'),
  );
  fs.appendFileSync(path.join(root, 'prompts', 'tutor-ego.md'), '\nUnreviewed instruction.\n');

  const audit = buildTutorPromptAgencyAudit({ root, ledgerPath: DEFAULT_LEDGER });
  assert.deepEqual(audit.errors, []);
  assert.equal(audit.valid, true);
  const record = audit.inventory.digest_records.find((entry) => entry.path.endsWith('tutor-ego.md'));
  assert.equal(record.drifted, true);
});
