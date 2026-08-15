import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  GUARDED_PILOT_MANIFEST_DEFAULT_BASE,
  GUARDED_PILOT_MANIFEST_DEFAULT_OUT,
  GUARDED_RESEAL_DIGEST_SOURCES,
  auditFrozenResponseSchemaActCoverage,
  auditProviderResponseSchemaPin,
  classifyGuardedResealDrift,
  refuseFrozenSchemaAuditDowngrade,
  sealGuardedOutcomePilotManifest,
} from '../scripts/seal-guarded-warrant-outcome-manifest.js';
import { verifyOutcomePilotManifestBindings } from '../scripts/run-adaptive-warrant-outcome-pilot.js';
import { guardOutcomePilotPreparation } from '../scripts/prepare-adaptive-warrant-outcome-study.js';
import { adaptiveWarrantSemanticInstrumentBindings } from '../services/adaptiveWarrantSemanticPreflight.js';
import { ADAPTIVE_WARRANT_SEMANTIC_DEFENSIVE_SPEECH_ACTS } from '../services/adaptiveWarrantSemanticEvents.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Same machine-local condition the pilot suite uses: the freshness guard reads
// gitignored run artifacts that live only in the private archive.
const MACHINE_LOCAL_ARTIFACT = path.join(
  ROOT,
  '.tutor-stub-auto-eval/adaptive-warrant-baseline-pilot-v2-live-2026-08-10/annotation-sample.blinded.json',
);
const MACHINE_LOCAL_ARTIFACTS_SKIP = fs.existsSync(MACHINE_LOCAL_ARTIFACT)
  ? false
  : `machine-local warrant run artifacts absent (${MACHINE_LOCAL_ARTIFACT}); archived in the private repo`;

function headBindings() {
  return adaptiveWarrantSemanticInstrumentBindings({
    sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT }).toString('utf8').trim(),
  });
}

