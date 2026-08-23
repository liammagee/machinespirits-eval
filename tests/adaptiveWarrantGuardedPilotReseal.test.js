import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  GUARDED_PILOT_MANIFEST_DEFAULT_BASE,
  GUARDED_PILOT_MANIFEST_DEFAULT_OUT,
  GUARDED_RESEAL_DIGEST_SOURCES,
  OUTCOME_RESIZED_MANIFEST_KEYS,
  auditFrozenResponseSchemaActCoverage,
  auditProviderResponseSchemaPin,
  classifyGuardedResealDrift,
  refuseFrozenSchemaAuditDowngrade,
  sealGuardedOutcomePilotManifest,
} from '../scripts/seal-guarded-warrant-outcome-manifest.js';
import {
  GUARDED_FREEZE_DEFAULT_BASE,
  GUARDED_FREEZE_DEFAULT_OUT,
  assertAcceptanceArtifactAdmissible,
  assertManifestPinAgrees,
} from '../scripts/seal-guarded-warrant-instrument-freeze.js';
import {
  validateOutcomeFreezeFormForFrozenDecisionRunner,
  validateOutcomePilotGoNote,
  verifyOutcomePilotManifestBindings,
} from '../scripts/run-adaptive-warrant-outcome-pilot.js';
import {
  OUTCOME_PILOT_EXCLUDED_ARTIFACTS,
  OUTCOME_RUN_SHAPES,
  absentOutcomeExcludedArtifacts,
  buildOutcomeInterleavedAssignment,
  guardOutcomePilotPreparation,
} from '../scripts/prepare-adaptive-warrant-outcome-study.js';
import {
  GUARDED_PILOT_GO_NOTE,
  simulateGuardedMainBlockLaunch,
} from '../scripts/simulate-guarded-main-block-launch.js';
import { adaptiveWarrantSemanticInstrumentBindings } from '../services/adaptiveWarrantSemanticPreflight.js';
import { ADAPTIVE_WARRANT_SEMANTIC_DEFENSIVE_SPEECH_ACTS } from '../services/adaptiveWarrantSemanticEvents.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/** The main block's launch note, filled and armed once its approval landed (relay 118 §1). */
const GUARDED_MAIN_BLOCK_GO_NOTE = 'docs/adaptation-refinement/relay/118-go-guarded-main-block.md';

// Same machine-local condition the pilot suite uses: the freshness guard reads
// gitignored run artifacts that live only in the private archive.
const MACHINE_LOCAL_ARTIFACT = path.join(
  ROOT,
  '.tutor-stub-auto-eval/adaptive-warrant-baseline-pilot-v2-live-2026-08-10/annotation-sample.blinded.json',
);
const MACHINE_LOCAL_ARTIFACTS_SKIP = fs.existsSync(MACHINE_LOCAL_ARTIFACT)
  ? false
  : `machine-local warrant run artifacts absent (${MACHINE_LOCAL_ARTIFACT}); archived in the private repo`;

// A narrower condition, and a different one: some burned corpora sit in the
// system temp directory, which a housekeeping job empties (defect ledger 21).
// Once any of them is gone, a FRESH-launch guard is meant to refuse, so tests
// that drive the fresh path here have nothing left to prove. Restart-path tests
// must never carry this skip — standing in from the launch record is exactly
// what they check.
const absentBurnedCorpora = absentOutcomeExcludedArtifacts();
const BURNED_CORPORA_SKIP = absentBurnedCorpora.length
  ? `burned corpora absent on this machine (${absentBurnedCorpora.length} of ${OUTCOME_PILOT_EXCLUDED_ARTIFACTS.length}); a fresh launch is meant to refuse here`
  : false;
