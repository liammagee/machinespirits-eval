import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { loadTutorStubResistanceActionRegisterConfirmation } from '../services/tutorStubResistanceActionRegisterConfirmation.js';
import { loadTutorStubResistanceSemanticRegistration } from '../services/tutorStubResistanceSemanticRuntime.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DESIGN = 'config/tutor-stub-resistance-action-register-crossed-registration.v10.json';
const sha256 = (relativePath) =>
  crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, relativePath))).digest('hex');

test('V10 expands its immutable V9 base into a wholly fresh balanced design', () => {
  const raw = JSON.parse(fs.readFileSync(path.join(ROOT, DESIGN), 'utf8'));
  assert.equal(sha256(raw.baseRegistrationPath), raw.baseRegistrationSha256);
  assert.equal(raw.designSummary.sampleSize.total, 36);
  assert.equal(raw.designSummary.sampleSize.perArm, 18);
  assert.deepEqual(raw.designSummary.arms, ['plain', 'warm']);
  assert.equal(raw.designSummary.seed, 20260827);
  assert.equal(raw.designSummary.confirmatoryTest, 'two_sided_fisher_exact_alpha_0.05');
  assert.equal(raw.designSummary.spendCeiling.programmeModelAttempts, 10000);
  const loaded = loadTutorStubResistanceActionRegisterConfirmation({ registrationPath: DESIGN });
  assert.equal(loaded.registration.version, 10);
  assert.equal(loaded.registration.design.trigger.observationSemantics, 'prospective_frame_resistance_semantic_v5');
  assert.equal(loaded.registration.design.randomization.masterSeed, 20260827);
  assert.equal(loaded.plan.jobs.length, 36);
  assert.equal(loaded.plan.jobs.filter((row) => row.treatment.realization === 'plain').length, 18);
  assert.equal(loaded.plan.jobs.filter((row) => row.treatment.realization === 'warm').length, 18);
  assert.equal(new Set(loaded.plan.jobs.map((row) => row.run_seed)).size, 36);
  assert.ok(loaded.plan.jobs.every((row) => row.id.includes('confirmation-v6-')));
});

test('V10 pins the passing zero-call repair and excludes V9 from reuse or pooling', () => {
  const loaded = loadTutorStubResistanceActionRegisterConfirmation({ registrationPath: DESIGN });
  const binding = loadTutorStubResistanceSemanticRegistration(
    loaded.registration.semanticAdjudication.instrumentRegistrationPath,
  );
  assert.equal(binding.sha256, loaded.registration.semanticAdjudication.instrumentRegistrationSha256);
  assert.equal(
    sha256(loaded.registration.semanticAdjudication.validationReportPath),
    loaded.registration.semanticAdjudication.validationReportSha256,
  );
  const v9 = loaded.registration.preservation.excludedConfirmationBlocks.find((row) => row.id === 'v9');
  assert.deepEqual(
    { status: v9.status, reused: v9.reused, pooled: v9.pooled, outcomeSelected: v9.outcomeSelected },
    { status: 'incomplete_no_verdict', reused: false, pooled: false, outcomeSelected: false },
  );
  assert.equal(loaded.registration.executionReadiness.programmeLedgerAfterMaximum.reservedAttempts, 8387);
  assert.equal(loaded.registration.executionReadiness.programmeLedgerAfterMaximum.remaining, 1613);
  assert.equal(loaded.registration.authorization.launchRequiresFreshDigestBoundGoRequest, false);
  assert.equal(
    loaded.registration.authorization.launchPolicy,
    'merged_design_clean_detached_commit_signed_go_note',
  );
});