function readManifest(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function temporaryDirectory(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'guarded-reseal-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

test('the passive A1 seal is untouched by the re-seal and stays a v3.2 seal', () => {
  const base = readManifest(GUARDED_PILOT_MANIFEST_DEFAULT_BASE);
  const bindings = headBindings();
  assert.equal(base.learner_profile, undefined, 'the A1 manifest must name no persona');
  assert.equal(base.reseal, undefined, 'the A1 manifest must carry no re-seal block');
  assert.notEqual(base.presence_channel.digests.extraction_schema_digest, bindings.extraction_schema.digest);
  assert.notEqual(base.presence_channel.digests.reader_digest, bindings.reader_schema_digest);
});

test('the guarded manifest re-pins exactly the two contested digests and inherits the rest', () => {
  const base = readManifest(GUARDED_PILOT_MANIFEST_DEFAULT_BASE);
  const guarded = readManifest(GUARDED_PILOT_MANIFEST_DEFAULT_OUT);
  const bindings = headBindings();
  assert.equal(guarded.learner_profile, 'overconfident');
  assert.equal(guarded.contract_version, 'v3.3');
  assert.equal(guarded.launch_authorized, false);
  assert.equal(guarded.presence_channel.digests.extraction_schema_digest, bindings.extraction_schema.digest);
  assert.equal(guarded.presence_channel.digests.reader_digest, bindings.reader_schema_digest);
  for (const field of ['worlds', 'seeds', 'conditions', 'planned_calls', 'standing_permission', 'decision_channel']) {
    assert.deepEqual(guarded[field], base[field], `${field} must be inherited unchanged`);
  }
});

test(
  'both manifests pass the launcher manifest guard, each under its own persona',
  { skip: MACHINE_LOCAL_ARTIFACTS_SKIP },
  () => {
    const passive = verifyOutcomePilotManifestBindings({ manifestPath: GUARDED_PILOT_MANIFEST_DEFAULT_BASE });
    const guarded = verifyOutcomePilotManifestBindings({ manifestPath: GUARDED_PILOT_MANIFEST_DEFAULT_OUT });
    assert.equal(passive.preparation.learner_profile, 'low_agency');
    assert.equal(guarded.preparation.learner_profile, 'overconfident');
  },
);

test('the launcher refuses a persona that does not match the manifest', () => {
  assert.throws(
    () =>
      verifyOutcomePilotManifestBindings({
        manifestPath: GUARDED_PILOT_MANIFEST_DEFAULT_OUT,
        expectedLearnerProfile: 'low_agency',
      }),
    /does not match the manifest persona overconfident/u,
  );
  assert.throws(
    () =>
      verifyOutcomePilotManifestBindings({
        manifestPath: GUARDED_PILOT_MANIFEST_DEFAULT_BASE,
        expectedLearnerProfile: 'overconfident',
      }),
    /does not match the manifest persona low_agency/u,
  );
});

test('the persona reaches the freshness fingerprints', { skip: MACHINE_LOCAL_ARTIFACTS_SKIP }, () => {
  const worldPaths = readManifest(GUARDED_PILOT_MANIFEST_DEFAULT_BASE).worlds.map((world) => world.path);
  const passive = guardOutcomePilotPreparation({ worldPaths, learnerProfile: 'low_agency' });
  const guarded = guardOutcomePilotPreparation({ worldPaths, learnerProfile: 'overconfident' });
  assert.equal(passive.status, 'passed');
  assert.equal(guarded.status, 'passed');
  assert.equal(passive.learner_profile, 'low_agency');
  assert.equal(guarded.learner_profile, 'overconfident');
  assert.equal(passive.prepared_run_count, guarded.prepared_run_count);
  // Every planned run hashes differently under the guarded persona, so the
  // guarded pole is checked against the burned corpora as itself.
  assert.equal(
    passive.candidate_fingerprints.filter((fingerprint) => guarded.candidate_fingerprints.includes(fingerprint)).length,
    0,
    'the persona must change every prepared-run fingerprint',
  );
});

test('the re-seal refuses an unsupported persona', () => {
  assert.throws(
    () => sealGuardedOutcomePilotManifest({ learnerProfile: 'defiant' }),
    /unsupported outcome-study learner profile/u,
  );
});

test('the re-seal refuses a program change that was not declared', () => {
  assert.throws(
    () => sealGuardedOutcomePilotManifest({ contractChangedFiles: [] }),
    /changed as a program and was not declared a contract change/u,
  );
});

test('the re-seal refuses a declared contract change that did not change', () => {
  assert.throws(
    () =>
      sealGuardedOutcomePilotManifest({
        contractChangedFiles: [
          'services/adaptiveWarrantSemanticEvents.js',
          'services/adaptiveWarrantSemanticAnnotation.js',
        ],
      }),
    /declared contract change did not change/u,
  );
});

test('drift classification separates a reflow from a program change', () => {
  const sealedCommit = readManifest(GUARDED_PILOT_MANIFEST_DEFAULT_OUT).inherits_from.sealed_at_commit;
  const events = classifyGuardedResealDrift({
    relativePath: 'services/adaptiveWarrantSemanticEvents.js',
    sealedCommit,
  });
  const reader = classifyGuardedResealDrift({
    relativePath: 'services/adaptiveWarrantSemanticAnnotation.js',
    sealedCommit,
  });
  assert.equal(events.drift, 'program_changed');
  assert.equal(reader.drift, 'reflow_only');
  assert.notEqual(reader.sealed_sha256, reader.current_sha256, 'a reflow still moves the bytes');
});

test('every re-pinned digest names the files it covers', () => {
  const guarded = readManifest(GUARDED_PILOT_MANIFEST_DEFAULT_OUT);
  const covered = new Set(guarded.reseal.drift.map((row) => row.path));
  for (const sources of Object.values(GUARDED_RESEAL_DIGEST_SOURCES)) {
    for (const source of sources) assert.ok(covered.has(source), `${source} must be classified`);
  }
});

test('the re-seal records that the frozen response schema predates the v3.3 acts', () => {
  const guarded = readManifest(GUARDED_PILOT_MANIFEST_DEFAULT_OUT);
  const audit = guarded.reseal.frozen_response_schema;
  if (audit.status === 'unresolved') {
    assert.equal(audit.missing_speech_acts, null);
    return;
  }
  assert.equal(audit.status, 'predates_current_contract');
  assert.deepEqual(audit.defensive_speech_acts_missing, [...ADAPTIVE_WARRANT_SEMANTIC_DEFENSIVE_SPEECH_ACTS]);
});

test('the response-schema audit reports full coverage for a schema naming every act', (t) => {
  const directory = temporaryDirectory(t);
  const events = fs.readFileSync(path.join(ROOT, 'services/adaptiveWarrantSemanticEvents.js'), 'utf8');
  const schemaPath = path.join(directory, 'response.schema.json');
  fs.writeFileSync(schemaPath, events);
  const audit = auditFrozenResponseSchemaActCoverage(schemaPath);
  assert.equal(audit.status, 'covers_current_contract');
  assert.deepEqual(audit.missing_speech_acts, []);
});

test('the provider-response-schema pin is inherited and marked unproved, not passed off as checked', () => {
  const guarded = readManifest(GUARDED_PILOT_MANIFEST_DEFAULT_OUT);
  const pin = guarded.reseal.provider_response_schema_pin;
  assert.equal(pin.status, 'inherited_unproved');
  assert.equal(pin.repinned, false);
  assert.equal(pin.acceptance_proved, false);
  // The pin must still equal the A1 value, or the launcher would refuse.
  const base = readManifest(GUARDED_PILOT_MANIFEST_DEFAULT_BASE);
  assert.equal(
    guarded.presence_channel.digests.provider_response_schema_sha256,
    base.presence_channel.digests.provider_response_schema_sha256,
  );
});

test('with no acceptance artifact the provider-schema pin says so in words, not silence', () => {
  const pin = auditProviderResponseSchemaPin({ inheritedSha256: 'b'.repeat(64) });
  assert.equal(pin.status, 'inherited_unproved');
  assert.equal(pin.acceptance_proved, false);
  assert.equal(pin.inherited_sha256, 'b'.repeat(64));
  assert.match(pin.readers_answer_under, /built from the live act catalogue at run time/u);
});

test('an acceptance artifact with no response-schema hash cannot re-pin the provider schema', (t) => {
  const directory = temporaryDirectory(t);
  const artifactPath = path.join(directory, 'acceptance.json');
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT }).toString('utf8').trim();
  fs.writeFileSync(artifactPath, JSON.stringify({ status: 'passed', source_commit: head, response_schema: {} }));
  assert.throws(
    () => auditProviderResponseSchemaPin({ acceptancePath: artifactPath, inheritedSha256: 'b'.repeat(64) }),
    /carries no response-schema hash/u,
  );
});