const HISTORICAL_SOURCE_PIN_DRIFT_SKIP =
  readManifest(GUARDED_PILOT_MANIFEST_DEFAULT_BASE).standing_permission.source_sha256[
    'services/tutorStubFirstDraftContract.js'
  ] === fileSha256(path.join(ROOT, 'services/tutorStubFirstDraftContract.js'))
    ? false
    : 'historical outcome manifests correctly refuse after the frozen first-draft source pin drifted';

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

function currentSourcePinFixture(t, relativePath) {
  const manifest = readManifest(relativePath);
  const repinned = [];
  for (const sourcePath of Object.keys(manifest.standing_permission?.source_sha256 || {})) {
    const current = fileSha256(path.join(ROOT, sourcePath));
    if (manifest.standing_permission.source_sha256[sourcePath] !== current) {
      manifest.standing_permission.source_sha256[sourcePath] = current;
      repinned.push(sourcePath);
    }
  }
  assert.deepEqual(repinned, ['services/tutorStubFirstDraftContract.js']);
  const fixturePath = path.join(temporaryDirectory(t), path.basename(relativePath));
  fs.writeFileSync(fixturePath, `${JSON.stringify(manifest, null, 2)}\n`);
  return {
    basePath: fixturePath,
    sealedCommit: execFileSync('git', ['log', '-1', '--format=%H', '--', relativePath], { cwd: ROOT })
      .toString('utf8')
      .trim(),
  };
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
  { skip: MACHINE_LOCAL_ARTIFACTS_SKIP || BURNED_CORPORA_SKIP },
  () => {
    const passive = verifyOutcomePilotManifestBindings({ manifestPath: GUARDED_PILOT_MANIFEST_DEFAULT_BASE });
    const guarded = verifyOutcomePilotManifestBindings({ manifestPath: GUARDED_PILOT_MANIFEST_DEFAULT_OUT });
    assert.equal(passive.preparation.learner_profile, 'low_agency');
    assert.equal(guarded.preparation.learner_profile, 'overconfident');
  },
);

test(
  'the launcher refuses a persona that does not match the manifest',
  { skip: HISTORICAL_SOURCE_PIN_DRIFT_SKIP },
  () => {
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
  },
);

test(
  'the persona reaches the freshness fingerprints',
  { skip: MACHINE_LOCAL_ARTIFACTS_SKIP || BURNED_CORPORA_SKIP },
  () => {
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
      passive.candidate_fingerprints.filter((fingerprint) => guarded.candidate_fingerprints.includes(fingerprint))
        .length,
      0,
      'the persona must change every prepared-run fingerprint',
    );
  },
);

test('the re-seal refuses an unsupported persona', () => {
  assert.throws(
    () => sealGuardedOutcomePilotManifest({ learnerProfile: 'defiant' }),
    /unsupported outcome-study learner profile/u,
  );
});

test('the re-seal refuses a program change that was not declared', (t) => {
  const fixture = currentSourcePinFixture(t, GUARDED_PILOT_MANIFEST_DEFAULT_BASE);
  assert.throws(
    () => sealGuardedOutcomePilotManifest({ ...fixture, contractChangedFiles: [] }),
    /changed as a program and was not declared a contract change/u,
  );
});

test('the re-seal refuses a declared contract change that did not change', (t) => {
  const fixture = currentSourcePinFixture(t, GUARDED_PILOT_MANIFEST_DEFAULT_BASE);
  assert.throws(
    () =>
      sealGuardedOutcomePilotManifest({
        ...fixture,
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

test('the provider-response-schema pin is re-pinned from a proved artifact, and leaves the A1 value', () => {
  const guarded = readManifest(GUARDED_PILOT_MANIFEST_DEFAULT_OUT);
  const pin = guarded.reseal.provider_response_schema_pin;
  assert.equal(pin.status, 'repinned');
  assert.equal(pin.repinned, true);
  assert.equal(pin.acceptance_proved, true);
  assert.match(pin.acceptance_artifact.path, /^\//u, 'an artifact outside the repo is recorded absolute');
  // The whole point of rung 0: the pin no longer equals the A1 value it used to
  // be checked against.
  const base = readManifest(GUARDED_PILOT_MANIFEST_DEFAULT_BASE);
  assert.notEqual(
    guarded.presence_channel.digests.provider_response_schema_sha256,
    base.presence_channel.digests.provider_response_schema_sha256,
  );
  assert.equal(guarded.presence_channel.digests.provider_response_schema_sha256, pin.current_sha256);
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
    /is not an ancestor of HEAD/u,
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

// A schema file that names every act in the current catalogue. The coverage
// audit reads text, so the catalogue source itself is a faithful stand-in.
function currentContractSchemaFixture(directory) {
  const schemaPath = path.join(directory, 'response.schema.json');
  fs.writeFileSync(schemaPath, fs.readFileSync(path.join(ROOT, 'services/adaptiveWarrantSemanticEvents.js')));
  return schemaPath;
}

test('a passing acceptance artifact whose schema covers the contract re-pins the provider schema', (t) => {
  const directory = temporaryDirectory(t);
  const artifactPath = path.join(directory, 'acceptance.json');
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT }).toString('utf8').trim();
  const fresh = 'c'.repeat(64);
  fs.writeFileSync(
    artifactPath,
    JSON.stringify({
      status: 'passed',
      source_commit: head,
      response_schema: { sha256: fresh, path: currentContractSchemaFixture(directory) },
    }),
  );
  const pin = auditProviderResponseSchemaPin({ acceptancePath: artifactPath, inheritedSha256: 'b'.repeat(64) });
  assert.equal(pin.status, 'repinned');
  assert.equal(pin.repinned, true);
  assert.equal(pin.current_sha256, fresh);
  assert.equal(pin.acceptance_proved, true);
});

// The stamp rule is "from this line of work", not "equal to HEAD". Demanding
// equality would refuse a good artifact the moment the next commit landed, and
// push a later re-seal toward spending another call for no new evidence.
test('an ancestor commit is accepted, so a later commit does not invalidate a paid ping', (t) => {
  const directory = temporaryDirectory(t);
  const artifactPath = path.join(directory, 'acceptance.json');
  const parent = execFileSync('git', ['rev-parse', 'HEAD~1'], { cwd: ROOT }).toString('utf8').trim();
  fs.writeFileSync(
    artifactPath,
    JSON.stringify({
      status: 'passed',
      source_commit: parent,
      response_schema: { sha256: 'c'.repeat(64), path: currentContractSchemaFixture(directory) },
    }),
  );
  const pin = auditProviderResponseSchemaPin({ acceptancePath: artifactPath, inheritedSha256: 'b'.repeat(64) });
  assert.equal(pin.status, 'repinned');
});

// The check that carries the weight. A commit stamp says when; only the schema
// says what the provider actually accepted.
test('an acceptance artifact whose schema predates the contract cannot re-pin, whatever its commit', (t) => {
  const directory = temporaryDirectory(t);
  const artifactPath = path.join(directory, 'acceptance.json');
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT }).toString('utf8').trim();
  const schemaPath = path.join(directory, 'old.schema.json');
  const catalogue = fs.readFileSync(path.join(ROOT, 'services/adaptiveWarrantSemanticEvents.js'), 'utf8');
  fs.writeFileSync(
    schemaPath,
    ADAPTIVE_WARRANT_SEMANTIC_DEFENSIVE_SPEECH_ACTS.reduce((text, act) => text.split(act).join('x_removed'), catalogue),
  );
  fs.writeFileSync(
    artifactPath,
    JSON.stringify({
      status: 'passed',
      source_commit: head,
      response_schema: { sha256: 'c'.repeat(64), path: schemaPath },
    }),
  );
  assert.throws(
    () => auditProviderResponseSchemaPin({ acceptancePath: artifactPath, inheritedSha256: 'b'.repeat(64) }),
    /does not cover the current contract/u,
  );
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
  'the real A1 acceptance artifact is refused on ancestry and reports its detached schema as unresolved',
  {
    skip: fs.existsSync(A1_ACCEPTANCE_ARTIFACT) ? false : `private-archive artifact absent (${A1_ACCEPTANCE_ARTIFACT})`,
  },
  () => {
    const artifact = JSON.parse(fs.readFileSync(A1_ACCEPTANCE_ARTIFACT, 'utf8'));
    assert.equal(artifact.status, 'passed');
    assert.match(artifact.source_commit, /^[0-9a-f]{40}$/u);
    assert.equal(artifact.bindings, undefined, 'the ping writes source_commit at the top level');
    // Its commit is off this line of work, so ancestry refuses it first.
    assert.throws(
      () => auditProviderResponseSchemaPin({ acceptancePath: A1_ACCEPTANCE_ARTIFACT, inheritedSha256: null }),
      /is not an ancestor of HEAD/u,
    );
    // The private archive preserves the acceptance record but not the
    // /private/tmp response-schema path it named. Do not infer a coverage
    // verdict from a missing file: the audit must say unresolved.
    const coverage = auditFrozenResponseSchemaActCoverage(artifact.response_schema.path);
    assert.equal(coverage.status, 'unresolved');
    assert.equal(coverage.missing_speech_acts, null);
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

// --- the guarded instrument freeze -----------------------------------------
//
// Re-pinning the manifest alone would stop the pilot dead: the launcher checks
// that pin against the acceptance artifact the freeze names, and the A1 freeze
// names the 15-act one. These tests hold the two halves together.

const GUARDED_FREEZE = path.join(ROOT, GUARDED_FREEZE_DEFAULT_OUT);

function fileSha256(filePath) {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

test('the sealed guarded freeze is the form the frozen decision runner accepts', () => {
  const freeze = JSON.parse(fs.readFileSync(GUARDED_FREEZE, 'utf8'));
  assert.equal(validateOutcomeFreezeFormForFrozenDecisionRunner(freeze).status, 'passed');
  assert.equal(freeze.guarded_reseal.zero_model_calls, true);
  assert.equal(freeze.guarded_reseal.contract_version, 'v3.3');
});

test('the freeze, the acceptance artifact and the manifest pin agree on one hash', () => {
  const freeze = JSON.parse(fs.readFileSync(GUARDED_FREEZE, 'utf8'));
  const acceptancePath = path.resolve(ROOT, freeze.semantic_instrument.schema_acceptance.path);
  assert.ok(fs.existsSync(acceptancePath), 'the freeze names an acceptance artifact that is on disk');
  assert.equal(
    fileSha256(acceptancePath),
    freeze.semantic_instrument.schema_acceptance.sha256,
    'the freeze binds the artifact by hash',
  );
  const acceptance = JSON.parse(fs.readFileSync(acceptancePath, 'utf8'));
  const pinned = readManifest(GUARDED_PILOT_MANIFEST_DEFAULT_OUT).presence_channel.digests
    .provider_response_schema_sha256;
  // This equality is exactly the launcher's provider_response_schema check.
  assert.equal(acceptance.response_schema.sha256, pinned);
});

test('the accepted response schema is on disk inside the repo and covers the v3.3 contract', () => {
  const freeze = JSON.parse(fs.readFileSync(GUARDED_FREEZE, 'utf8'));
  const acceptancePath = path.resolve(ROOT, freeze.semantic_instrument.schema_acceptance.path);
  const acceptance = JSON.parse(fs.readFileSync(acceptancePath, 'utf8'));
  const schemaPath = path.resolve(ROOT, acceptance.response_schema.path);
  assert.ok(schemaPath.startsWith(`${ROOT}${path.sep}`), 'a /private/tmp clean must not be able to break a launch');
  assert.equal(fileSha256(schemaPath), acceptance.response_schema.sha256, 'the copy is byte-identical');
  assert.equal(auditFrozenResponseSchemaActCoverage(schemaPath).status, 'covers_current_contract');
});

test(
  'the freeze inherits every other field from the A1 freeze unchanged',
  { skip: fs.existsSync(GUARDED_FREEZE_DEFAULT_BASE) ? false : `A1 freeze absent (${GUARDED_FREEZE_DEFAULT_BASE})` },
  () => {
    const base = JSON.parse(fs.readFileSync(GUARDED_FREEZE_DEFAULT_BASE, 'utf8'));
    const freeze = JSON.parse(fs.readFileSync(GUARDED_FREEZE, 'utf8'));
    for (const key of Object.keys(base)) {
      if (key === 'semantic_instrument') continue;
      assert.deepEqual(freeze[key], base[key], `${key} must be inherited unchanged`);
    }
    assert.deepEqual(freeze.semantic_instrument.preflight, base.semantic_instrument.preflight);
    assert.deepEqual(freeze.guarded_reseal.replaced_binding.was, base.semantic_instrument.schema_acceptance);
  },
);

test('the freeze re-seal refuses when the manifest pin and the acceptance artifact disagree', () => {
  assert.throws(
    () =>
      assertManifestPinAgrees({
        manifest: { presence_channel: { digests: { provider_response_schema_sha256: 'a'.repeat(64) } } },
        acceptance: { response_schema: { sha256: 'b'.repeat(64) } },
      }),
    /re-seal the manifest from this artifact first/u,
  );
});

test('the freeze re-seal refuses an acceptance artifact that is not admissible for carryover', (t) => {
  const directory = temporaryDirectory(t);
  const schemaPath = currentContractSchemaFixture(directory);
  const admissible = {
    status: 'passed',
    inferential_role: 'transport_only_permanently_excluded',
    synthetic_case_permanently_excluded: true,
    response_received: true,
    calls: { attempted: 1, completed: 1, maximum: 1 },
    prohibited_tool_event_count: 0,
    source_commit: '0'.repeat(40),
    response_schema: { sha256: fileSha256(schemaPath), path: schemaPath },
  };
  assert.equal(assertAcceptanceArtifactAdmissible(admissible).status, 'passed');
  assert.throws(
    () => assertAcceptanceArtifactAdmissible({ ...admissible, calls: { attempted: 2, completed: 2, maximum: 2 } }),
    /calls not 1\/1\/1/u,
  );
  assert.throws(
    () =>
      assertAcceptanceArtifactAdmissible({
        ...admissible,
        response_schema: { ...admissible.response_schema, sha256: 'd'.repeat(64) },
      }),
    /no longer hashes to its recorded value/u,
  );
});

// --- Resizing a sealed manifest to the guarded main block ---

test('sealing at pilot size leaves every size field exactly as the committed manifest has it', (t) => {
  const fixture = currentSourcePinFixture(t, GUARDED_PILOT_MANIFEST_DEFAULT_BASE);
  const sealed = sealGuardedOutcomePilotManifest(fixture).manifest;
  const committed = JSON.parse(fs.readFileSync(path.resolve(ROOT, GUARDED_PILOT_MANIFEST_DEFAULT_OUT), 'utf8'));
  for (const key of ['seeds', 'interleaved_condition_assignment', 'case_extraction', 'planned_calls']) {
    assert.deepEqual(sealed[key], committed[key], key);
  }
  assert.equal('run_shape' in sealed, false);
  assert.equal(sealed.inherits_from.unchanged.length, 8);
  assert.equal('resized' in sealed.inherits_from, false);
  assert.equal(sealed.reseal.ledger_note.stale, true);
});

test('the main-block seal rebuilds the five size fields and inherits the rest', (t) => {
  const fixture = currentSourcePinFixture(t, GUARDED_PILOT_MANIFEST_DEFAULT_BASE);
  const { manifest, base } = sealGuardedOutcomePilotManifest({
    ...fixture,
    shape: OUTCOME_RUN_SHAPES['main-block'],
    counterBefore: 11559,
  });
  assert.equal(manifest.run_shape, 'main-block');
  assert.deepEqual(manifest.seeds, [654, 655, 656, 657, 658, 659, 660, 661, 662, 663, 664, 665]);
  assert.equal(manifest.interleaved_condition_assignment.length, 72);
  assert.equal(manifest.case_extraction.dialogues, 72);
  assert.equal(manifest.case_extraction.expected_case_count, 576);
  assert.deepEqual(manifest.planned_calls, {
    generation: 2160,
    presence_readers: 1152,
    decision_readers: 1152,
    total: 4464,
    arithmetic: '(72 x 30 cap) + (2 x 576) + (2 x 576) = 4464; measured live unit 26 per dialogue (report 069)',
    counter_before: 11559,
    counter_after_if_completed: 16023,
    ceiling: 19337,
    remaining_after_if_completed: 3314,
  });
  // The size fields move out of the inherited list and into their own.
  assert.deepEqual(manifest.inherits_from.resized, [...OUTCOME_RESIZED_MANIFEST_KEYS]);
  for (const key of OUTCOME_RESIZED_MANIFEST_KEYS) {
    assert.equal(manifest.inherits_from.unchanged.includes(key), false, key);
  }
  assert.deepEqual(manifest.inherits_from.unchanged, [
    'worlds',
    'conditions',
    'standing_permission',
    'decision_channel',
  ]);
  // Everything that describes the study rather than its size is untouched.
  assert.deepEqual(manifest.worlds, base.worlds);
  assert.deepEqual(manifest.standing_permission, base.standing_permission);
  assert.equal(manifest.launch_authorized, false);
  assert.equal(manifest.reseal.ledger_note.stale, false);
  assert.equal(manifest.reseal.ledger_note.counter_read_at_reseal, 11559);
});

test('a resize without the live counter, or one that would pass the ceiling, is refused', (t) => {
  const fixture = currentSourcePinFixture(t, GUARDED_PILOT_MANIFEST_DEFAULT_BASE);
  assert.throws(
    () => sealGuardedOutcomePilotManifest({ ...fixture, shape: OUTCOME_RUN_SHAPES['main-block'] }),
    /needs --counter-before/u,
  );
  assert.throws(
    () =>
      sealGuardedOutcomePilotManifest({
        ...fixture,
        shape: OUTCOME_RUN_SHAPES['main-block'],
        counterBefore: 15000,
      }),
    /would pass the 19337 ceiling/u,
  );
});

test('the rebuilt pilot condition order reproduces the frozen eighteen rows', () => {
  const committed = JSON.parse(fs.readFileSync(path.resolve(ROOT, GUARDED_PILOT_MANIFEST_DEFAULT_OUT), 'utf8'));
  const rebuilt = buildOutcomeInterleavedAssignment({
    shape: OUTCOME_RUN_SHAPES.pilot,
    worldIds: committed.worlds.map((world) => world.id),
  });
  assert.deepEqual(rebuilt, committed.interleaved_condition_assignment);
});

test('the main-block condition order covers every cell once and balances the three conditions', () => {
  const committed = JSON.parse(fs.readFileSync(path.resolve(ROOT, GUARDED_PILOT_MANIFEST_DEFAULT_OUT), 'utf8'));
  const rows = buildOutcomeInterleavedAssignment({
    shape: OUTCOME_RUN_SHAPES['main-block'],
    worldIds: committed.worlds.map((world) => world.id),
  });
  assert.equal(rows.length, 72);
  assert.equal(new Set(rows.map((row) => `${row.world}|${row.seed}|${row.condition}`)).size, 72);
  for (const condition of ['bare', 'gated', 'standing_permission']) {
    assert.equal(rows.filter((row) => row.condition === condition).length, 24, condition);
  }
  assert.deepEqual(rows.map((row) => row.order).slice(0, 4), [1, 2, 3, 4]);
});

// --- Zero-call launch simulation for the sealed main block ---

test(
  'the launch simulation passes on the sealed main-block manifest and makes no call',
  { skip: BURNED_CORPORA_SKIP },
  () => {
    const report = simulateGuardedMainBlockLaunch({});
    assert.equal(report.status, 'passed');
    assert.equal(report.zero_model_calls, true);
    assert.equal(report.run_shape, 'main-block');
    assert.equal(report.launch_authorized, false);
    assert.equal(report.size.dialogues, 72);
    assert.equal(report.size.cases, 576);
    assert.equal(report.planned_calls.total, 4464);
    for (const check of report.checks) assert.equal(check.held, true, check.name);
    assert.equal(
      report.checks.some((check) => check.name === 'no_go_note_supplied'),
      true,
    );
  },
);

test(
  'the filled launch note launches the main block, and the simulation says so',
  { skip: BURNED_CORPORA_SKIP },
  () => {
    const report = simulateGuardedMainBlockLaunch({ goNotePath: GUARDED_MAIN_BLOCK_GO_NOTE });
    assert.equal(report.status, 'passed');
    const check = report.checks.find((entry) => entry.name === 'supplied_go_note_accepted');
    assert.equal(check.held, true);
    assert.match(check.detail, /4464-call scope and seeds 654-665/u);
  },
);

test('the main-block GO note cannot launch a pilot through the stricter reviewer-note filename gate', () => {
  const pilotShape = OUTCOME_RUN_SHAPES.pilot;
  assert.throws(
    () => validateOutcomePilotGoNote(GUARDED_MAIN_BLOCK_GO_NOTE, { shape: pilotShape }),
    /must be a reviewer-go-note file/u,
  );
});

test('the pilot note still cannot launch the main block', { skip: BURNED_CORPORA_SKIP }, () => {
  const report = simulateGuardedMainBlockLaunch({ heldGoNotePath: GUARDED_PILOT_GO_NOTE });
  assert.equal(report.status, 'passed');
  assert.equal(report.checks.find((entry) => entry.name === 'held_go_note_refused').held, true);
});

test('a note cannot be asked to launch and to be refused at the same time', () => {
  assert.throws(
    () =>
      simulateGuardedMainBlockLaunch({
        goNotePath: GUARDED_MAIN_BLOCK_GO_NOTE,
        heldGoNotePath: GUARDED_PILOT_GO_NOTE,
      }),
    /expected to launch or expected to be refused, not both/u,
  );
});

test('the launch note carries all four tokens the launcher reads out of it', () => {
  const text = fs.readFileSync(path.resolve(ROOT, GUARDED_MAIN_BLOCK_GO_NOTE), 'utf8');
  assert.equal(text.includes('run-adaptive-warrant-outcome-pilot.js'), true);
  assert.equal(text.includes('654') && text.includes('665'), true);
  assert.equal(/\bGO\b/u.test(text), true);
  assert.equal(/4,?464/u.test(text), true);
});

test(
  'the launch simulation fails when a manifest of the wrong size is handed to it',
  { skip: BURNED_CORPORA_SKIP },
  (t) => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'main-block-sim-'));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    const pilotCopy = path.join(directory, 'pilot.json');
    fs.copyFileSync(path.resolve(ROOT, GUARDED_PILOT_MANIFEST_DEFAULT_OUT), pilotCopy);
    const report = simulateGuardedMainBlockLaunch({ manifestPath: pilotCopy });
    assert.equal(report.status, 'failed');
    assert.equal(report.run_shape, 'pilot');
    assert.equal(report.checks.find((check) => check.name === 'manifest_binds_to_main_block').held, false);
  },
);