test('a schema-acceptance artifact from another commit cannot re-pin the provider schema', (t) => {
  const directory = temporaryDirectory(t);
  const artifactPath = path.join(directory, 'acceptance.json');
  fs.writeFileSync(
    artifactPath,
    JSON.stringify({
      status: 'passed',
      source_commit: '0'.repeat(40),
      response_schema: { sha256: 'a'.repeat(64) },
    }),
  );
  assert.throws(
    () => auditProviderResponseSchemaPin({ acceptancePath: artifactPath, inheritedSha256: 'b'.repeat(64) }),
    /was stamped at 0{40}, not at HEAD/u,
  );
});

test('a failed schema-acceptance artifact cannot re-pin the provider schema', (t) => {
  const directory = temporaryDirectory(t);
  const artifactPath = path.join(directory, 'acceptance.json');
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT }).toString('utf8').trim();
  fs.writeFileSync(
    artifactPath,
    JSON.stringify({
      status: 'failed',
      source_commit: head,
      response_schema: { sha256: 'a'.repeat(64) },
    }),
  );
  assert.throws(
    () => auditProviderResponseSchemaPin({ acceptancePath: artifactPath, inheritedSha256: 'b'.repeat(64) }),
    /did not pass/u,
  );
});

test('a passing acceptance artifact at the current commit re-pins the provider schema', (t) => {
  const directory = temporaryDirectory(t);
  const artifactPath = path.join(directory, 'acceptance.json');
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT }).toString('utf8').trim();
  const fresh = 'c'.repeat(64);
  fs.writeFileSync(
    artifactPath,
    JSON.stringify({ status: 'passed', source_commit: head, response_schema: { sha256: fresh } }),
  );
  const pin = auditProviderResponseSchemaPin({ acceptancePath: artifactPath, inheritedSha256: 'b'.repeat(64) });
  assert.equal(pin.status, 'repinned');
  assert.equal(pin.repinned, true);
  assert.equal(pin.current_sha256, fresh);
  assert.equal(pin.acceptance_proved, true);
});

// Reads the real A1 acceptance artifact, so the audit is written against the
// shape the ping actually emits rather than a guessed one. It carries
// source_commit at the top level, not under bindings.
const A1_ACCEPTANCE_ARTIFACT = path.join(
  ROOT,
  '../machinespirits-eval-private/artifacts/adaptive-warrant-outcome-a1/seed-514-instrument-freeze',
  'adaptive-warrant-v3-schema-acceptance-carryover-ed19be42-r52-s514.json',
);

test(
  'the real A1 acceptance artifact is read, and refused because it is stamped at an older commit',
  {
    skip: fs.existsSync(A1_ACCEPTANCE_ARTIFACT) ? false : `private-archive artifact absent (${A1_ACCEPTANCE_ARTIFACT})`,
  },
  () => {
    const artifact = JSON.parse(fs.readFileSync(A1_ACCEPTANCE_ARTIFACT, 'utf8'));
    assert.equal(artifact.status, 'passed');
    assert.match(artifact.source_commit, /^[0-9a-f]{40}$/u);
    assert.equal(artifact.bindings, undefined, 'the ping writes source_commit at the top level');
    assert.throws(
      () => auditProviderResponseSchemaPin({ acceptancePath: A1_ACCEPTANCE_ARTIFACT, inheritedSha256: null }),
      new RegExp(`stamped at ${artifact.source_commit}, not at HEAD`, 'u'),
    );
  },
);

test('a re-seal without the frozen-schema path cannot blank out a status an earlier run read', (t) => {
  const directory = temporaryDirectory(t);
  const outPath = path.join(directory, 'seal.json');
  fs.writeFileSync(
    outPath,
    JSON.stringify({
      reseal: { frozen_response_schema: { status: 'predates_current_contract', path: '/tmp/frozen.json' } },
    }),
  );
  assert.throws(
    () => refuseFrozenSchemaAuditDowngrade({ outPath, audit: { status: 'unresolved' } }),
    /re-supply --frozen-response-schema/u,
  );
  // A resolved audit, or no earlier seal at all, passes.
  refuseFrozenSchemaAuditDowngrade({ outPath, audit: { status: 'predates_current_contract' } });
  refuseFrozenSchemaAuditDowngrade({ outPath: path.join(directory, 'absent.json'), audit: { status: 'unresolved' } });
});

test('the ledger fields are inherited and flagged stale rather than silently re-used', () => {
  const guarded = readManifest(GUARDED_PILOT_MANIFEST_DEFAULT_OUT);
  assert.equal(guarded.reseal.ledger_note.stale, true);
  assert.equal(guarded.reseal.ledger_note.re_read_at_go, true);
  assert.equal(guarded.planned_calls.total, 1116);
});
